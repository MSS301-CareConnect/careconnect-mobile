import React from 'react';
import { Alert } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { addDays, formatInstant, mondayOf, vietnamDay } from '../src/core/time';
import * as datePicker from '../src/core/date-picker';
import { Routes } from '../src/app/routes';
import { VisitScreen, VisitsScreen } from '../src/features/visits/screens';
import { displayVisitDate } from '../src/features/visits/period';
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
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture(
  failure?: 'network' | 'unpaid',
  initial: Partial<{
    status: string;
    startAt: string;
    endAt: string;
    checkInOpensAt: string;
    checkInClosesAt: string;
  }> = {},
) {
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
    ...initial,
  };
  const writes: { path: string; body: unknown }[] = [];
  const listReads: URLSearchParams[] = [];
  const listRows: (typeof visit)[] = [];
  const controls = { failure, readFailure: false, commitOnFailure: false };
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/booking-occurrences') {
        const query = url.searchParams;
        listReads.push(query);
        const items = listRows.filter((row) => {
          const day = vietnamDay(new Date(row.startAt));
          return (
            (!query.get('status') || row.status === query.get('status')) &&
            day >= (query.get('from') ?? '') &&
            day <= (query.get('to') ?? '9999-12-31')
          );
        });
        result = { items, page: 0, totalPages: items.length ? 1 : 0, totalElements: items.length };
      } else if (path === '/bookings/caregiver-requests')
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
        visit = path.endsWith('/acknowledge')
          ? { ...visit, status: 'ACKNOWLEDGED' }
          : { ...visit, noShowReportedAt: new Date().toISOString() };
        result = visit;
      }
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, writes, controls, listReads, listRows, visit };
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
    expect(screen.queryByRole('button', { name: 'Nhận buổi' })).toBeNull();
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
test('accepting a future visit reveals a disabled opens-at action, with no care-session write', async () => {
  const now = Date.now();
  const opens = new Date(now + 90 * 60000).toISOString();
  const f = fixture(undefined, {
    startAt: new Date(now + 120 * 60000).toISOString(),
    endAt: new Date(now + 240 * 60000).toISOString(),
    checkInOpensAt: opens,
    checkInClosesAt: new Date(now + 150 * 60000).toISOString(),
  });
  const screen = await open(f);
  try {
    expect(screen.queryByRole('button', { name: 'Bắt đầu chăm sóc' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mở lúc/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Nhận buổi' }));
    const label =
      'Mở lúc ' +
      formatInstant(opens, 'vi', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    const button = await screen.findByRole('button', { name: label });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Nhận buổi' })).toBeNull();
    expect(f.writes).toEqual([{ path: '/booking-occurrences/v/acknowledge', body: undefined }]);
    await fireEvent.press(button);
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('unpaid care start gives actionable payment guidance without a simulated session', async () => {
  const f = fixture('unpaid', { status: 'ACKNOWLEDGED' });
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
test('assigned visits embeds customer requests only in the response tab', async () => {
  const f = fixture();
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <ListSubject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  try {
    expect(screen.queryByRole('button', { name: 'Yêu cầu từ khách' })).toBeNull();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Cần phản hồi' }));
    await screen.findByText('Không có yêu cầu đang chờ trả lời.');
    expect(
      screen.getByText('Khách hàng đã chọn bạn. Trả lời trước hạn để khách tiếp tục thanh toán.'),
    ).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('cancelled tab shows cancelled visits and filters by Vietnam week, month and selected dates', async () => {
  const f = fixture();
  const day = vietnamDay();
  for (const [status, recipientName] of [
    ['CANCELLED', 'Ca đã hủy'],
    ['EXPIRED', 'Ca hết hạn'],
    ['COMPLETED', 'Ca hoàn thành'],
  ] as const) {
    f.listRows.push({
      ...f.visit,
      id: status,
      recipientName,
      status,
      startAt: day + 'T10:00:00+07:00',
    });
  }
  const picker = jest.spyOn(datePicker, 'pickCalendarDate').mockResolvedValue(day);
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <ListSubject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: 'Đã hủy' }));
    await screen.findByText('Ca đã hủy');
    expect(screen.queryByText('Ca hết hạn')).toBeNull();
    expect(screen.queryByText('Ca hoàn thành')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Lịch sử' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tháng này' })).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(f.listReads.at(-1)?.get('from')).toBe(day.slice(0, 7) + '-01');
    expect(f.listReads.at(-1)?.get('status')).toBe('CANCELLED');

    await fireEvent.press(screen.getByRole('button', { name: 'Tuần này' }));
    await screen.findByText('Ca đã hủy');
    expect(f.listReads.at(-1)?.get('from')).toBe(mondayOf(day));
    expect(f.listReads.at(-1)?.get('to')).toBe(addDays(mondayOf(day), 6));

    await fireEvent.press(screen.getByRole('button', { name: 'Tùy chọn' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày bắt đầu' }));
    expect(picker).toHaveBeenCalledWith(
      addDays(day, -30),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Từ ngày')).toHaveProp('value', displayVisitDate(day)),
    );
    expect(f.listReads.at(-1)?.get('from')).toBe(day);
    expect(f.listReads.at(-1)?.get('to')).toBe(day);
    expect(f.listReads.at(-1)?.get('status')).toBe('CANCELLED');

    const reads = f.listReads.length;
    await fireEvent.changeText(screen.getByLabelText('Từ ngày'), '31/02/2026');
    await screen.findByText('Nhập ngày hợp lệ theo DD/MM/YYYY.');
    expect(f.listReads).toHaveLength(reads);
  } finally {
    picker.mockRestore();
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
