import { jest, test, expect } from '@jest/globals';
import { VisitRepository } from '../src/features/visits/repository';
import { SessionRepository } from '../src/features/sessions/repository';
import { ReportRepository } from '../src/features/reports/repository';
import { emptyReport } from '../src/features/reports/models';
import { checkInAllowed, vietnamDay } from '../src/core/time';
const list = (items: unknown[], page = 0, totalPages = 1) => ({
  items,
  page,
  totalPages,
  totalElements: items.length,
});
test('calendar queries use Vietnam date and history has no date bound', async () => {
  const request = jest.fn(async () => list([]));
  const repo = new VisitRepository({ request });
  await repo.today(new Date('2026-10-31T18:00:00Z'));
  expect(request.mock.calls[0]).toEqual([
    'GET',
    '/booking-occurrences',
    undefined,
    { from: '2026-11-01', to: '2026-11-01', page: 0, size: 20 },
  ]);
  await repo.visits(0, undefined, undefined, 'COMPLETED');
  expect(request.mock.calls[2]).toEqual([
    'GET',
    '/booking-occurrences',
    undefined,
    { from: undefined, to: undefined, status: 'COMPLETED', page: 0, size: 20 },
  ]);
  expect(vietnamDay(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11-01');
});
test('check-in returns the actual backend sessionId and skip requires reason', async () => {
  const request = jest.fn(async () => ({
    sessionId: 'session-real',
    bookingId: 'booking',
    status: 'IN_PROGRESS',
    tasks: [],
  }));
  const repo = new SessionRepository({ request });
  expect((await repo.start('occurrence', {})).id).toBe('session-real');
  await expect(repo.task('s', 't', 'SKIPPED', '')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
test('only DONE counts as complete; check-in end boundary is excluded', async () => {
  const request = jest.fn(async () => ({
    sessionId: 's',
    bookingId: 'b',
    status: 'IN_PROGRESS',
    tasks: [
      { id: '1', title: 'A', status: 'DONE' },
      { id: '2', title: 'B', status: 'SKIPPED' },
    ],
  }));
  const session = await new SessionRepository({ request }).session('s');
  expect(session.done).toBe(1);
  expect(
    checkInAllowed(
      '2026-11-01T01:00:00Z',
      '2026-11-01T03:00:00Z',
      Date.parse('2026-11-01T01:30:00Z'),
    ),
  ).toBe(false);
});
test('report lookup scans every page and updates preserve optimistic version', async () => {
  const report = {
    id: 'r',
    sessionId: 's',
    status: 'DRAFT',
    version: 7,
    overallCondition: 'STABLE',
    summary: 'summary',
    photos: [],
  };
  const request = jest.fn(async (method: string, path: string) =>
    path === '/care-reports' && method === 'GET'
      ? list([], 0, 2)
      : path.startsWith('/care-reports?')
        ? null
        : report,
  );
  request.mockImplementation(
    async (method: string, path: string, _body?: unknown, query?: Record<string, unknown>) =>
      method === 'GET' && path === '/care-reports'
        ? query?.page === 0
          ? list([], 0, 2)
          : list([report], 1, 2)
        : report,
  );
  const repo = new ReportRepository({ request });
  const found = await repo.find('b', 's');
  expect(found?.id).toBe('r');
  await repo.save(found!);
  expect(request.mock.calls[2]).toEqual([
    'PUT',
    '/care-reports/r',
    expect.objectContaining({ version: 7, sessionId: 's' }),
  ]);
});
test('submitted reports reject editing and photos enforce count/type/size', async () => {
  const request = jest.fn<import('../src/core/api').ApiClient['request']>();
  const repo = new ReportRepository({ request });
  await expect(
    repo.save({
      id: 'r',
      sessionId: 's',
      status: 'SUBMITTED',
      version: 1,
      overallCondition: 'STABLE',
      summary: 'x',
      photos: [],
      mealNotes: '',
      medicationNotes: '',
      mobilityNotes: '',
      moodNotes: '',
      recommendations: '',
    }),
  ).rejects.toThrow();
  expect(() => repo.validatePhotos([{ mimeType: 'image/gif', size: 100 }], 0)).toThrow();
  expect(() =>
    repo.validatePhotos([{ mimeType: 'image/png', size: 11 * 1024 * 1024 }], 0),
  ).toThrow();
  expect(() => repo.validatePhotos([{ mimeType: 'image/png', size: 100 }], 5)).toThrow();
  expect(request).not.toHaveBeenCalled();
});

test.each(['save', 'submit', 'upload'] as const)(
  'an unreadable successful report %s response requires reconciliation',
  async (action) => {
    const repo = new ReportRepository({ request: async () => ({ id: 'committed' }) });
    const report = { ...emptyReport('session'), overallCondition: 'STABLE', summary: 'Summary' };
    const result =
      action === 'save'
        ? repo.save(report)
        : action === 'submit'
          ? repo.submit('report')
          : repo.upload(
              'report',
              [
                {
                  uri: 'content://fixture/photo',
                  name: 'photo.png',
                  mimeType: 'image/png',
                  size: 100,
                },
              ],
              0,
            );
    await expect(result).rejects.toMatchObject({ uncertain: true, status: 0 });
  },
);
