import { ApiClient } from '../../core/api';
import { page } from '../../core/json';
import {
  WalletRange,
  WithdrawalInput,
  parseWallet,
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
    return parseWithdrawal(await this.api.request('POST', '/wallet-withdrawals', input));
  }
}
