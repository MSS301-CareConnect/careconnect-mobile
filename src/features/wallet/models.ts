import { array, number, object, required, text } from '../../core/json';

// PaymentService wallet contract (2026-11-09): the caregiver wallet holds deposits customers lost on the caregiver's
// visits; withdrawals are held until an admin transfers them by hand.
export type WalletTransactionType =
  | 'REFUND_CREDIT'
  | 'FORFEIT_CREDIT'
  | 'SERVICE_SETTLEMENT'
  | 'COMMISSION_CREDIT'
  | 'COMPLAINT_DEBIT'
  | 'WITHDRAWAL_HOLD'
  | 'WITHDRAWAL_RELEASE'
  | 'WITHDRAWAL_PAID';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type WalletPeriod = 'month' | 'last30' | 'year';
export type WalletRange = { from: string; to: string; groupBy: 'DAY' | 'MONTH' };
export type Wallet = { availableBalance: number; heldBalance: number; withdrawable: boolean };
export type WalletCenterBalance = {
  centerId: string | null;
  availableBalance: number;
  name: string;
};
export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  amount: number;
  availableBefore: number;
  availableAfter: number;
  heldBefore: number;
  heldAfter: number;
  createdAt: string;
};
export type WalletWithdrawal = {
  id: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
  status: WithdrawalStatus;
  rejectReason: string;
  transferReference: string;
  createdAt: string;
};
export type WalletSeriesPoint = { period: string; income: number; withdrawn: number };
export type WalletStatistics = {
  forfeitIncome: number;
  totalWithdrawn: number;
  bookingCount: number;
  series: WalletSeriesPoint[];
};
export type WithdrawalForm = {
  amount: string;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
};
export type WithdrawalInput = {
  centerId?: string | null;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
};
export type WithdrawalErrors = Partial<Record<keyof WithdrawalForm, string>>;

const TRANSACTION_TYPES: readonly WalletTransactionType[] = [
  'REFUND_CREDIT',
  'FORFEIT_CREDIT',
  'SERVICE_SETTLEMENT',
  'COMMISSION_CREDIT',
  'COMPLAINT_DEBIT',
  'WITHDRAWAL_HOLD',
  'WITHDRAWAL_RELEASE',
  'WITHDRAWAL_PAID',
];
const STATUSES: readonly WithdrawalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
const ACCOUNT_PATTERN = /^[0-9]{6,20}$/;
const MAX_TEXT = 100;

function money(value: unknown) {
  const parsed = number(value);
  if (parsed === undefined) throw new Error('Invalid wallet amount');
  return parsed;
}
export function parseWalletCenterBalance(value: unknown): Omit<WalletCenterBalance, 'name'> {
  const j = object(value);
  return {
    centerId: j.centerId == null ? null : required(j.centerId),
    availableBalance: money(j.availableBalance),
  };
}
function oneOf<T extends string>(value: unknown, values: readonly T[], what: string): T {
  const found = values.find((item) => item === value);
  if (!found) throw new Error(`Unknown ${what}`);
  return found;
}
export function parseWallet(value: unknown): Wallet {
  const j = object(value);
  return {
    availableBalance: money(j.availableBalance),
    heldBalance: money(j.heldBalance),
    withdrawable: j.withdrawable === true,
  };
}
export function parseWalletTransaction(value: unknown): WalletTransaction {
  const j = object(value);
  return {
    id: required(j.id),
    type: oneOf(j.type, TRANSACTION_TYPES, 'wallet transaction'),
    amount: money(j.amount),
    availableBefore: money(j.availableBefore),
    availableAfter: money(j.availableAfter),
    heldBefore: money(j.heldBefore),
    heldAfter: money(j.heldAfter),
    createdAt: required(j.createdAt),
  };
}
export function parseWithdrawal(value: unknown): WalletWithdrawal {
  const j = object(value);
  return {
    id: required(j.id),
    amount: money(j.amount),
    bankName: text(j.bankName),
    bankAccountNumber: text(j.bankAccountNumber),
    accountHolderName: text(j.accountHolderName),
    status: oneOf(j.status, STATUSES, 'withdrawal status'),
    rejectReason: text(j.rejectReason),
    transferReference: text(j.transferReference),
    createdAt: required(j.createdAt),
  };
}
export function parseWalletStatistics(value: unknown): WalletStatistics {
  const j = object(value);
  return {
    forfeitIncome: number(j.forfeitIncome) ?? 0,
    totalWithdrawn: number(j.totalWithdrawn) ?? 0,
    bookingCount: number(j.bookingCount) ?? 0,
    series: array(j.series).map((item) => {
      const point = object(item);
      return {
        period: required(point.period),
        income: number(point.income) ?? 0,
        withdrawn: number(point.withdrawn) ?? 0,
      };
    }),
  };
}
// Periods end now and start at Vietnam midnight (UTC+07); a year is charted per month.
export function walletRange(period: WalletPeriod, now = new Date()): WalletRange {
  const vietnam = new Date(now.getTime() + 7 * 3600000);
  const from =
    period === 'last30'
      ? now.getTime() - 30 * 86400000
      : Date.UTC(vietnam.getUTCFullYear(), period === 'month' ? vietnam.getUTCMonth() : 0, 1) -
        7 * 3600000;
  return {
    from: new Date(from).toISOString(),
    to: now.toISOString(),
    groupBy: period === 'year' ? 'MONTH' : 'DAY',
  };
}
// Money leaving what the caregiver can spend shows with a minus sign.
export function transactionSign(type: WalletTransactionType) {
  return type === 'COMPLAINT_DEBIT' || type === 'WITHDRAWAL_HOLD' || type === 'WITHDRAWAL_PAID'
    ? -1
    : 1;
}
export function maskAccount(accountNumber: string) {
  return accountNumber.length <= 4 ? accountNumber : `•••• ${accountNumber.slice(-4)}`;
}
// "1.500.000" or "1,500,000" typed as money reads as 1500000; anything else is not a whole amount.
export function parseAmount(value: string) {
  const digits = value.replace(/[.,\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}
// Client checks mirror PaymentService (6041/6044–6049); the server stays authoritative.
export function validateWithdrawal(
  form: WithdrawalForm,
  available: number,
): { errors: WithdrawalErrors; input?: WithdrawalInput } {
  const errors: WithdrawalErrors = {};
  const amount = parseAmount(form.amount);
  if (!form.amount.trim()) errors.amount = 'walletAmountRequired';
  else if (!Number.isInteger(amount) || amount <= 0) errors.amount = 'walletAmountInvalid';
  else if (amount > available) errors.amount = 'walletAmountTooHigh';
  const bankName = form.bankName.trim();
  if (!bankName) errors.bankName = 'walletBankRequired';
  else if (bankName.length > MAX_TEXT) errors.bankName = 'walletTextTooLong';
  const account = form.bankAccountNumber.trim();
  if (!account) errors.bankAccountNumber = 'walletAccountRequired';
  else if (!ACCOUNT_PATTERN.test(account)) errors.bankAccountNumber = 'walletAccountInvalid';
  const holder = form.accountHolderName.trim();
  if (!holder) errors.accountHolderName = 'walletHolderRequired';
  else if (holder.length > MAX_TEXT) errors.accountHolderName = 'walletTextTooLong';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: { amount, bankName, bankAccountNumber: account, accountHolderName: holder },
  };
}
