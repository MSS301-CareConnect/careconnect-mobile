import { ApiClient } from '../../core/api';
import { number, object, page, required, text } from '../../core/json';
export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string;
  refType: string;
  refId: string;
  bookingId: string;
  occurrenceId: string;
};
export function parseNotification(value: unknown): Notification {
  const j = object(value);
  return {
    id: required(j.id),
    type: text(j.type),
    title: text(j.title),
    body: text(j.body),
    createdAt: text(j.createdAt),
    readAt: text(j.readAt),
    refType: text(j.refType),
    refId: text(j.refId),
    bookingId: text(j.bookingId),
    occurrenceId: text(j.occurrenceId),
  };
}
export type NotificationTarget =
  | { screen: 'Visit' | 'Session' | 'Report'; id: string }
  | { screen: 'BookingRequests' | 'BookingVisits'; bookingId: string }
  | { screen: 'Absences' };
export function isNotificationId(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function notificationTarget(item: {
  refType: string;
  refId: string;
  type?: string;
  bookingId?: string;
  occurrenceId?: string;
}): NotificationTarget | undefined {
  const bookingId = isNotificationId(item.bookingId)
    ? item.bookingId
    : item.refType === 'BOOKING' && isNotificationId(item.refId)
      ? item.refId
      : undefined;
  if (item.type === 'CAREGIVER_REQUEST' && bookingId)
    return { screen: 'BookingRequests', bookingId };
  // The absence record, not the missed visit, is where the caregiver acts (explain / read the conclusion).
  if (item.type === 'CAREGIVER_ABSENCE_UPDATED') return { screen: 'Absences' };
  if (
    ![
      'BOOKING',
      'BOOKING_OCCURRENCE',
      'CARE_SESSION',
      'CARE_REPORT',
      'COMPLAINT',
      'FEEDBACK',
    ].includes(item.refType)
  )
    return;
  if (isNotificationId(item.occurrenceId)) return { screen: 'Visit', id: item.occurrenceId };
  if (item.refType === 'BOOKING' && bookingId) return { screen: 'BookingVisits', bookingId };
  if (!isNotificationId(item.refId)) return;
  const screen =
    item.refType === 'BOOKING_OCCURRENCE'
      ? 'Visit'
      : item.refType === 'CARE_SESSION'
        ? 'Session'
        : item.refType === 'CARE_REPORT'
          ? 'Report'
          : undefined;
  return screen
    ? { screen, id: item.refId }
    : bookingId
      ? { screen: 'BookingVisits', bookingId }
      : undefined;
}
export class NotificationFeed {
  unread?: number;
  banner = false;
  private active = false;
  private generation = 0;
  private loading = false;
  private pending?: Promise<void>;
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
        this.tick();
      }, 30000);
      await this.tick();
    }
  }
  tick(): Promise<void> {
    if (this.disposed || !this.active) return Promise.resolve();
    if (this.loading) return this.pending ?? Promise.resolve();
    const pending = this.poll();
    this.pending = pending;
    return pending;
  }
  async refresh() {
    await this.pending;
    await this.tick();
  }
  private async poll() {
    this.loading = true;
    const generation = this.generation;
    try {
      const [count, data] = await Promise.all([
        this.api.request('GET', '/notifications/unread-count'),
        this.api.request('GET', '/notifications', undefined, { page: 0, size: 20 }),
      ]);
      if (this.disposed || !this.active || generation !== this.generation) return;
      const items = page(data, parseNotification).items;
      const unread = number(object(count).count);
      if (unread === undefined || !Number.isInteger(unread) || unread < 0)
        throw new Error('Invalid unread count');
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
      this.unread = unread;
      if (unread === 0) this.banner = false;
      this.changed();
    } catch {
      /* Foreground polling must not interrupt navigation on temporary failure. */
    } finally {
      this.loading = false;
      if (this.active && !this.disposed && generation !== this.generation) this.tick();
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
