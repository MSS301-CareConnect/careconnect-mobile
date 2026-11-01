import { expect, jest, test } from '@jest/globals';
import { ApiClient, ApiError } from '../src/core/api';
import {
  parseRegistration,
  parseWorkShift,
  registrationBlockReason,
} from '../src/features/work-shifts/models';
import { WorkShiftRepository } from '../src/features/work-shifts/repository';

const shift = {
  id: 'shift',
  centerId: 'center',
  centerName: 'Test center',
  workDate: '2026-11-03',
  startTime: '13:00:00',
  endTime: '17:00:00',
  shiftType: 'TEST',
  shiftStatus: 'OPEN',
  capacity: 2,
  approvedCount: 1,
  version: 4,
  registrationDeadline: '2026-11-03T05:00:00Z',
};
const registration = {
  id: 'registration',
  workShiftId: 'shift',
  registrationStatus: 'PENDING',
  version: 7,
  caregiverNote: 'Test note',
  rejectionReason: '',
};
const page = (items: unknown[], p = 0, totalPages = 1) => ({
  items,
  page: p,
  totalPages,
  totalElements: items.length,
});

test('registration gates use Vietnam time and exact exclusive start/deadline boundaries', () => {
  const s = parseWorkShift(shift);
  expect(
    registrationBlockReason(s, undefined, true, Date.parse('2026-11-03T04:59:59Z')),
  ).toBeUndefined();
  expect(registrationBlockReason(s, undefined, true, Date.parse('2026-11-03T05:00:00Z'))).toBe(
    'workShiftDeadlinePassed',
  );
  expect(
    registrationBlockReason(
      { ...s, registrationDeadline: '' },
      undefined,
      true,
      Date.parse('2026-11-03T05:59:59Z'),
    ),
  ).toBeUndefined();
  expect(
    registrationBlockReason(
      { ...s, registrationDeadline: '' },
      undefined,
      true,
      Date.parse('2026-11-03T06:00:00Z'),
    ),
  ).toBe('workShiftStarted');
  expect(registrationBlockReason({ ...s, approvedCount: 2 }, undefined, true, 0)).toBe(
    'workShiftFull',
  );
  expect(registrationBlockReason(s, undefined, false, 0)).toBe('workShiftEligibility');
  expect(registrationBlockReason(s, parseRegistration(registration), true, 0)).toBe(
    'workShiftAlreadyRegistered',
  );
  expect(
    registrationBlockReason(
      s,
      parseRegistration({ ...registration, registrationStatus: 'CANCELLED' }),
      true,
      0,
    ),
  ).toBeUndefined();
});

test('boundary rejects missing/invalid optimistic versions and preserves backend states', () => {
  expect(() => parseRegistration({ ...registration, version: undefined })).toThrow();
  expect(() => parseRegistration({ ...registration, version: -1 })).toThrow();
  expect(() => parseWorkShift({ ...shift, capacity: '2' })).toThrow();
  expect(
    parseRegistration({
      ...registration,
      registrationStatus: 'REJECTED',
      rejectionReason: 'Server reason',
    }).rejectionReason,
  ).toBe('Server reason');
});

test('detail finds an active registration beyond the first page instead of enabling a duplicate', async () => {
  const request = jest.fn<Pick<ApiClient, 'request'>['request']>();
  request.mockImplementation(async (_method, path, _body, query) => {
    if (path === '/work-shifts/shift') return shift;
    if (path === '/caregivers/me')
      return { caregiverStatus: 'ACTIVE', verificationStatus: 'VERIFIED' };
    return query?.page === 0
      ? page([{ ...registration, registrationStatus: 'CANCELLED' }], 0, 2)
      : page([registration], 1, 2);
  });
  const result = await new WorkShiftRepository({ request }).detail('shift');
  expect(result.registration?.status).toBe('PENDING');
  expect(result.registration?.version).toBe(7);
  expect(result.eligible).toBe(true);
  expect(request).toHaveBeenCalledWith('GET', '/work-shifts/registrations/me', undefined, {
    page: 1,
    size: 100,
  });
});

test('register/cancel use the authoritative paths, note limit, PENDING state and query version', async () => {
  const request = jest.fn<Pick<ApiClient, 'request'>['request']>().mockResolvedValue(registration);
  const repo = new WorkShiftRepository({ request });
  await repo.register('shift', ' Test note ');
  expect(request).toHaveBeenLastCalledWith('POST', '/work-shifts/shift/registrations', {
    caregiverNote: 'Test note',
  });
  await repo.cancel(parseRegistration(registration));
  expect(request).toHaveBeenLastCalledWith(
    'DELETE',
    '/work-shifts/registrations/registration',
    undefined,
    { version: 7 },
  );
  const writes = request.mock.calls.length;
  await expect(
    repo.cancel(parseRegistration({ ...registration, registrationStatus: 'APPROVED' })),
  ).rejects.toThrow();
  await expect(repo.register('shift', 'x'.repeat(2001))).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(writes);
});

test('open shifts use server scope without broken optional date predicates; unavailable historical shifts do not hide registrations', async () => {
  const request = jest.fn<Pick<ApiClient, 'request'>['request']>();
  request.mockImplementation(async (_method, path, _body, query) => {
    if (path === '/work-shifts' && (query?.fromDate !== undefined || query?.toDate !== undefined))
      throw new ApiError(503, 4004);
    if (path === '/work-shifts/registrations/me') return page([registration]);
    if (path === '/work-shifts/shift') throw new Error('Not readable');
    return page([shift]);
  });
  const repo = new WorkShiftRepository({ request });
  await repo.open(2);
  expect(request).toHaveBeenCalledWith('GET', '/work-shifts', undefined, {
    status: 'OPEN',
    page: 2,
    size: 20,
  });
  const mine = await repo.mine(0);
  expect(mine.items[0]?.registration.id).toBe('registration');
  expect(mine.items[0]?.shift).toBeUndefined();
});

test('a successful write with an unreadable registration response requires reconciliation', async () => {
  const request = jest
    .fn<Pick<ApiClient, 'request'>['request']>()
    .mockResolvedValue({ id: 'created' });
  const repo = new WorkShiftRepository({ request });
  await expect(repo.register('shift', 'Keep note')).rejects.toMatchObject({
    status: 0,
    uncertain: true,
  });
  expect(request).toHaveBeenCalledTimes(1);
  request.mockRejectedValue(new ApiError(409, 4351));
  await expect(repo.register('shift', 'Keep note')).rejects.toMatchObject({
    status: 409,
    code: 4351,
    uncertain: false,
  });
});

test('pending cancellation remains available when its shift is deleted or no longer readable', async () => {
  const request = jest.fn<Pick<ApiClient, 'request'>['request']>();
  request.mockImplementation(async (method, path) => {
    if (path === '/work-shifts/shift') throw new ApiError(404, 4300);
    if (path === '/caregivers/me')
      return { caregiverStatus: 'INACTIVE', verificationStatus: 'VERIFIED' };
    if (method === 'DELETE') return undefined;
    return page([registration]);
  });
  const repo = new WorkShiftRepository({ request });
  const detail = await repo.detail('shift');
  expect(detail.shift).toBeUndefined();
  expect(detail.registration?.status).toBe('PENDING');
  if (!detail.registration) throw new Error('Missing own registration');
  await repo.cancel(detail.registration);
  expect(request).toHaveBeenLastCalledWith(
    'DELETE',
    '/work-shifts/registrations/registration',
    undefined,
    { version: 7 },
  );
});

test('the work board finds new shifts after past OPEN pages and active registrations after page one', async () => {
  const request = jest.fn<Pick<ApiClient, 'request'>['request']>();
  request.mockImplementation(async (_method, path, _body, query) => {
    if (path === '/caregivers/me')
      return {
        centerName: 'Test center',
        caregiverStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      };
    if (path === '/work-shifts') {
      expect(query?.fromDate).toBeUndefined();
      return query?.page === 0
        ? page([{ ...shift, id: 'past', workDate: '2026-10-31' }], 0, 2)
        : page(
            [
              { ...shift, id: 'new', endTime: '17:04:00' },
              { ...shift, id: 'registered', workDate: '2026-11-02' },
            ],
            1,
            2,
          );
    }
    return query?.page === 0
      ? page([], 0, 2)
      : page(
          [{ ...registration, workShiftId: 'registered', registrationStatus: 'APPROVED' }],
          1,
          2,
        );
  });
  const board = await new WorkShiftRepository({ request }).board(
    Date.parse('2026-11-01T07:00:00Z'),
  );
  expect(board.centerName).toBe('Test center');
  expect(board.items.map((item) => item.shift.id)).toEqual(['registered', 'new']);
  expect(board.items[0]?.registration?.status).toBe('APPROVED');
  expect(board.items[1]?.shift.endTime).toBe('17:04:00');
  expect(board.items[1]?.registration).toBeUndefined();
});
