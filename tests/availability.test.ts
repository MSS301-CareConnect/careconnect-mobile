import { expect, jest, test } from '@jest/globals';
import { ApiClient } from '../src/core/api';
import { ProfileRepository } from '../src/features/profile/repository';
import { canCancelSchedule, parseSchedule } from '../src/features/profile/schedule';

const slot = {
  id: 'slot',
  workDate: '2026-11-02',
  startTime: '13:00:00',
  endTime: '17:00:00',
  scheduleStatus: 'SCHEDULED',
  note: 'Server note',
  cancellationReason: null,
  version: 7,
};

test('schedule reads retain the optimistic version and server cancellation reason', async () => {
  const request = jest.fn<ApiClient['request']>(async () => ({
    items: [{ ...slot, scheduleStatus: 'CANCELLED', cancellationReason: 'Server reason' }],
    page: 0,
    totalPages: 1,
    totalElements: 1,
  }));
  const result = await new ProfileRepository({ request }).schedules();
  expect(result.items[0]).toMatchObject({ version: 7, cancellationReason: 'Server reason' });
});

test.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'schedule parsing rejects unsafe optimistic version %s',
  (version) => expect(() => parseSchedule({ ...slot, version })).toThrow(),
);

test.each([
  { workDate: '2026-02-30' },
  { startTime: '25:00:00' },
  { endTime: '17:70:00' },
  { scheduleStatus: '' },
])('schedule parsing rejects malformed calendar or state fields %s', (change) => {
  expect(() => parseSchedule({ ...slot, ...change })).toThrow();
});

test('availability end boundary uses Vietnam time and unknown states cannot be cancelled', () => {
  const parsed = parseSchedule(slot);
  expect(canCancelSchedule(parsed, Date.parse('2026-11-02T09:59:59Z'))).toBe(true);
  expect(canCancelSchedule(parsed, Date.parse('2026-11-02T10:00:00Z'))).toBe(false);
  expect(
    canCancelSchedule(parseSchedule({ ...slot, scheduleStatus: 'NEW_SERVER_STATE' }), 0),
  ).toBe(false);
});

test('schedule cancellation sends the trimmed required reason, target status and current version', async () => {
  const request = jest.fn<ApiClient['request']>(async () => ({
    ...slot,
    scheduleStatus: 'CANCELLED',
    cancellationReason: 'Personal schedule change',
    version: 8,
  }));
  const result = await new ProfileRepository({ request }).cancelSchedule(
    parseSchedule(slot),
    '  Personal schedule change  ',
  );
  expect(request).toHaveBeenCalledWith('PATCH', '/caregivers/schedules/slot/status', {
    status: 'CANCELLED',
    reason: 'Personal schedule change',
    version: 7,
  });
  expect(result).toMatchObject({ status: 'CANCELLED', version: 8 });
});

test.each(['', '  \n ', 'a'.repeat(501)])(
  'invalid cancellation reason is rejected before any request',
  async (reason) => {
    const request = jest.fn<ApiClient['request']>();
    await expect(
      new ProfileRepository({ request }).cancelSchedule(parseSchedule(slot), reason),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  },
);

test.each([
  { id: 'slot' },
  { ...slot, scheduleStatus: 'CANCELLED', version: undefined },
  { ...slot, id: 'different', scheduleStatus: 'CANCELLED' },
  slot,
])('unreadable or inconsistent cancellation responses require reconciliation', async (response) => {
  const request = jest.fn<ApiClient['request']>(async () => response);
  await expect(
    new ProfileRepository({ request }).cancelSchedule(parseSchedule(slot), 'Required reason'),
  ).rejects.toMatchObject({ uncertain: true, status: 0 });
});
