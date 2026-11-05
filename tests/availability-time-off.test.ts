import { expect, jest, test } from '@jest/globals';
import { ApiClient, ApiError } from '../src/core/api';
import { AvailabilityRepository } from '../src/features/availability/repository';
import { parseTimeOff, timeOffInput, timeOffRange } from '../src/features/availability/time-off';

const record = {
  id: 'off',
  caregiverId: 'caregiver',
  startAt: '2026-11-04T17:00:00Z',
  endAt: '2026-11-06T17:00:00Z',
  reason: 'Personal reason',
  version: 3,
};

test('whole-day time off includes the last selected Vietnam day and excludes following midnight', () => {
  expect(
    timeOffInput({
      startDate: '2026-11-05',
      endDate: '2026-11-06',
      allDay: true,
      startTime: '',
      endTime: '',
      reason: '  Personal reason  ',
    }),
  ).toEqual({
    startAt: '2026-11-04T17:00:00.000Z',
    endAt: '2026-11-06T17:00:00.000Z',
    reason: 'Personal reason',
  });
  expect(timeOffRange(parseTimeOff(record))).toEqual({
    startDay: '2026-11-05',
    endDay: '2026-11-06',
    allDay: true,
  });
});

test.each([
  { startDate: '2026-02-30', endDate: '2026-03-01', allDay: true },
  { startDate: '2026-11-05', endDate: '2026-11-04', allDay: true },
  { startDate: '2026-11-01', endDate: '2026-12-01', allDay: true },
  {
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    allDay: false,
    startTime: '13:00',
    endTime: '13:00',
  },
  {
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    allDay: false,
    startTime: '24:00',
    endTime: '17:00',
  },
])('invalid time-off ranges fail before a write: %s', (input) => {
  expect(() => timeOffInput({ startTime: '', endTime: '', reason: '', ...input })).toThrow();
});

test('time-off creation permits exactly 30 days and rejects long reasons without truncation', async () => {
  const request = jest.fn<ApiClient['request']>(async () => record);
  const repo = new AvailabilityRepository({ request });
  const input = {
    startAt: '2026-11-01T00:00:00Z',
    endAt: '2026-12-01T00:00:00Z',
    reason: '  My reason  ',
  };
  await repo.createTimeOff('caregiver', input);
  expect(request).toHaveBeenCalledWith('POST', '/caregivers/caregiver/time-offs', {
    ...input,
    reason: 'My reason',
  });
  await expect(
    repo.createTimeOff('caregiver', { ...input, reason: 'x'.repeat(501) }),
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});

test('unknown time-off create result is uncertain and booked-visit refusal remains a server conflict', async () => {
  const request = jest.fn<ApiClient['request']>(async () => ({ id: 'created' }));
  const repo = new AvailabilityRepository({ request });
  const input = { startAt: record.startAt, endAt: record.endAt, reason: 'Keep reason' };
  await expect(repo.createTimeOff('caregiver', input)).rejects.toMatchObject({ uncertain: true });
  request.mockRejectedValue(new ApiError(409, 4408));
  await expect(repo.createTimeOff('caregiver', input)).rejects.toMatchObject({ code: 4408 });
  expect(request).toHaveBeenCalledTimes(2);
});

test('time-off own list uses Instant bounds and deletion uses no invented version', async () => {
  const request = jest.fn<ApiClient['request']>(async () => [record]);
  const repo = new AvailabilityRepository({ request });
  expect((await repo.timeOffs('caregiver', record.startAt, record.endAt))[0]?.reason).toBe(
    'Personal reason',
  );
  expect(request).toHaveBeenCalledWith('GET', '/caregivers/caregiver/time-offs', undefined, {
    from: record.startAt,
    to: record.endAt,
  });
  await repo.deleteTimeOff('caregiver', 'off');
  expect(request).toHaveBeenLastCalledWith('DELETE', '/caregivers/caregiver/time-offs/off');
});

test('linked schedule lookup reads beyond the first page and preserves its current server version', async () => {
  const request = jest.fn<ApiClient['request']>(async (_method, _path, _body, query) => ({
    items: [
      {
        id: query?.page === 0 ? 'other' : 'linked',
        workDate: '2026-11-06',
        startTime: '08:00',
        endTime: '12:00',
        scheduleStatus: 'SCHEDULED',
        version: query?.page === 0 ? 2 : 19,
      },
    ],
    page: query?.page,
    totalPages: 2,
    totalElements: 2,
  }));
  const schedule = await new AvailabilityRepository({ request }).findSchedule('linked');
  expect(schedule).toMatchObject({ id: 'linked', version: 19 });
  expect(request).toHaveBeenLastCalledWith('GET', '/caregivers/me/schedules', undefined, {
    page: 1,
    size: 100,
  });
});

test('agenda loads every schedule and visit page instead of truncating at a fixed page cap', async () => {
  const request = jest.fn<ApiClient['request']>(async (_method, path, _body, query) => {
    if (path === '/caregivers/me') return { id: 'caregiver' };
    if (path.includes('/time-offs')) return [record];
    const p = Number(query?.page);
    return {
      items:
        p === 5
          ? [
              path.includes('schedules')
                ? {
                    id: 'sixth-slot',
                    workDate: '2026-11-06',
                    startTime: '08:00',
                    endTime: '12:00',
                    scheduleStatus: 'SCHEDULED',
                    version: 2,
                  }
                : {
                    id: 'sixth-visit',
                    bookingId: 'booking',
                    startAt: '2026-11-06T01:00:00Z',
                    endAt: '2026-11-06T05:00:00Z',
                    status: 'ACKNOWLEDGED',
                  },
            ]
          : [],
      page: p,
      totalPages: 6,
      totalElements: 1,
    };
  });
  const result = await new AvailabilityRepository({ request }).agenda('2026-11-02', '2026-11-08');
  expect(result.schedules.map((item) => item.id)).toEqual(['sixth-slot']);
  expect(result.visits.map((item) => item.id)).toEqual(['sixth-visit']);
  expect(request).toHaveBeenCalledWith('GET', '/caregivers/caregiver/time-offs', undefined, {
    from: '2026-11-01T17:00:00.000Z',
    to: '2026-11-08T17:00:00.000Z',
  });
});
