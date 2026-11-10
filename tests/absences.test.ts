import { expect, jest, test } from '@jest/globals';
import { checkExplanation, parseAbsence } from '../src/features/absences/models';
import { AbsenceRepository } from '../src/features/absences/repository';
import { notificationTarget } from '../src/features/notifications/feed';

const record = {
  id: 'a1',
  bookingId: 'b1',
  bookingCode: 'BK0001',
  occurrenceId: 'o1',
  occurrenceNo: 2,
  startAt: '2026-11-10T01:00:00Z',
  endAt: '2026-11-10T03:00:00Z',
  source: 'MISSED_CHECK_IN',
  status: 'PENDING',
};

test('absences parse the BookingService record and refuse unknown states', () => {
  expect(parseAbsence(record)).toMatchObject({ id: 'a1', occurrenceNo: 2, explanation: '' });
  expect(() => parseAbsence({ ...record, status: 'CLOSED' })).toThrow('Unknown absence status');
  expect(() => parseAbsence({ ...record, source: 'GUESS' })).toThrow('Unknown absence source');
});

test('explanations need 10 to 1000 characters after trimming, like the API', () => {
  // 9 characters once trimmed; 10 is enough.
  expect(checkExplanation('   bị ốm nặn ')).toEqual({ error: 'absenceExplanationShort' });
  expect(checkExplanation(' bị ốm nặng ')).toEqual({ text: 'bị ốm nặng' });
  expect(checkExplanation('  xe hỏng giữa đường  ')).toEqual({ text: 'xe hỏng giữa đường' });
  expect(checkExplanation('x'.repeat(1001))).toEqual({ error: 'absenceExplanationLong' });
});

test('the repository lists only pending absences when asked and posts the explanation', async () => {
  const request = jest.fn(async (method: string) =>
    method === 'GET'
      ? { items: [record], page: 0, totalPages: 1, totalElements: 1 }
      : { ...record, explanation: 'Xe hỏng giữa đường' },
  );
  const repo = new AbsenceRepository({ request });
  await repo.list('PENDING');
  await repo.list(undefined, 1);
  const saved = await repo.explain('a1', 'Xe hỏng giữa đường');
  expect(request.mock.calls).toEqual([
    ['GET', '/caregiver-absences', undefined, { status: 'PENDING', page: 0, size: 20 }],
    ['GET', '/caregiver-absences', undefined, { page: 1, size: 20 }],
    ['POST', '/caregiver-absences/a1/explanation', { explanation: 'Xe hỏng giữa đường' }],
  ]);
  expect(saved.explanation).toBe('Xe hỏng giữa đường');
});

test('an absence notification opens the absence list, not the missed visit', () => {
  expect(
    notificationTarget({
      type: 'CAREGIVER_ABSENCE_UPDATED',
      refType: 'BOOKING_OCCURRENCE',
      refId: 'f3b57ad4-87ae-4faa-a058-b0aa92ce5e98',
    }),
  ).toEqual({ screen: 'Absences' });
});
