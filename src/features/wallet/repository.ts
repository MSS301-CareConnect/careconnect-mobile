import { ApiClient, ApiError } from '../../core/api';
import { array, object, page, text } from '../../core/json';
import {
  WalletRange,
  WithdrawalInput,
  parseWallet,
  parseWalletCenterBalance,
  parseWalletStatistics,
  parseWalletTransaction,
  parseWithdrawal,
} from './models';
const PAGE_SIZE = 20;
// PaymentService resolves the caregiver wallet from the access token; no wallet id is sent.
export class WalletRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async wallet() {
    return parseWallet(await this.api.request('GET', '/wallets/me'));
  }
  async centerBalances() {
    const result = await this.api.request('GET', '/wallets/me/center-balances');
    if (!Array.isArray(result)) throw new Error('Invalid center balances');
    return Promise.all(
      array(result)
        .map(parseWalletCenterBalance)
        .filter((balance) => balance.availableBalance > 0)
        .map(async (balance) => {
          let name = '';
          if (balance.centerId) {
            try {
              const center = await this.api.request(
                'GET',
                `/care-centers/${encodeURIComponent(balance.centerId)}`,
              );
              name = text(object(center).centerName);
            } catch {
              // A directory lookup is optional; PaymentService still provides the source balance.
            }
          }
          return { ...balance, name };
        }),
    );
  }
  async statistics(range: WalletRange) {
    return parseWalletStatistics(
      await this.api.request('GET', '/wallets/me/statistics', undefined, range),
    );
  }
  async transactions(range: WalletRange, p = 0) {
    return page(
      await this.api.request('GET', '/wallets/me/transactions', undefined, {
        from: range.from,
        to: range.to,
        page: p,
        size: PAGE_SIZE,
      }),
      parseWalletTransaction,
    );
  }
  async withdrawals(p = 0) {
    return page(
      await this.api.request('GET', '/wallet-withdrawals', undefined, { page: p, size: PAGE_SIZE }),
      parseWithdrawal,
    );
  }
  async requestWithdrawal(input: WithdrawalInput) {
    const result = await this.api.request('POST', '/wallet-withdrawals', input);
    try {
      const withdrawal = parseWithdrawal(result);
      if (withdrawal.amount !== input.amount) throw new Error('Unexpected withdrawal amount');
      return withdrawal;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
}
