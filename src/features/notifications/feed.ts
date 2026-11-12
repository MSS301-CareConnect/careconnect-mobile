import { ApiClient } from '../../core/api';
import { number, object, required, text } from '../../core/json';
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
  | { screen: 'Absences' | 'Wallet' };
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
  if (item.type === 'WALLET_WITHDRAWAL_COMPLETED' || item.type === 'WALLET_WITHDRAWAL_REJECTED')
    return { screen: 'Wallet' };
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
  private active = false;
  private generation = 0;
  private loading = false;
  private pending?: Promise<void>;
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
      const count = await this.api.request('GET', '/notifications/unread-count');
      if (this.disposed || !this.active || generation !== this.generation) return;
      const unread = number(object(count).count);
      if (unread === undefined || !Number.isInteger(unread) || unread < 0)
        throw new Error('Invalid unread count');
      this.unread = unread;
      this.changed();
    } catch {
      /* Foreground polling must not interrupt navigation on temporary failure. */
    } finally {
      this.loading = false;
      if (this.active && !this.disposed && generation !== this.generation) this.tick();
    }
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.unread = undefined;
  }
}
