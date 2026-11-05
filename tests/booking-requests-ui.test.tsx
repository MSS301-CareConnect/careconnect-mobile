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
import { BookingRequestsScreen } from '../src/features/booking-requests/screen';

const Stack = createNativeStackNavigator<Routes>();
function Subject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="BookingRequests" component={BookingRequestsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture(failure?: 'network' | 'deadline', gate?: Promise<void>) {
  const controls = { failure, present: true, manyPages: false, expired: false };
  const writes: { path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const request = {
    id: 'b',
    bookingCode: 'BK-123',
    status: 'PENDING_CAREGIVER_CONFIRMATION',
    bookingType: 'RECURRING',
    district: 'Safe area',
    acceptanceDueAt: '2099-01-01T01:00:00Z',
    totalAmount: 90000,
    occurrences: [{ id: 'v', startAt: '2099-01-03T01:00:00Z', endAt: '2099-01-03T03:00:00Z' }],
    recipientAge: 72,
    recipientGender: 'FEMALE',
  };
  const client = new ApiClient(
    'http://test',
    { get: async () => 'refresh', set: async () => undefined },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/bookings/caregiver-requests') {
        reads.push(url.searchParams.get('page') ?? '');
        const p = Number(url.searchParams.get('page'));
        const item = {
          ...request,
          ...(controls.expired ? { acceptanceDueAt: '2000-01-01T01:00:00Z' } : {}),
          ...(p ? { id: 'b2', bookingCode: 'BK-2', district: 'Second area' } : {}),
        };
        result = {
          items: controls.present ? [item] : [],
          page: p,
          totalPages: controls.manyPages ? 2 : 1,
          totalElements: controls.present ? (controls.manyPages ? 2 : 1) : 0,
        };
      } else {
        writes.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        await gate;
        if (controls.failure === 'network') throw new TypeError('network');
        if (controls.failure === 'deadline') {
          controls.present = false;
          return new Response(JSON.stringify({ code: 5116 }), { status: 409 });
        }
        controls.present = false;
        result = {
          ...request,
          status: path.endsWith('caregiver-decline')
            ? 'PENDING_CAREGIVER_ASSIGNMENT'
            : 'AWAITING_INITIAL_PAYMENT',
        };
      }
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, controls, writes, reads };
}
async function open(f: ReturnType<typeof fixture>) {
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Safe area');
  return screen;
}
test('accepting requires confirmation and reports waiting for customer payment', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Nhận yêu cầu' }));
    expect(f.writes).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận nhận yêu cầu' }));
    await screen.findByText(
      'Đã nhận yêu cầu. Chờ khách hàng thanh toán để lịch chăm sóc được xác nhận.',
    );
    expect(f.writes).toEqual([{ path: '/bookings/b/caregiver-accept', body: undefined }]);
    expect(screen.queryByRole('button', { name: 'Nhận yêu cầu' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});
test('failed decline retains its reason and closing the form cannot unlock an uncertain decision', async () => {
  const f = fixture('network');
  const screen = await open(f);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối yêu cầu' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do từ chối'), 'Family commitment');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByDisplayValue('Family commitment')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    await act(async () =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((b) => b.text === 'Bỏ thay đổi')
        ?.onPress?.(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối yêu cầu' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do từ chối'), 'Another commitment');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(f.writes).toHaveLength(1);
    f.controls.failure = undefined;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await screen.findByText('Đã từ chối. Trung tâm sẽ phân công người chăm sóc khác.');
    expect(f.writes).toHaveLength(2);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});
test('deadline conflict explains a possible handover and reconciles without another decision', async () => {
  const f = fixture('deadline');
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Nhận yêu cầu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận nhận yêu cầu' }));
    await screen.findByText(
      'Yêu cầu không còn chờ trả lời. Có thể đã hết hạn hoặc chuyển về trung tâm. Hãy tải lại trạng thái.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Không có yêu cầu đang chờ trả lời.');
    expect(f.writes).toHaveLength(1);
    expect(f.reads.length).toBeGreaterThan(1);
  } finally {
    await screen.unmount();
  }
});
test('a pending request decision locks form, close and repeated confirmation', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = fixture(undefined, gate);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối yêu cầu' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do từ chối'), 'Family commitment');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(screen.getByLabelText('Lý do từ chối').props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
    await act(async () => release());
    await screen.findByText('Đã từ chối. Trung tâm sẽ phân công người chăm sóc khác.');
  } finally {
    release();
    await screen.unmount();
  }
});
test('request pages follow server totals and show later-page requests', async () => {
  const f = fixture();
  f.controls.manyPages = true;
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await screen.findByText('Second area');
    expect(f.reads).toEqual(['0', '1']);
    expect(screen.queryByText('Safe area')).toBeNull();
  } finally {
    await screen.unmount();
  }
});
test('an elapsed answer deadline disables both decisions and offers a fresh read', async () => {
  const f = fixture();
  f.controls.expired = true;
  const screen = await open(f);
  try {
    expect(screen.getByRole('button', { name: 'Nhận yêu cầu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Từ chối yêu cầu' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Nhận yêu cầu' }));
    expect(f.writes).toHaveLength(0);
    expect(
      screen.getByText('Đã đến hạn trả lời. Tải lại để kiểm tra trạng thái mới nhất.'),
    ).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
test('an unresolved decision cannot switch to another request before reconciliation', async () => {
  const f = fixture('network');
  f.controls.manyPages = true;
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Nhận yêu cầu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận nhận yêu cầu' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await screen.findByText('Second area');
    expect(screen.getByRole('button', { name: 'Nhận yêu cầu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Từ chối yêu cầu' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});
test('a request no longer pending after reconciliation retains the failed decline reason for review', async () => {
  const f = fixture('network');
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối yêu cầu' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do từ chối'), 'Family commitment');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    f.controls.present = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    expect(screen.getByDisplayValue('Family commitment')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xác nhận từ chối' })).toBeDisabled();
    expect(
      screen.queryByText('Đã từ chối. Trung tâm sẽ phân công người chăm sóc khác.'),
    ).toBeNull();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});
