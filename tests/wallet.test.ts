import { expect, jest, test } from '@jest/globals';
import {
  maskAccount,
  parseAmount,
  parseWithdrawal,
  validateWithdrawal,
  walletRange,
} from '../src/features/wallet/models';
import { WalletRepository } from '../src/features/wallet/repository';

test('wallet periods use Vietnam boundaries and chart a year per month', () => {
  const now = new Date('2026-12-31T18:00:00Z');
  expect(walletRange('month', now)).toEqual({
    from: '2026-12-31T17:00:00.000Z',
    to: '2026-12-31T18:00:00.000Z',
    groupBy: 'DAY',
  });
  expect(walletRange('year', now).groupBy).toBe('MONTH');
  expect(walletRange('last30', now).from).toBe('2026-12-01T18:00:00.000Z');
});

test('withdrawal form checks every field and never exceeds the available balance', () => {
  expect(parseAmount('1.500.000')).toBe(1500000);
  expect(Number.isNaN(parseAmount('12a'))).toBe(true);
  expect(
    validateWithdrawal(
      { amount: '200000', bankName: '', bankAccountNumber: '12ab', accountHolderName: ' ' },
      100000,
    ).errors,
  ).toEqual({
    amount: 'walletAmountTooHigh',
    bankName: 'walletBankRequired',
    bankAccountNumber: 'walletAccountInvalid',
    accountHolderName: 'walletHolderRequired',
  });
  expect(
    validateWithdrawal(
      {
        amount: '90.000',
        bankName: ' Vietcombank ',
        bankAccountNumber: '0123456789',
        accountHolderName: 'TRAN THI B',
      },
      90000,
    ).input,
  ).toEqual({
    amount: 90000,
    bankName: 'Vietcombank',
    bankAccountNumber: '0123456789',
    accountHolderName: 'TRAN THI B',
  });
  expect(maskAccount('0123456789')).toBe('•••• 6789');
});

test('repository reads the token wallet and posts only contract fields', async () => {
  const calls: unknown[][] = [];
  const request = jest.fn(async (method: string, path: string, body?: unknown, query?: unknown) => {
    calls.push([method, path, body, query]);
    if (path === '/wallet-withdrawals' && method === 'POST')
      return {
        id: 'd1',
        amount: 90000,
        bankName: 'Vietcombank',
        bankAccountNumber: '0123456789',
        accountHolderName: 'TRAN THI B',
        status: 'PENDING',
        createdAt: '2026-11-09T03:00:00Z',
      };
    return { availableBalance: 90000, heldBalance: 0, withdrawable: true };
  });
  const repo = new WalletRepository({ request });
  expect(await repo.wallet()).toEqual({
    availableBalance: 90000,
    heldBalance: 0,
    withdrawable: true,
  });
  const created = await repo.requestWithdrawal({
    amount: 90000,
    bankName: 'Vietcombank',
    bankAccountNumber: '0123456789',
    accountHolderName: 'TRAN THI B',
  });
  expect(created.status).toBe('PENDING');
  expect(calls.map((call) => [call[0], call[1]])).toEqual([
    ['GET', '/wallets/me'],
    ['POST', '/wallet-withdrawals'],
  ]);
  expect(() => parseWithdrawal({ id: 'x', amount: 1, status: 'LOST', createdAt: 'now' })).toThrow();
});
