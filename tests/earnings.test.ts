import { expect, jest, test } from '@jest/globals';
import { depositRange } from '../src/features/earnings/models';
import { KeptDepositRepository } from '../src/features/earnings/repository';

test('deposit periods use Vietnam month/year boundaries when UTC is still the previous day', () => {
  const now = new Date('2026-12-31T18:00:00Z');
  expect(depositRange('month', now)).toEqual({
    from: '2026-12-31T17:00:00.000Z',
    to: '2026-12-31T18:00:00.000Z',
  });
  expect(depositRange('year', now).from).toBe('2026-12-31T17:00:00.000Z');
  expect(depositRange('last30', now).from).toBe('2026-12-01T18:00:00.000Z');
});
test('ledger preserves server caregiver summary and pagination independently of the current rows', async () => {
  const calls: unknown[] = [];
  const request = jest.fn(
    async (_method: string, path: string, _body?: unknown, query?: Record<string, unknown>) => {
      calls.push([path, query]);
      return path.endsWith('/summary')
        ? { caregiverAmount: 90000, centerAmount: 0, totalAmount: 90000 }
        : {
            items: [
              {
                id: 'row',
                occurrenceId: 'visit',
                occurrenceStartAt: '2030-01-01T01:00:00Z',
                createdAt: '2029-12-31T20:00:00Z',
                amount: 30000,
                beneficiary: 'CAREGIVER',
                reason: 'CUSTOMER_CANCEL',
              },
            ],
            page: 1,
            totalPages: 3,
            totalElements: 5,
          };
    },
  );
  const repo = new KeptDepositRepository({ request });
  const range = { from: '2029-12-31T17:00:00Z', to: '2030-01-31T17:00:00Z' };
  expect((await repo.summary(range)).caregiverAmount).toBe(90000);
  expect((await repo.list(range, 1)).totalElements).toBe(5);
  expect(calls).toEqual([
    ['/deposit-forfeitures/summary', range],
    ['/deposit-forfeitures', { ...range, page: 1, size: 20 }],
  ]);
});
