import React from 'react';
import { Alert } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { Routes } from '../src/app/routes';
import { VisitScreen, VisitsScreen } from '../src/features/visits/screens';
import { BookingRequestsScreen } from '../src/features/booking-requests/screen';
const Stack = createNativeStackNavigator<Routes>();
function Subject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Visit" component={VisitScreen} initialParams={{ id: 'v' }} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function ListSubject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={VisitsScreen} />
        <Stack.Screen name="BookingRequests" component={BookingRequestsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture(failure?: 'network' | 'unpaid') {
  const now = Date.now();
  let visit = {
    id: 'v',
    bookingId: 'b',
    recipientName: 'Recipient',
    startAt: new Date(now - 60000).toISOString(),
    endAt: new Date(now + 3600000).toISOString(),
    checkInOpensAt: new Date(now - 10 * 60000).toISOString(),
    checkInClosesAt: new Date(now + 9 * 60000).toISOString(),
    status: 'SCHEDULED',
    noShowReportedAt: '',
  };
  const writes: { path: string; body: unknown }[] = [];
  const controls = { failure, readFailure: false, commitOnFailure: false };
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input, init) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/booking-occurrences' || path === '/bookings/caregiver-requests')
        result = { items: [], page: 0, totalPages: 0, totalElements: 0 };
      else if (init?.method === 'GET') {
        if (controls.readFailure)
          return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        result = visit;
      } else {
        writes.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (controls.failure === 'network') {
          if (controls.commitOnFailure)
            visit = { ...visit, noShowReportedAt: new Date().toISOString() };
          throw new TypeError('network');
        }
        if (controls.failure === 'unpaid')
          return new Response(JSON.stringify({ code: 5242 }), { status: 409 });
        visit = { ...visit, noShowReportedAt: new Date().toISOString() };
        result = visit;
      }
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, writes, controls };
}
async function open(f: ReturnType<typeof fixture>) {
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Recipient');
  return screen;
}
test('started visits hide acknowledgment, validate absence details and await the center after reporting', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    expect(screen.queryByRole('button', { name: 'Xác nhận nhận ca' })).toBeNull();
    expect(screen.getByText('Check-in đóng lúc')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Báo khách vắng mặt' }));
    await fireEvent.changeText(screen.getByLabelText('Mô tả khách vắng mặt'), 'short');
    expect(screen.getByRole('button', { name: 'Gửi báo vắng mặt' })).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('Mô tả khách vắng mặt'),
      '  Waited and called customer  ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    await screen.findByText('Đã báo khách vắng mặt. Đang chờ trung tâm quyết định.');
    expect(f.writes).toEqual([
      {
        path: '/booking-occurrences/v/no-show-reports',
        body: { note: 'Waited and called customer' },
      },
    ]);
    expect(screen.queryByRole('button', { name: 'Bắt đầu chăm sóc' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});
test('unknown absence write retains the note and requires refresh even after modal discard', async () => {
  const f = fixture('network');
  const screen = await open(f);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Báo khách vắng mặt' }));
    await fireEvent.changeText(
      screen.getByLabelText('Mô tả khách vắng mặt'),
      'Waited and called customer',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByDisplayValue('Waited and called customer')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    await act(async () =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((b) => b.text === 'Bỏ thay đổi')
        ?.onPress?.(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Báo khách vắng mặt' }));
    await fireEvent.changeText(
      screen.getByLabelText('Mô tả khách vắng mặt'),
      'Another contact attempt',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    expect(f.writes).toHaveLength(1);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});
test('unpaid care start gives actionable payment guidance without a simulated session', async () => {
  const f = fixture('unpaid');
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Bắt đầu chăm sóc' }));
    await screen.findByText(
      'Khách chưa thanh toán đủ. Chờ khách hoàn tất thanh toán rồi tải lại trạng thái; bạn chưa thể bắt đầu ca.',
    );
    expect(f.writes).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Mở ca chăm sóc' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});
test('failed reconciliation keeps the absence note and uncertain latch until a successful fresh read', async () => {
  const f = fixture('network');
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Báo khách vắng mặt' }));
    await fireEvent.changeText(
      screen.getByLabelText('Mô tả khách vắng mặt'),
      'Waited and called customer',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    f.controls.readFailure = true;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tải lại trạng thái' }).at(-1)!);
    expect(screen.getByDisplayValue('Waited and called customer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi báo vắng mặt' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
    f.controls.readFailure = false;
    f.controls.failure = undefined;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tải lại trạng thái' }).at(-1)!);
    expect(screen.getByRole('button', { name: 'Gửi báo vắng mặt' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    await screen.findByText('Đã báo khách vắng mặt. Đang chờ trung tâm quyết định.');
    expect(f.writes).toHaveLength(2);
  } finally {
    await screen.unmount();
  }
});
test('assigned visits provides a separate customer-request destination', async () => {
  const f = fixture();
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <ListSubject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  try {
    await fireEvent.press(await screen.findByRole('button', { name: 'Yêu cầu từ khách' }));
    await screen.findByText('Không có yêu cầu đang chờ trả lời.');
    expect(
      screen.getByText('Khách hàng đã chọn bạn. Trả lời trước hạn để khách tiếp tục thanh toán.'),
    ).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
test('reconciliation adopts an absence report committed before a lost response without replaying it', async () => {
  const f = fixture('network');
  f.controls.commitOnFailure = true;
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Báo khách vắng mặt' }));
    await fireEvent.changeText(
      screen.getByLabelText('Mô tả khách vắng mặt'),
      'Waited and called customer',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo vắng mặt' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Đã báo khách vắng mặt. Đang chờ trung tâm quyết định.');
    expect(screen.queryByLabelText('Mô tả khách vắng mặt')).toBeNull();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});
