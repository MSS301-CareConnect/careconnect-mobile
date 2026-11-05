import React from 'react';
import { Alert, Text } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { SecuritySessionsScreen } from '../src/features/profile/sessions-screen';

const Stack = createNativeStackNavigator();
function SignedIn({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  return user ? <>{children}</> : <Text>Signed out</Text>;
}
const currentDevice = 'Chrome · Android';
const otherDevice = 'Firefox · Windows 10/11';
const otherSignOut = `Đăng xuất: ${otherDevice}, 192.0.2.2`;
const bulkSignOut = 'Đăng xuất tất cả thiết bị khác';
const defaultSessions = [
  {
    sessionId: 'current',
    deviceId: 'My Android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36',
    ip: '192.0.2.1',
    createdAt: '2026-11-01T00:00:00Z',
    lastActiveAt: '2026-11-05T01:00:00Z',
    isCurrent: true,
  },
  {
    sessionId: 'other',
    deviceId: 'Other phone',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/130.0',
    ip: '192.0.2.2',
    createdAt: '2026-11-01T00:00:00Z',
    lastActiveAt: '2026-11-04T01:00:00Z',
    isCurrent: false,
  },
];
function fixture({
  failWrite = false,
  gate,
  initialSessions = defaultSessions,
}: {
  failWrite?: boolean;
  gate?: Promise<void>;
  initialSessions?: typeof defaultSessions;
} = {}) {
  let token: string | null = 'refresh';
  let sessions = initialSessions.map((session) => ({ ...session }));
  const calls: { method: string; path: string }[] = [];
  const controls = { failWrite, failRead: false, failSessionId: '' };
  const api = new ApiClient(
    'http://test',
    {
      get: async () => token,
      set: async (value) => {
        token = value;
      },
    },
    async (input, init) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      const method = init?.method ?? 'GET';
      calls.push({ method, path });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/auth/sessions' && method === 'GET') {
        if (controls.failRead) return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        result = sessions;
      } else if (path.startsWith('/auth/sessions/') && method === 'DELETE') {
        await gate;
        if (controls.failWrite || path.endsWith(`/${controls.failSessionId}`))
          throw new TypeError('Interrupted');
        sessions = sessions.filter((item) => item.sessionId !== path.split('/').at(-1));
        result = null;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return {
    api,
    calls,
    controls,
    token: () => token,
    writes: () => calls.filter((call) => call.method === 'DELETE'),
  };
}
async function open(f: ReturnType<typeof fixture>) {
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.api}>
        <SignedIn>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen name="Sessions" component={SecuritySessionsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SignedIn>
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText(currentDevice);
  return screen;
}
async function yes(alert: jest.SpiedFunction<typeof Alert.alert>) {
  await act(async () => alert.mock.calls.at(-1)?.[2]?.at(-1)?.onPress?.());
}

test('revoking another session requires confirmation and refreshes the actual list', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: otherSignOut }));
    expect(f.writes()).toHaveLength(0);
    await yes(alert);
    await waitFor(() => expect(screen.queryByText(otherDevice)).toBeNull());
    expect(f.writes()).toEqual([{ method: 'DELETE', path: '/auth/sessions/other' }]);
    expect(f.token()).not.toBeNull();
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('the current device has no row sign-out and confirmed sign-out of others preserves this session', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    expect(screen.getByText('Thiết bị này')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: `Đăng xuất: ${currentDevice}, 192.0.2.1` }),
    ).toBeNull();
    expect(screen.queryByText(defaultSessions[0]!.userAgent)).toBeNull();
    expect(screen.queryByText('My Android')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: bulkSignOut }));
    expect(f.writes()).toHaveLength(0);
    await yes(alert);
    await waitFor(() => expect(screen.queryByText(otherDevice)).toBeNull());
    expect(screen.getByText(currentDevice)).toBeTruthy();
    expect(screen.queryByText('Signed out')).toBeNull();
    expect(f.token()).not.toBeNull();
    expect(f.writes()).toEqual([{ method: 'DELETE', path: '/auth/sessions/other' }]);
    expect(f.calls.some((call) => call.path === '/auth/logout')).toBe(false);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('uncertain revocation retains the list and blocks repeated writes until explicit fresh read', async () => {
  const f = fixture({ failWrite: true });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: otherSignOut }));
    await yes(alert);
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByText(otherDevice)).toBeTruthy();
    expect(screen.getByRole('button', { name: otherSignOut })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: otherSignOut }));
    expect(f.writes()).toHaveLength(1);
    f.controls.failRead = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: otherSignOut })).toBeDisabled();
    f.controls.failRead = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() => expect(screen.getByRole('button', { name: otherSignOut })).toBeEnabled());
    expect(f.writes()).toHaveLength(1);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('pending revoke locks other sessions and confirmed revoke with failed refresh blocks stale repeats', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture({ gate });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: otherSignOut }));
    await yes(alert);
    expect(screen.getByRole('button', { name: otherSignOut })).toBeDisabled();
    expect(screen.getByRole('button', { name: bulkSignOut })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: otherSignOut }));
    expect(f.writes()).toHaveLength(1);
    f.controls.failRead = true;
    await act(async () => release());
    await screen.findByText(/Tải lại danh sách để kiểm tra trạng thái/);
    expect(screen.getByText(otherDevice)).toBeTruthy();
    expect(screen.getByRole('button', { name: otherSignOut })).toBeDisabled();
    f.controls.failRead = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() => expect(screen.queryByText(otherDevice)).toBeNull());
    expect(f.writes()).toHaveLength(1);
  } finally {
    release();
    alert.mockRestore();
    await screen.unmount();
  }
});

test('confirmed sign-out of others revokes sequentially and never targets the current session', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture({
    gate,
    initialSessions: [
      ...defaultSessions,
      { ...defaultSessions[1]!, sessionId: 'older', lastActiveAt: '2026-11-03T01:00:00Z' },
    ],
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: bulkSignOut }));
    expect(f.writes()).toHaveLength(0);
    await yes(alert);
    expect(f.writes()).toEqual([{ method: 'DELETE', path: '/auth/sessions/other' }]);
    expect(screen.getByRole('button', { name: bulkSignOut })).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(screen.queryAllByText(otherDevice)).toHaveLength(0));
    expect(f.writes()).toEqual([
      { method: 'DELETE', path: '/auth/sessions/other' },
      { method: 'DELETE', path: '/auth/sessions/older' },
    ]);
    expect(screen.getByText(currentDevice)).toBeTruthy();
    expect(f.token()).not.toBeNull();
  } finally {
    release();
    alert.mockRestore();
    await screen.unmount();
  }
});

test('a partial bulk failure stops at the failed session and requires fresh reconciliation before another batch', async () => {
  const f = fixture({
    initialSessions: [
      ...defaultSessions,
      { ...defaultSessions[1]!, sessionId: 'failed', lastActiveAt: '2026-11-03T01:00:00Z' },
      { ...defaultSessions[1]!, sessionId: 'remaining', lastActiveAt: '2026-11-02T01:00:00Z' },
    ],
  });
  f.controls.failSessionId = 'failed';
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: bulkSignOut }));
    await yes(alert);
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(f.writes()).toEqual([
      { method: 'DELETE', path: '/auth/sessions/other' },
      { method: 'DELETE', path: '/auth/sessions/failed' },
    ]);
    expect(screen.getAllByText(otherDevice)).toHaveLength(3);
    expect(screen.getByRole('button', { name: bulkSignOut })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: bulkSignOut }));
    expect(alert).toHaveBeenCalledTimes(1);
    f.controls.failRead = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: bulkSignOut })).toBeDisabled();
    expect(f.writes()).toHaveLength(2);
    f.controls.failRead = false;
    f.controls.failSessionId = '';
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() => expect(screen.getByRole('button', { name: bulkSignOut })).toBeEnabled());
    expect(screen.getAllByText(otherDevice)).toHaveLength(2);
    expect(f.writes()).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: bulkSignOut }));
    expect(f.writes()).toHaveLength(2);
    await yes(alert);
    await waitFor(() => expect(screen.queryAllByText(otherDevice)).toHaveLength(0));
    expect(f.writes().slice(2)).toEqual([
      { method: 'DELETE', path: '/auth/sessions/failed' },
      { method: 'DELETE', path: '/auth/sessions/remaining' },
    ]);
    expect(f.token()).not.toBeNull();
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test.each([0, 2])(
  'bulk sign-out is unavailable when the server identifies %i current sessions',
  async (count) => {
    const f = fixture({
      initialSessions: defaultSessions.map((session, index) => ({
        ...session,
        isCurrent: index < count,
      })),
    });
    const screen = await open(f);
    try {
      expect(screen.queryByRole('button', { name: bulkSignOut })).toBeNull();
      expect(f.writes()).toHaveLength(0);
      expect(f.token()).not.toBeNull();
    } finally {
      await screen.unmount();
    }
  },
);
