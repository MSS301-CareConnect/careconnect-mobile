import { ApiClient } from '../../core/api';
import { page } from '../../core/json';
import { vietnamDay } from '../../core/time';
import { parseVisit } from './models';
export class VisitRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async visits(p = 0, from?: string, to?: string, status?: string) {
    return page(
      await this.api.request('GET', '/booking-occurrences', undefined, {
        from,
        to,
        status,
        page: p,
        size: 20,
      }),
      parseVisit,
    );
  }
  async today(now = new Date(), p = 0) {
    const day = vietnamDay(now);
    const [visits, done] = await Promise.all([
      this.visits(p, day, day),
      this.visits(0, day, day, 'COMPLETED'),
    ]);
    return { visits, completed: done.totalElements };
  }
  async visit(id: string) {
    return parseVisit(await this.api.request('GET', `/booking-occurrences/${id}`));
  }
  async acknowledge(id: string) {
    return parseVisit(await this.api.request('POST', `/booking-occurrences/${id}/acknowledge`));
  }
}
