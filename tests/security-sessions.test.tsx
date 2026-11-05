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
function fixture({ failWrite = false, gate }: { failWrite?: boolean; gate?: Promise<void> } = {}) {
  let token: string | null = 'refresh';
  let sessions = [
    {
      sessionId: 'current',
      deviceId: 'My Android',
      userAgent: 'Android app',
      createdAt: '2026-11-01T00:00:00Z',
      lastActiveAt: '2026-11-05T01:00:00Z',
      isCurrent: true,
    },
    {
      sessionId: 'other',
      deviceId: 'Other phone',
      userAgent: 'Other Android app',
      createdAt: '2026-11-01T00:00:00Z',
      lastActiveAt: '2026-11-04T01:00:00Z',
      isCurrent: false,
    },
  ];
  const calls: { method: string; path: string }[] = [];
  const controls = { failWrite, failRead: false };
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
        if (controls.failWrite) throw new TypeError('Interrupted');
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
  await screen.findByText('Other Android app');
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
    await fireEvent.press(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' }));
    expect(f.writes()).toHaveLength(0);
    await yes(alert);
    await waitFor(() => expect(screen.queryByText('Other Android app')).toBeNull());
    expect(f.writes()).toEqual([{ method: 'DELETE', path: '/auth/sessions/other' }]);
    expect(f.token()).not.toBeNull();
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('revoking the current session clears memory and secure token without a second logout request', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Thu hồi phiên: My Android' }));
    await yes(alert);
    await screen.findByText('Signed out');
    expect(f.token()).toBeNull();
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
    await fireEvent.press(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' }));
    await yes(alert);
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByText('Other Android app')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' })).toBeDisabled();
    f.controls.failRead = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' })).toBeDisabled();
    f.controls.failRead = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' })).toBeEnabled(),
    );
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
    await fireEvent.press(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' }));
    await yes(alert);
    expect(screen.getByRole('button', { name: 'Thu hồi phiên: My Android' })).toBeDisabled();
    f.controls.failRead = true;
    await act(async () => release());
    await screen.findByText(/Tải lại danh sách để kiểm tra trạng thái/);
    expect(screen.getByText('Other Android app')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thu hồi phiên: Other phone' })).toBeDisabled();
    f.controls.failRead = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại phiên đăng nhập' }));
    await waitFor(() => expect(screen.queryByText('Other Android app')).toBeNull());
    expect(f.writes()).toHaveLength(1);
  } finally {
    release();
    alert.mockRestore();
    await screen.unmount();
  }
});
