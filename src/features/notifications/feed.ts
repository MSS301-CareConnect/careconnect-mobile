import { ApiClient } from '../../core/api';
import { number, object, page, required, text } from '../../core/json';
export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string;
  refType: string;
  refId: string;
};
export function parseNotification(value: unknown): Notification {
  const j = object(value);
  return {
    id: required(j.id),
    title: text(j.title),
    body: text(j.body),
    createdAt: text(j.createdAt),
    readAt: text(j.readAt),
    refType: text(j.refType),
    refId: text(j.refId),
  };
}
export function notificationTarget(item: {
  refType: string;
  refId: string;
}): { screen: 'Visit' | 'Session' | 'Report'; id: string } | undefined {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.refId)) return;
  const screen =
    item.refType === 'BOOKING_OCCURRENCE'
      ? 'Visit'
      : item.refType === 'CARE_SESSION'
        ? 'Session'
        : item.refType === 'CARE_REPORT'
          ? 'Report'
          : undefined;
  return screen ? { screen, id: item.refId } : undefined;
}
export class NotificationFeed {
  unread?: number;
  banner = false;
  private active = false;
  private generation = 0;
  private loading = false;
  private seeded = false;
  private seen = new Set<string>();
  private watermark = -Infinity;
  private timer?: ReturnType<typeof setInterval>;
  private disposed = false;
  constructor(
    private api: Pick<ApiClient, 'request'>,
    private changed: () => void,
  ) {}
  async setActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.banner = false;
    if (active) {
      this.timer = setInterval(() => {
        void this.tick();
      }, 30000);
      await this.tick();
    }
  }
  async tick() {
    if (this.disposed || !this.active || this.loading) return;
    this.loading = true;
    const generation = this.generation;
    try {
      const [count, data] = await Promise.all([
        this.api.request('GET', '/notifications/unread-count'),
        this.api.request('GET', '/notifications', undefined, { page: 0, size: 20 }),
      ]);
      if (this.disposed || !this.active || generation !== this.generation) return;
      const items = page(data, parseNotification).items;
      this.banner =
        this.banner ||
        (this.seeded &&
          items.some(
            (n) => !n.readAt && !this.seen.has(n.id) && Date.parse(n.createdAt) >= this.watermark,
          ));
      items.forEach((n) => {
        this.seen.add(n.id);
        const timestamp = Date.parse(n.createdAt);
        if (timestamp > this.watermark) this.watermark = timestamp;
      });
      while (this.seen.size > 200) {
        const first = this.seen.values().next().value;
        if (first) this.seen.delete(first);
        else break;
      }
      this.seeded = true;
      this.unread = number(object(count).count);
      this.changed();
    } catch {
      /* Foreground polling must not interrupt navigation on temporary failure. */
    } finally {
      this.loading = false;
      if (this.active && !this.disposed && generation !== this.generation) void this.tick();
    }
  }
  dismiss() {
    this.banner = false;
    this.changed();
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.seen.clear();
    this.unread = undefined;
    this.banner = false;
  }
}
