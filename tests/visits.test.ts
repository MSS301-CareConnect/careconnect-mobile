import { expect, jest, test } from '@jest/globals';
import { parseVisit } from '../src/features/visits/models';
import { VisitRepository } from '../src/features/visits/repository';
import {
  canAcknowledge,
  canReportNoShow,
  careStartStep,
  visitErrorKey,
} from '../src/features/visits/actions';
import { ApiError } from '../src/core/api';
const json = {
  id: 'v',
  bookingId: 'b',
  startAt: '2030-01-01T01:00:00Z',
  endAt: '2030-01-01T03:00:00Z',
  checkInClosesAt: '2030-01-01T01:10:00Z',
  status: 'SCHEDULED',
};
test('care start is hidden until acknowledged and obeys the server window and exclusive end', () => {
  const opens = '2030-01-01T00:45:00Z';
  const visit = parseVisit({ ...json, checkInOpensAt: opens });
  expect(careStartStep(visit, Date.parse(opens))).toBe('none');
  const acknowledged = { ...visit, status: 'ACKNOWLEDGED' };
  expect(careStartStep(acknowledged, Date.parse(opens) - 1)).toBe('waiting');
  expect(careStartStep(acknowledged, Date.parse(opens))).toBe('ready');
  expect(careStartStep(acknowledged, Date.parse(json.checkInClosesAt))).toBe('none');
  expect(careStartStep({ ...acknowledged, endAt: opens }, Date.parse(opens))).toBe('none');
  expect(careStartStep({ ...acknowledged, sessionId: 'session' }, Date.parse(opens))).toBe('none');
  expect(careStartStep({ ...acknowledged, noShowReportedAt: opens }, Date.parse(opens))).toBe(
    'none',
  );
});
test('no-show uses the captured server window and acknowledgment stops exactly at start', () => {
  const visit = parseVisit(json);
  expect(canAcknowledge(visit, Date.parse('2030-01-01T00:59:59Z'))).toBe(true);
  expect(canAcknowledge(visit, Date.parse(json.startAt))).toBe(false);
  expect(canReportNoShow(visit, Date.parse('2030-01-01T00:59:59Z'))).toBe(false);
  expect(canReportNoShow(visit, Date.parse(json.startAt))).toBe(true);
  expect(canReportNoShow(visit, Date.parse(json.checkInClosesAt))).toBe(false);
  const pending = parseVisit({
    ...json,
    noShowReportedAt: json.startAt,
    noShowNote: 'Customer did not answer',
  });
  expect(pending.noShowNote).toBe('Customer did not answer');
  expect(canAcknowledge(pending, Date.parse('2030-01-01T00:59:59Z'))).toBe(false);
  expect(canReportNoShow(pending, Date.parse('2030-01-01T01:01:00Z'))).toBe(false);
});
test('no-show sends the trimmed note and prevents out-of-contract writes', async () => {
  const request = jest.fn(async (_method: string, _path: string, _body?: unknown) => ({
    ...json,
    noShowReportedAt: json.startAt,
  }));
  const repo = new VisitRepository({ request });
  await expect(repo.reportNoShow('v', 'short')).rejects.toThrow();
  await expect(repo.reportNoShow('v', 'x'.repeat(1001))).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  expect((await repo.reportNoShow('v', '  Customer did not answer  ')).noShowReportedAt).toBe(
    json.startAt,
  );
  expect(request).toHaveBeenCalledWith('POST', '/booking-occurrences/v/no-show-reports', {
    note: 'Customer did not answer',
  });
});
test('caregiver action errors distinguish unpaid, reassignment and no-show deadlines', () => {
  expect(visitErrorKey(new ApiError(409, 5242))).toBe('visitUnpaid');
  expect(visitErrorKey(new ApiError(409, 5234))).toBe('visitReassignment');
  expect(visitErrorKey(new ApiError(409, 5817))).toBe('noShowWindowClosed');
});
test('malformed successful acknowledgment is uncertain and cannot be treated as safe to repeat', async () => {
  const request = jest.fn(async () => ({ ...json, startAt: 'invalid-time' }));
  await expect(new VisitRepository({ request }).acknowledge('v')).rejects.toMatchObject({
    uncertain: true,
  });
});
test('today focus scans beyond the first page and prioritizes a session already in progress', async () => {
  const request = jest.fn(
    async (
      _method: string,
      _path: string,
      _body?: unknown,
      query?: Record<string, string | number | undefined>,
    ) => ({
      items:
        query?.page === 0
          ? [{ ...json, id: 'future', startAt: '2030-01-01T02:00:00Z' }]
          : [{ ...json, id: 'active', status: 'IN_PROGRESS', sessionId: 'session' }],
      page: query?.page,
      totalPages: 2,
      totalElements: 2,
    }),
  );
  const repo = new VisitRepository({ request });
  expect((await repo.nextToday(new Date('2030-01-01T01:05:00Z')))?.id).toBe('active');
  expect(request.mock.calls.map((call) => call[3]?.page)).toEqual([0, 1]);
});
test('today focus excludes missed windows and pending no-show reports instead of inventing an actionable visit', async () => {
  const request = jest.fn(async () => ({
    items: [
      { ...json, id: 'late' },
      { ...json, id: 'absent', startAt: '2030-01-01T02:00:00Z', noShowReportedAt: json.startAt },
      {
        ...json,
        id: 'later',
        startAt: '2030-01-01T03:00:00Z',
        endAt: '2030-01-01T05:00:00Z',
        checkInClosesAt: '2030-01-01T03:20:00Z',
      },
    ],
    page: 0,
    totalPages: 1,
    totalElements: 3,
  }));
  expect(
    (await new VisitRepository({ request }).nextToday(new Date('2030-01-01T01:15:00Z')))?.id,
  ).toBe('later');
});
