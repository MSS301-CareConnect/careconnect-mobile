import { expect, jest, test } from '@jest/globals';
import { ApiError } from '../src/core/api';
import { BookingRequestRepository } from '../src/features/booking-requests/repository';
import { canAnswerRequest, parseBookingRequest } from '../src/features/booking-requests/models';

const record = {
  id: 'request',
  bookingCode: 'BK-123',
  status: 'PENDING_CAREGIVER_CONFIRMATION',
  bookingType: 'RECURRING',
  acceptanceDueAt: '2030-01-02T01:00:00Z',
  ward: 'Ward',
  district: 'District',
  province: 'Province',
  recipientAge: 72,
  recipientGender: 'FEMALE',
  totalAmount: 240000,
  services: [{ serviceName: 'Care' }],
  occurrences: [{ id: 'visit', startAt: '2030-01-04T01:00:00Z', endAt: '2030-01-04T03:00:00Z' }],
};
test('request parsing keeps the privacy-limited preview and uses the exclusive server deadline', () => {
  const request = parseBookingRequest({
    ...record,
    recipientSnapshot: { fullName: 'Hidden' },
    customerPhone: 'Hidden',
  });
  expect(request).not.toHaveProperty('recipientSnapshot');
  expect(request).not.toHaveProperty('customerPhone');
  expect(request.occurrences[0]?.id).toBe('visit');
  expect(canAnswerRequest(request, Date.parse('2030-01-02T00:59:59Z'))).toBe(true);
  expect(canAnswerRequest(request, Date.parse('2030-01-02T01:00:00Z'))).toBe(false);
});
test('request decisions preserve backend states and send no invented version', async () => {
  const request = jest.fn(async (method: string, path: string, body?: unknown) => {
    if (method === 'GET') return { items: [record], page: 2, totalPages: 4, totalElements: 62 };
    if (path.endsWith('caregiver-decline')) {
      expect(body).toEqual({ reason: 'Family commitment' });
      return { ...record, status: 'PENDING_CAREGIVER_ASSIGNMENT' };
    }
    expect(body).toBeUndefined();
    return { ...record, status: 'AWAITING_INITIAL_PAYMENT' };
  });
  const repo = new BookingRequestRepository({ request });
  expect((await repo.list(2, 20)).totalElements).toBe(62);
  expect((await repo.accept('request')).status).toBe('AWAITING_INITIAL_PAYMENT');
  expect((await repo.decline('request', '  Family commitment  ')).status).toBe(
    'PENDING_CAREGIVER_ASSIGNMENT',
  );
  expect(request.mock.calls.map(([method, path]) => [method, path])).toEqual([
    ['GET', '/bookings/caregiver-requests'],
    ['POST', '/bookings/request/caregiver-accept'],
    ['POST', '/bookings/request/caregiver-decline'],
  ]);
});
test('malformed successful request decisions are uncertain and invalid decline text makes no write', async () => {
  const request = jest.fn(async () => ({}));
  const repo = new BookingRequestRepository({ request });
  await expect(repo.decline('request', '  ')).rejects.toThrow();
  await expect(repo.decline('request', 'x'.repeat(1001))).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  await expect(repo.accept('request')).rejects.toMatchObject({ uncertain: true });
  expect(request).toHaveBeenCalledTimes(1);
  expect(new ApiError(409, 5116)).toBeInstanceOf(ApiError);
});
test('an accept response in a decline state cannot be presented as successful acceptance', async () => {
  const request = jest.fn(async () => ({ ...record, status: 'REJECTED' }));
  await expect(new BookingRequestRepository({ request }).accept('request')).rejects.toMatchObject({
    uncertain: true,
  });
});
test('uncertain request reconciliation scans every pending page without booking-detail access', async () => {
  const paths: string[] = [];
  const request = jest.fn(
    async (_method: string, path: string, _body?: unknown, query?: Record<string, unknown>) => {
      paths.push(path);
      return {
        items: query?.page === 2 ? [record] : [],
        page: query?.page,
        totalPages: 3,
        totalElements: 41,
      };
    },
  );
  const repo = new BookingRequestRepository({ request });
  expect((await repo.findPending('request'))?.id).toBe('request');
  expect(paths).toEqual(Array(3).fill('/bookings/caregiver-requests'));
});
