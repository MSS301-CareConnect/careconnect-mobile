import { jest, test, expect } from '@jest/globals';
import { NotificationFeed, notificationTarget } from '../src/features/notifications/feed';
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
