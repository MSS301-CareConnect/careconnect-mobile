import { ApiClient, ApiError } from '../../core/api';
import { number, object, page, required, text } from '../../core/json';
import { isNotificationId, parseNotification } from './feed';

export type RelatedVisit = { id: string; startAt: string; endAt: string; status: string };
export class NotificationRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async list({
    page: p = 0,
    size = 20,
    unreadOnly = false,
    type,
  }: {
    page?: number;
    size?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}) {
    if (!Number.isInteger(p) || p < 0 || !Number.isInteger(size) || size < 1 || size > 100)
      throw new Error('Invalid notification page');
    return page(
      await this.api.request('GET', '/notifications', undefined, {
        page: p,
        size,
        unreadOnly: String(unreadOnly),
        type,
      }),
      parseNotification,
    );
  }
  setRead(id: string, read: boolean) {
    this.validateIds([id]);
    return this.api.request('PATCH', `/notifications/${id}/${read ? 'read' : 'unread'}`);
  }
  readAll() {
    return this.api.request('PATCH', '/notifications/read-all');
  }
  async setReadMany(ids: string[], read: boolean) {
    this.validateIds(ids);
    return this.count(
      await this.api.request('PATCH', '/notifications/read-state', { ids, read }),
      'updated',
    );
  }
  remove(id: string) {
    this.validateIds([id]);
    return this.api.request('DELETE', `/notifications/${id}`);
  }
  async removeMany(ids: string[]) {
    this.validateIds(ids);
    return this.count(
      await this.api.request('POST', '/notifications/deletions', { ids }),
      'deleted',
    );
  }
  async clearRead() {
    return this.count(await this.api.request('DELETE', '/notifications/read'), 'deleted');
  }
  async bookingVisits(bookingId: string): Promise<RelatedVisit[]> {
    this.validateIds([bookingId]);
    const matches: RelatedVisit[] = [];
    let p = 0;
    let totalPages = 1;
    do {
      const result = page(
        await this.api.request('GET', '/booking-occurrences', undefined, { page: p, size: 100 }),
        (value) => object(value),
      );
      result.items
        .filter((item) => item.bookingId === bookingId)
        .forEach((item) => {
          const id = required(item.id);
          if (!isNotificationId(id)) throw new Error('Invalid occurrence identifier');
          matches.push({
            id,
            startAt: text(item.startAt),
            endAt: text(item.endAt),
            status: text(item.status),
          });
        });
      totalPages = result.totalPages;
      p++;
    } while (p < totalPages);
    return matches.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  private validateIds(ids: string[]) {
    if (ids.length < 1 || ids.length > 100 || ids.some((id) => !isNotificationId(id)))
      throw new Error('Invalid notification identifiers');
  }
  private count(value: unknown, key: 'updated' | 'deleted') {
    try {
      const count = number(object(value)[key]);
      if (count === undefined || !Number.isInteger(count) || count < 0) throw new Error();
      return count;
    } catch {
      throw new ApiError(200, 0, true);
    }
  }
}
