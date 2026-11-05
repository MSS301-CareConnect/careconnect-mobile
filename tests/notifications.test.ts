import { jest, test, expect } from '@jest/globals';
import {
  NotificationFeed,
  notificationTarget,
  parseNotification,
} from '../src/features/notifications/feed';
import { NotificationRepository } from '../src/features/notifications/repository';
const item = (id: string, createdAt = '2026-11-01T01:00:00Z') => ({
  id,
  title: 'Title',
  body: 'Body',
  createdAt,
  refType: 'BOOKING_OCCURRENCE',
  refId: 'f3b57ad4-87ae-4faa-a058-b0aa92ce5e98',
});
const page = (items: unknown[]) => ({ items, page: 0, totalPages: 1, totalElements: items.length });
test('first read seeds silently; only new unread recent IDs alert', async () => {
  let items = [item('1')];
  const request = jest.fn(async (_m: string, path: string) =>
    path.endsWith('unread-count') ? { count: items.length } : page(items),
  );
  const feed = new NotificationFeed({ request }, () => {});
  await feed.setActive(true);
  expect(feed.banner).toBe(false);
  expect(feed.unread).toBe(1);
  items = [item('2'), item('1')];
  await feed.tick();
  expect(feed.banner).toBe(true);
  feed.dismiss();
  await feed.tick();
  expect(feed.banner).toBe(false);
  items = [item('old', '2026-10-01T00:00:00Z'), ...items];
  await feed.tick();
  expect(feed.banner).toBe(false);
  feed.dispose();
});
test('pause discards pending responses and resume reloads', async () => {
  let release!: () => void;
  let delayed = false;
  const request = jest.fn(async (_m: string, path: string) => {
    if (delayed)
      await new Promise<void>((r) => {
        release = r;
      });
    return path.endsWith('unread-count') ? { count: 9 } : page([item('x')]);
  });
  const feed = new NotificationFeed({ request }, () => {});
  await feed.setActive(true);
  delayed = true;
  // One deferred read is enough: unread-count is deliberately delayed separately.
  request.mockImplementation(async (_m: string, path: string) => {
    if (path.endsWith('unread-count'))
      await new Promise<void>((r) => {
        release = r;
      });
    return path.endsWith('unread-count') ? { count: 20 } : page([item('new')]);
  });
  const pending = feed.tick();
  await feed.setActive(false);
  release();
  await pending;
  expect(feed.unread).toBe(9);
  expect(feed.banner).toBe(false);
  feed.dispose();
});
test('only known reference types with UUIDs can navigate', () => {
  expect(
    notificationTarget({ refType: 'BOOKING_OCCURRENCE', refId: 'https://evil.test' }),
  ).toBeUndefined();
  expect(
    notificationTarget({ refType: 'URL', refId: 'f3b57ad4-87ae-4faa-a058-b0aa92ce5e98' }),
  ).toBeUndefined();
  expect(notificationTarget(item('1'))).toEqual({
    screen: 'Visit',
    id: 'f3b57ad4-87ae-4faa-a058-b0aa92ce5e98',
  });
});

test('notification watermark compares Instants with fractional seconds chronologically', async () => {
  let items = [item('whole', '2026-11-01T01:00:00Z')];
  const request = jest.fn(async (_m: string, path: string) =>
    path.endsWith('unread-count') ? { count: items.length } : page(items),
  );
  const feed = new NotificationFeed({ request }, () => {});
  await feed.setActive(true);
  items = [item('fraction', '2026-11-01T01:00:00.500Z'), ...items];
  await feed.tick();
  expect(feed.banner).toBe(true);
  feed.dispose();
});

const bookingId = '2c0917de-cc25-4d1a-a7b9-c2af52183dd4';
const occurrenceId = 'f3b57ad4-87ae-4faa-a058-b0aa92ce5e98';

test('resolved occurrence links take precedence over report and session references', () => {
  const notification = parseNotification({
    ...item('notice'),
    type: 'REPORT_SUBMITTED',
    refType: 'CARE_REPORT',
    refId: bookingId,
    bookingId,
    occurrenceId,
  });
  expect(notification).toMatchObject({ type: 'REPORT_SUBMITTED', bookingId, occurrenceId });
  expect(notificationTarget(notification)).toEqual({ screen: 'Visit', id: occurrenceId });
});

test('customer caregiver requests open the booking request inbox rather than a paid visit', () => {
  expect(
    notificationTarget(
      parseNotification({
        ...item('notice'),
        type: 'CAREGIVER_REQUEST',
        refType: 'BOOKING',
        refId: bookingId,
      }),
    ),
  ).toEqual({ screen: 'BookingRequests', bookingId });
  expect(
    notificationTarget(
      parseNotification({
        ...item('notice'),
        type: 'BOOKING_CANCELLED',
        refType: 'BOOKING',
        refId: bookingId,
      }),
    ),
  ).toEqual({ screen: 'BookingVisits', bookingId });
  expect(
    notificationTarget(
      parseNotification({
        ...item('notice'),
        type: 'CAREGIVER_REQUEST',
        refType: 'BOOKING',
        refId: '../private',
      }),
    ),
  ).toBeUndefined();
});

test('notification repository keeps server filters, pagination and exact own-user mutation contracts', async () => {
  const calls: unknown[][] = [];
  const repo = new NotificationRepository({
    request: async (...args) => {
      calls.push(args);
      if (args[0] === 'GET')
        return { items: [item('notice')], page: 2, totalPages: 4, totalElements: 63 };
      return args[1] === '/notifications/read-state' ? { updated: 1 } : { deleted: 1 };
    },
  });
  const result = await repo.list({
    page: 2,
    size: 20,
    unreadOnly: true,
    type: 'CAREGIVER_REQUEST',
  });
  expect(result.totalElements).toBe(63);
  await repo.setRead(occurrenceId, true);
  await repo.setRead(occurrenceId, false);
  await repo.readAll();
  expect(await repo.setReadMany([occurrenceId], false)).toBe(1);
  await repo.remove(occurrenceId);
  expect(await repo.removeMany([occurrenceId])).toBe(1);
  expect(await repo.clearRead()).toBe(1);
  expect(calls).toEqual([
    [
      'GET',
      '/notifications',
      undefined,
      { page: 2, size: 20, unreadOnly: 'true', type: 'CAREGIVER_REQUEST' },
    ],
    ['PATCH', `/notifications/${occurrenceId}/read`],
    ['PATCH', `/notifications/${occurrenceId}/unread`],
    ['PATCH', '/notifications/read-all'],
    ['PATCH', '/notifications/read-state', { ids: [occurrenceId], read: false }],
    ['DELETE', `/notifications/${occurrenceId}`],
    ['POST', '/notifications/deletions', { ids: [occurrenceId] }],
    ['DELETE', '/notifications/read'],
  ]);
});

test('invalid batches or page sizes never reach the API and malformed successful counts are uncertain', async () => {
  const calls: unknown[][] = [];
  const repo = new NotificationRepository({
    request: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await expect(repo.list({ size: 101 })).rejects.toThrow();
  await expect(repo.setReadMany([], true)).rejects.toThrow();
  await expect(repo.removeMany(Array.from({ length: 101 }, () => occurrenceId))).rejects.toThrow();
  expect(calls).toHaveLength(0);
  await expect(repo.setReadMany([occurrenceId], true)).rejects.toMatchObject({
    uncertain: true,
  });
  await expect(repo.removeMany([occurrenceId])).rejects.toMatchObject({
    uncertain: true,
  });
  expect(calls).toHaveLength(2);
});

test('booking links scan every authorized occurrence page and never read forbidden booking detail', async () => {
  const calls: unknown[][] = [];
  const repo = new NotificationRepository({
    request: async (...args) => {
      calls.push(args);
      const query = args[3];
      const p = typeof query?.page === 'number' ? query.page : 0;
      return {
        items:
          p === 0
            ? [{ id: 'other', bookingId: 'other' }]
            : [
                {
                  id: occurrenceId,
                  bookingId,
                  startAt: '2026-11-01T01:00:00Z',
                  endAt: '2026-11-01T02:00:00Z',
                  status: 'COMPLETED',
                },
              ],
        page: p,
        totalPages: 2,
        totalElements: 2,
      };
    },
  });
  expect(await repo.bookingVisits(bookingId)).toEqual([
    {
      id: occurrenceId,
      startAt: '2026-11-01T01:00:00Z',
      endAt: '2026-11-01T02:00:00Z',
      status: 'COMPLETED',
    },
  ]);
  expect(calls).toEqual([
    ['GET', '/booking-occurrences', undefined, { page: 0, size: 100 }],
    ['GET', '/booking-occurrences', undefined, { page: 1, size: 100 }],
  ]);
});

test('a post-write feed refresh waits for an older poll then obtains the fresh server count', async () => {
  let count = 1;
  let defer = false;
  let release!: () => void;
  const feed = new NotificationFeed(
    {
      request: async (_method, path) => {
        if (!path.endsWith('unread-count')) return page([item('notice')]);
        const capturedCount = count;
        if (defer) {
          defer = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return { count: capturedCount };
      },
    },
    () => {},
  );
  await feed.setActive(true);
  defer = true;
  const pending = feed.tick();
  count = 0;
  const refreshed = feed.refresh();
  release();
  await pending;
  await refreshed;
  expect(feed.unread).toBe(0);
  feed.dispose();
});

test('malformed unread counts retain the previous badge instead of inventing a new total', async () => {
  let count: unknown = 3;
  const feed = new NotificationFeed(
    {
      request: async (_method, path) =>
        path.endsWith('unread-count') ? { count } : page([item('notice')]),
    },
    () => {},
  );
  await feed.setActive(true);
  count = -4;
  await feed.tick();
  expect(feed.unread).toBe(3);
  count = 1.5;
  await feed.tick();
  expect(feed.unread).toBe(3);
  feed.dispose();
});
