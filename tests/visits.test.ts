import { expect, jest, test } from '@jest/globals';
import { groupVisitsByBooking, parseVisit } from '../src/features/visits/models';
import { VisitRepository } from '../src/features/visits/repository';
import {
  canAcknowledge,
  canReportNoShow,
  canWithdraw,
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
test('care start obeys the server window and exclusive end; a visit not accepted in time starts directly', () => {
  const opens = '2030-01-01T00:45:00Z';
  const visit = parseVisit({ ...json, checkInOpensAt: opens });
  // Before the window a SCHEDULED visit is accepted first; inside it, checking in accepts it (2026-11-11).
  expect(careStartStep(visit, Date.parse(opens) - 1)).toBe('none');
  expect(careStartStep(visit, Date.parse(opens))).toBe('ready');
  expect(careStartStep(visit, Date.parse(json.checkInClosesAt))).toBe('none');
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
test('no-show uses the captured server window and acknowledgment gives way to start when the window opens', () => {
  const visit = parseVisit(json);
  // No captured opening: 30 minutes before the start.
  expect(canAcknowledge(visit, Date.parse('2030-01-01T00:29:59Z'))).toBe(true);
  expect(canAcknowledge(visit, Date.parse('2030-01-01T00:30:00Z'))).toBe(false);
  expect(canReportNoShow(visit, Date.parse('2030-01-01T00:59:59Z'))).toBe(false);
  expect(canReportNoShow(visit, Date.parse(json.startAt))).toBe(true);
  expect(canReportNoShow(visit, Date.parse(json.checkInClosesAt))).toBe(false);
  const pending = parseVisit({
    ...json,
    noShowReportedAt: json.startAt,
    noShowNote: 'Customer did not answer',
  });
  expect(pending.noShowNote).toBe('Customer did not answer');
  expect(canAcknowledge(pending, Date.parse('2030-01-01T00:29:59Z'))).toBe(false);
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
test('visits of one booking are grouped in list order and keep the reassignment flag', () => {
  const visits = [
    parseVisit({ ...json, id: 'a', bookingCode: 'BK1', recipientName: 'Lan' }),
    parseVisit({ ...json, id: 'b', bookingId: 'other', bookingCode: 'BK2' }),
    parseVisit({ ...json, id: 'c', needsReassignment: true }),
  ];
  const groups = groupVisitsByBooking(visits);
  expect(groups.map((group) => group.bookingId)).toEqual(['b', 'other']);
  expect(groups[0]?.visits.map((visit) => visit.id)).toEqual(['a', 'c']);
  expect(groups[0]?.name).toBe('Lan');
  expect(visits[2]?.needsReassignment).toBe(true);
  expect(visits[0]?.needsReassignment).toBe(false);
});
test('a visit can be withdrawn only when it starts more than 24 hours later and is not being replaced', () => {
  const visit = parseVisit(json);
  const start = Date.parse(json.startAt);
  expect(canWithdraw(visit, start - 24 * 3600000 - 1)).toBe(true);
  expect(canWithdraw(visit, start - 24 * 3600000)).toBe(false);
  expect(canWithdraw({ ...visit, needsReassignment: true }, 0)).toBe(false);
  expect(canWithdraw({ ...visit, status: 'IN_PROGRESS' }, 0)).toBe(false);
  expect(visitErrorKey(new ApiError(409, 5260))).toBe('withdrawTooLate');
  expect(visitErrorKey(new ApiError(409, 5261))).toBe('withdrawAlready');
});
test('withdrawal sends the visits and reason, validates OTHER and treats a malformed success as uncertain', async () => {
  const request = jest.fn(async (_method: string, _path: string, body?: unknown) => {
    const ids = (body as { occurrenceIds: string[] }).occurrenceIds;
    return ids.map((id) => ({ id: 'w-' + id }));
  });
  const repo = new VisitRepository({ request });
  await expect(repo.withdraw(['v'], 'OTHER', '   ')).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  expect(await repo.withdraw(['v', 'x'], 'OTHER', '  Con ốm ')).toBe(2);
  expect(request).toHaveBeenCalledWith('POST', '/caregiver-withdrawals', {
    occurrenceIds: ['v', 'x'],
    reasonCode: 'OTHER',
    reasonDetail: 'Con ốm',
  });
  await repo.withdraw(['v'], 'PERSONAL', '');
  expect(request).toHaveBeenLastCalledWith('POST', '/caregiver-withdrawals', {
    occurrenceIds: ['v'],
    reasonCode: 'PERSONAL',
    reasonDetail: undefined,
  });
  const malformed = new VisitRepository({ request: jest.fn(async () => ({})) });
  await expect(malformed.withdraw(['v'], 'PERSONAL', '')).rejects.toMatchObject({
    uncertain: true,
  });
});
test('booking visits read every page of one booking and sort by start', async () => {
  const request = jest.fn(
    async (_method: string, _path: string, _body?: unknown, query?: unknown) => {
      const p = (query as { page: number }).page;
      return {
        items: [{ ...json, id: 'p' + p, startAt: p ? '2030-01-01T00:00:00Z' : json.startAt }],
        page: p,
        totalPages: 2,
        totalElements: 2,
      };
    },
  );
  const visits = await new VisitRepository({ request }).bookingVisits('b');
  expect(visits.map((visit) => visit.id)).toEqual(['p1', 'p0']);
  expect(request).toHaveBeenCalledWith('GET', '/booking-occurrences', undefined, {
    bookingId: 'b',
    page: 0,
    size: 100,
  });
});
