import { number, object, required, text } from '../../core/json';
export type DepositPeriod = 'month' | 'last30' | 'year';
export type DepositRange = { from: string; to: string };
export type KeptDeposit = {
  id: string;
  occurrenceId: string;
  occurrenceStartAt: string;
  createdAt: string;
  amount: number;
  reason: string;
};
function amount(value: unknown) {
  const parsed = number(value);
  if (parsed === undefined || parsed < 0) throw new Error('Invalid deposit amount');
  return parsed;
}
export function parseKeptDeposit(value: unknown): KeptDeposit {
  const j = object(value);
  return {
    id: required(j.id),
    occurrenceId: text(j.occurrenceId),
    occurrenceStartAt: required(j.occurrenceStartAt),
    createdAt: required(j.createdAt),
    amount: amount(j.amount),
    reason: text(j.reason),
  };
}
export function parseDepositSummary(value: unknown) {
  const j = object(value);
  return { caregiverAmount: amount(j.caregiverAmount) };
}
// Filters apply to ledger creation time. Booking occurrence timestamps remain Instants.
export function depositRange(period: DepositPeriod, now = new Date()): DepositRange {
  const vietnam = new Date(now.getTime() + 7 * 3600000);
  const from =
    period === 'last30'
      ? now.getTime() - 30 * 86400000
      : Date.UTC(vietnam.getUTCFullYear(), period === 'month' ? vietnam.getUTCMonth() : 0, 1) -
        7 * 3600000;
  return { from: new Date(from).toISOString(), to: now.toISOString() };
}
