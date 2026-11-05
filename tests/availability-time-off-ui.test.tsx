import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from '../src/core/app-context';
import { ApiClient } from '../src/core/api';
import { Routes } from '../src/app/routes';
import { TimeOffScreen } from '../src/features/availability/screen';

const Stack = createNativeStackNavigator<Routes>();
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
