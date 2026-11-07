import React from 'react';
import { NativeModules } from 'react-native';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from '../src/core/app-context';
import { ApiClient } from '../src/core/api';
import { Routes } from '../src/app/routes';
import { TimeOffScreen } from '../src/features/availability/screen';

const Stack = createNativeStackNavigator<Routes>();
const originalDatePicker: unknown = NativeModules.CareConnectDatePicker;
afterEach(() => {
  NativeModules.CareConnectDatePicker = originalDatePicker;
});
function fixture(uncertain = false) {
  const items: unknown[] = [];
  const writes: { method: string; path: string; body: unknown }[] = [];
  let token: string | null = 'refresh';
  const api = new ApiClient(
    'http://test',
    { get: async () => token, set: async (value) => void (token = value) },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'access', refreshToken: 'refresh' };
      else if (path === '/users/me')
        result = { id: 'user', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/caregivers/me') result = { id: 'caregiver' };
      else if (path === '/caregivers/caregiver/time-offs') {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          writes.push({ method: 'POST', path, body });
          const item = { ...body, id: 'off', caregiverId: 'caregiver', version: 0 };
          items.push(item);
          if (uncertain) throw new TypeError('Uncertain transport');
          result = item;
        } else result = items;
      } else if (path === '/caregivers/caregiver/time-offs/off' && init?.method === 'DELETE') {
        writes.push({ method: 'DELETE', path: url.pathname + url.search, body: init.body });
        items.length = 0;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return {
    api,
    writes,
    removeOnServer: () => {
      items.length = 0;
    },
  };
}
async function open(f: ReturnType<typeof fixture>) {
  await f.api.restore();
  const screen = await render(
    <AppProvider client={f.api}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="TimeOff">
          <Stack.Screen name="TimeOff" component={TimeOffScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>,
  );
  await screen.findByText('Chưa có ngày nghỉ sắp tới.');
  await fireEvent.press(screen.getByRole('button', { name: 'Thêm ngày nghỉ' }));
  await fireEvent.changeText(screen.getByLabelText('Lý do (không bắt buộc)'), 'Keep my reason');
  return screen;
}
test('unknown create result preserves time-off form and server reconciliation prevents duplicate writes', async () => {
  const f = fixture(true);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(f.writes).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Khoảng nghỉ này đã có trên máy chủ. Đóng biểu mẫu để tiếp tục.');
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('time-off delete requires explicit confirmation and does not invent a version parameter', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('Đã khai báo ngày nghỉ.');
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa ngày nghỉ' }));
    expect(f.writes).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await screen.findByText('Đã xóa ngày nghỉ.');
    expect(f.writes[1]).toMatchObject({
      method: 'DELETE',
      path: '/api/v1/caregivers/caregiver/time-offs/off',
    });
  } finally {
    await screen.unmount();
  }
});

test('editing a note after an uncertain create cannot hide the attempted time-off during reconciliation', async () => {
  const f = fixture(true);
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent.changeText(
      screen.getByLabelText('Lý do (không bắt buộc)'),
      'Changed local reason',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Khoảng nghỉ này đã có trên máy chủ. Đóng biểu mẫu để tiếp tục.');
    expect(screen.getByDisplayValue('Changed local reason')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('a later authoritative refresh removes time off deleted by another authorized session', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('Đã khai báo ngày nghỉ.');
    f.removeOnServer();
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Chưa có ngày nghỉ sắp tới.');
    expect(screen.queryByRole('button', { name: 'Xóa ngày nghỉ' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});

test('calendar buttons choose both dates without saving and preserve the Vietnam whole-day payload', async () => {
  const pick = jest.fn(async () => '2030-03-01');
  pick.mockResolvedValueOnce('2030-03-01').mockResolvedValueOnce('2030-03-02');
  NativeModules.CareConnectDatePicker = { pick };
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày bắt đầu' }));
    await screen.findByDisplayValue('2030-03-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày kết thúc' }));
    await screen.findByDisplayValue('2030-03-02');
    expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
    expect(f.writes).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('Đã khai báo ngày nghỉ.');
    expect(f.writes[0]?.body).toEqual({
      startAt: '2030-02-28T17:00:00.000Z',
      endAt: '2030-03-02T17:00:00.000Z',
      reason: 'Keep my reason',
    });
  } finally {
    await screen.unmount();
  }
});

test('an open calendar locks save and repeated opens; cancelling leaves form content intact', async () => {
  let finish: ((result: unknown) => void) | undefined;
  const pick = jest.fn(
    () =>
      new Promise<unknown>((resolve) => {
        finish = resolve;
      }),
  );
  NativeModules.CareConnectDatePicker = { pick };
  const f = fixture();
  const screen = await open(f);
  try {
    const initialDate: unknown = screen.getByLabelText('Từ ngày (YYYY-MM-DD)').props.value;
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày bắt đầu' }));
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chọn ngày kết thúc' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày kết thúc' }));
    expect(pick).toHaveBeenCalledTimes(1);
    await act(async () => finish?.(null));
    expect(screen.getByLabelText('Từ ngày (YYYY-MM-DD)').props.value).toBe(initialDate);
    expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu' })).not.toBeDisabled();
    expect(f.writes).toHaveLength(0);
  } finally {
    await screen.unmount();
  }
});

test('unavailable calendar keeps manual date entry usable and does not invent a selected date', async () => {
  NativeModules.CareConnectDatePicker = undefined;
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ngày bắt đầu' }));
    await screen.findByText('Chưa mở được lịch. Bạn có thể nhập ngày theo YYYY-MM-DD.');
    expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Từ ngày (YYYY-MM-DD)'), '2030-03-01');
    await fireEvent.changeText(screen.getByLabelText('Đến ngày (YYYY-MM-DD)'), '2030-03-01');
    expect(
      screen.queryByText('Chưa mở được lịch. Bạn có thể nhập ngày theo YYYY-MM-DD.'),
    ).toBeNull();
    expect(f.writes).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('Đã khai báo ngày nghỉ.');
    expect(f.writes[0]?.body).toEqual({
      startAt: '2030-02-28T17:00:00.000Z',
      endAt: '2030-03-01T17:00:00.000Z',
      reason: 'Keep my reason',
    });
  } finally {
    await screen.unmount();
  }
});
