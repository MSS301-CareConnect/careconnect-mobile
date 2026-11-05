import { ApiClient } from '../../core/api';
import { page } from '../../core/json';
import { DepositRange, parseDepositSummary, parseKeptDeposit } from './models';
export class KeptDepositRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async summary(range: DepositRange) {
    return parseDepositSummary(
      await this.api.request('GET', '/deposit-forfeitures/summary', undefined, range),
    );
  }
  async list(range: DepositRange, p = 0) {
    return page(
      await this.api.request('GET', '/deposit-forfeitures', undefined, {
        ...range,
        page: p,
        size: 20,
      }),
      parseKeptDeposit,
    );
  }
}
