import React from 'react';
import { Alert, Text } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import type { Routes } from '../src/app/routes';
import { NotificationProvider, NotificationsScreen } from '../src/features/notifications/screens';

const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';
const bookingId = '20000000-0000-4000-8000-000000000001';
const visitId = '30000000-0000-4000-8000-000000000001';
const makeNotice = (id: string, title: string, readAt: string | null = null) => ({
  id,
  type: 'SHIFT_REMINDER',
  title,
  body: 'Server-provided notice body',
  createdAt: '2026-11-05T02:00:00Z',
  readAt,
  refType: '',
  refId: null,
  bookingId: null,
  occurrenceId: null,
});
function fixture({
  gate,
  failWrite = false,
  notice,
  paginated = false,
}: {
  gate?: Promise<void>;
  failWrite?: boolean;
  notice?: Record<string, unknown>;
  paginated?: boolean;
} = {}) {
  let items: Record<string, unknown>[] = notice
    ? [notice]
    : [
        makeNotice(firstId, 'Unread notice'),
        makeNotice(secondId, 'Read notice', '2026-11-05T03:00:00Z'),
      ];
  if (paginated)
    items = [
      makeNotice(firstId, 'Unread notice'),
      ...Array.from({ length: 19 }, (_, index) =>
        makeNotice(
          `10000000-0000-4000-8000-${String(index + 3).padStart(12, '0')}`,
          `Notice ${index + 3}`,
        ),
      ),
      makeNotice(secondId, 'Last notice'),
    ];
  const controls = { failWrite, failRead: false, failCount: false };
  const calls: { method: string; path: string; body?: unknown; query: URLSearchParams }[] = [];
  let token: string | null = 'refresh';
  const api = new ApiClient(
    'http://test',
    {
      get: async () => token,
      set: async (value) => {
        token = value;
      },
    },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as { ids?: string[]; read?: boolean })
        : undefined;
      calls.push({ method, path, body, query: url.searchParams });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', fullName: 'Caregiver', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/notifications/unread-count') {
        if (controls.failCount) return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        result = { count: items.filter((item) => !item.readAt).length };
      } else if (path === '/notifications' && method === 'GET') {
        if (controls.failRead) return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        const filtered =
          url.searchParams.get('unreadOnly') === 'true'
            ? items.filter((item) => !item.readAt)
            : items;
        const p = Number(url.searchParams.get('page') ?? 0);
        result = {
          items: paginated ? filtered.slice(p * 20, p * 20 + 20) : filtered,
          page: p,
          totalPages: paginated ? Math.ceil(filtered.length / 20) : 1,
          totalElements: filtered.length,
        };
      } else if (path.startsWith('/notifications')) {
        await gate;
        if (controls.failWrite) throw new TypeError('Interrupted write');
        const ids = body?.ids ?? [path.split('/')[2]];
        if (path === '/notifications/read') items = items.filter((item) => !item.readAt);
        else if (method === 'DELETE' || path === '/notifications/deletions')
          items = items.filter((item) => !ids.includes(String(item.id)));
        else
          items = items.map((item) =>
            path === '/notifications/read-all' || ids.includes(String(item.id))
              ? {
                  ...item,
                  readAt:
                    path.endsWith('/unread') || body?.read === false
                      ? null
                      : '2026-11-05T04:00:00Z',
                }
              : item,
          );
        result =
          path === '/notifications/read-state'
            ? { updated: ids.length }
            : path === '/notifications/read' || path === '/notifications/deletions'
              ? { deleted: ids.length }
              : null;
      } else if (path === '/booking-occurrences')
        result = {
          items: [
            {
              id: visitId,
              bookingId,
              startAt: '2026-11-05T01:00:00Z',
              endAt: '2026-11-05T02:00:00Z',
              status: 'COMPLETED',
            },
          ],
          page: 0,
          totalPages: 1,
          totalElements: 1,
        };
      else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return {
    api,
    controls,
    calls,
    writes: () =>
      calls.filter((call) => call.path.startsWith('/notifications') && call.method !== 'GET'),
  };
}
const Stack = createNativeStackNavigator<Routes>();
function Destination() {
  return <Text>Destination</Text>;
}
function SignedIn({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  return user ? <>{children}</> : null;
}
async function open(f: ReturnType<typeof fixture>) {
  const navigation = createNavigationContainerRef<Routes>();
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.api}>
        <SignedIn>
          <NotificationProvider>
            <NavigationContainer ref={navigation}>
              <Stack.Navigator
                screenOptions={{ headerShown: false }}
                initialRouteName="Notifications"
              >
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="Visit" component={Destination} />
                <Stack.Screen name="BookingRequests" component={Destination} />
                <Stack.Screen name="Session" component={Destination} />
                <Stack.Screen name="Report" component={Destination} />
              </Stack.Navigator>
            </NavigationContainer>
          </NotificationProvider>
        </SignedIn>
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Unread notice');
  return { ...screen, navigation };
}
async function confirmLast(alert: jest.SpiedFunction<typeof Alert.alert>) {
  await act(async () => alert.mock.calls.at(-1)?.[2]?.at(-1)?.onPress?.());
}

test('unread filter reaches the server and a row can be marked read or unread from fresh results', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Chỉ chưa đọc' }));
    await waitFor(() => expect(screen.queryByText('Read notice')).toBeNull());
    expect(
      f.calls
        .filter((call) => call.path === '/notifications')
        .at(-1)
        ?.query.get('unreadOnly'),
    ).toBe('true');
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    await waitFor(() => expect(screen.queryByText('Unread notice')).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: 'Tất cả thông báo' }));
    await screen.findByText('Unread notice');
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu chưa đọc: Unread notice' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' })).toBeTruthy(),
    );
    expect(f.writes().map((call) => [call.method, call.path])).toEqual([
      ['PATCH', `/notifications/${firstId}/read`],
      ['PATCH', `/notifications/${firstId}/unread`],
    ]);
  } finally {
    await screen.unmount();
  }
});

test('selected visible notices use batch contracts and deletion waits for destructive confirmation', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn trang này' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu mục đã chọn là chưa đọc' }));
    await waitFor(() => expect(f.writes()).toHaveLength(1));
    expect(f.writes()[0]).toMatchObject({
      method: 'PATCH',
      path: '/notifications/read-state',
      body: { ids: [firstId, secondId], read: false },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chọn trang này' })).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn trang này' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa mục đã chọn' }));
    expect(f.writes()).toHaveLength(1);
    await confirmLast(alert);
    await waitFor(() => expect(screen.queryByText('Unread notice')).toBeNull());
    expect(f.writes()[1]).toMatchObject({
      method: 'POST',
      path: '/notifications/deletions',
      body: { ids: [firstId, secondId] },
    });
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('clear-read confirmation removes read notices across the account using the dedicated endpoint', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa thông báo đã đọc' }));
    expect(f.writes()).toHaveLength(0);
    await confirmLast(alert);
    await waitFor(() => expect(screen.queryByText('Read notice')).toBeNull());
    expect(screen.getByText('Unread notice')).toBeTruthy();
    expect(f.writes()).toMatchObject([{ method: 'DELETE', path: '/notifications/read' }]);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('an uncertain write keeps cards visible and blocks repeats until an explicit successful reconciliation', async () => {
  const f = fixture({ failWrite: true });
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByText('Unread notice')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    expect(f.writes()).toHaveLength(1);
    f.controls.failRead = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại thông báo' })).toBeEnabled(),
    );
    expect(screen.getByText('Unread notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' })).toBeDisabled();
    f.controls.failRead = false;
    f.controls.failWrite = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' })).toBeEnabled(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    await waitFor(() => expect(f.writes()).toHaveLength(2));
  } finally {
    await screen.unmount();
  }
});

test('pending notification writes lock other mutations, filters and duplicate row actions', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture({ gate });
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    expect(screen.getByRole('button', { name: 'Chỉ chưa đọc' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xóa thông báo đã đọc' })).toBeDisabled();
    expect(f.writes()).toHaveLength(1);
    await act(async () => release());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Đánh dấu chưa đọc: Unread notice' }),
      ).toBeEnabled(),
    );
  } finally {
    release();
    await screen.unmount();
  }
});

test.each([
  {
    type: 'REPORT_SUBMITTED',
    refType: 'CARE_REPORT',
    refId: secondId,
    bookingId,
    occurrenceId: visitId,
    expectedScreen: 'Visit',
    expectedParams: { id: visitId },
  },
  {
    type: 'CAREGIVER_REQUEST',
    refType: 'BOOKING',
    refId: bookingId,
    expectedScreen: 'BookingRequests',
    expectedParams: { bookingId },
  },
  {
    type: 'BOOKING_CANCELLED',
    refType: 'BOOKING',
    refId: bookingId,
    expectedScreen: 'Visit',
    expectedParams: { id: visitId },
  },
])(
  'notification $type opens its authorized target without reading booking detail',
  async ({ expectedScreen, expectedParams, ...link }) => {
    const f = fixture({ notice: { ...makeNotice(firstId, 'Unread notice'), ...link } });
    const screen = await open(f);
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Xem chi tiết: Unread notice' }));
      await waitFor(() =>
        expect(screen.navigation.getCurrentRoute()).toMatchObject({
          name: expectedScreen,
          params: expectedParams,
        }),
      );
      expect(f.calls.some((call) => call.path.startsWith('/bookings/'))).toBe(false);
      expect(f.writes()).toHaveLength(1);
    } finally {
      await screen.unmount();
    }
  },
);

test('confirmed writes with a failed subsequent read retain cards but cannot be repeated', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    f.controls.failRead = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    await screen.findByText(/Tải lại thông báo để kiểm tra trạng thái/);
    expect(screen.getByText('Unread notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Đánh dấu đã đọc: Unread notice' }));
    expect(f.writes()).toHaveLength(1);
    f.controls.failRead = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Đánh dấu chưa đọc: Unread notice' }),
      ).toBeEnabled(),
    );
  } finally {
    await screen.unmount();
  }
});

test.each(['delete', 'markRead'] as const)(
  'the final page returns to remaining notices after its last row is removed by %s',
  async (action) => {
    const f = fixture({ paginated: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = await open(f);
    try {
      if (action === 'markRead')
        await fireEvent.press(screen.getByRole('button', { name: 'Chỉ chưa đọc' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
      await screen.findByText('Last notice');
      await fireEvent.press(
        screen.getByRole('button', {
          name: action === 'delete' ? 'Xóa: Last notice' : 'Đánh dấu đã đọc: Last notice',
        }),
      );
      if (action === 'delete') await confirmLast(alert);
      await screen.findByText('Unread notice');
      expect(screen.queryByText('Last notice')).toBeNull();
      expect(screen.queryByText('Chưa có thông báo')).toBeNull();
      expect(
        f.calls
          .filter(
            (call) =>
              call.path === '/notifications' &&
              call.query.get('unreadOnly') === (action === 'markRead' ? 'true' : 'false'),
          )
          .at(-1)
          ?.query.get('page'),
      ).toBe('0');
    } finally {
      alert.mockRestore();
      await screen.unmount();
    }
  },
);
