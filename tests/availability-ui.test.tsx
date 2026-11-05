import React from 'react';
import { Alert } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';
import { vietnamDay } from '../src/core/time';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from '../src/core/app-context';
import { Routes } from '../src/app/routes';
import { ProviderScheduleScreen } from '../src/features/availability/screen';

type Failure = 'network' | 'response' | 'booked' | 'conflict';
function fixture(
  options: {
    failure?: Failure;
    commitOnFailure?: boolean;
    status?: string;
    past?: boolean;
    failReadAfterWrite?: boolean;
    gate?: Promise<void>;
    secondPage?: boolean;
  } = {},
) {
  let slot = {
    id: 'slot',
    workDate: vietnamDay(new Date(Date.now() + (options.past ? -1 : 1) * 86400000)),
    startTime: '13:00:00',
    endTime: '17:04:00',
    scheduleStatus: options.status ?? 'SCHEDULED',
    note: 'Availability note from server',
    cancellationReason: options.status === 'CANCELLED' ? 'Reason from server' : '',
    version: 7,
  };
  const controls = { failure: options.failure, readFailure: false, missing: false };
  const writes: { path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const page = (items: unknown[]) => ({
    items,
    page: 0,
    totalPages: 1,
    totalElements: items.length,
  });
  let token: string | null = 'refresh';
  const api = new ApiClient(
    'http://test',
    { get: async () => token, set: async (value) => void (token = value) },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', fullName: 'Test caregiver', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (path === '/notifications' || path === '/booking-occurrences') result = page([]);
      else if (path === '/caregivers/me/schedules') {
        reads.push(url.searchParams.get('page') ?? '');
        if (controls.readFailure || (options.failReadAfterWrite && writes.length))
          return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        const second = options.secondPage && url.searchParams.get('page') === '0';
        result = {
          items: controls.missing
            ? []
            : second
              ? [{ ...slot, id: 'past', scheduleStatus: 'CANCELLED' }]
              : [slot],
          page: Number(url.searchParams.get('page')),
          totalPages: options.secondPage ? 2 : 1,
          totalElements: options.secondPage ? 2 : controls.missing ? 0 : 1,
        };
      } else if (path === '/caregivers/schedules/slot/status' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { reason: string; version: number };
        writes.push({ path: url.pathname, body });
        await options.gate;
        if (controls.failure === 'booked' || controls.failure === 'conflict') {
          slot = { ...slot, version: 9 };
          return new Response(
            JSON.stringify({ code: controls.failure === 'booked' ? 4415 : 4404 }),
            { status: 409 },
          );
        }
        if (options.commitOnFailure !== false || !controls.failure)
          slot = {
            ...slot,
            scheduleStatus: 'CANCELLED',
            cancellationReason: body.reason,
            version: 8,
          };
        if (controls.failure === 'network') throw new TypeError('Transport interrupted');
        result = controls.failure === 'response' ? { id: 'slot' } : slot;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return { api, controls, writes, reads };
}

async function openAvailability(f: ReturnType<typeof fixture>) {
  const screen = await render(<App client={f.api} />);
  await fireEvent.press(await screen.findByRole('tab', { name: /Lịch rảnh/ }));
  await screen.findByText('Availability note from server');
  return screen;
}

test('cancel action opens a reason modal and only explicit confirmation makes the versioned write', async () => {
  const f = fixture();
  const screen = await openAvailability(f);
  try {
    expect(screen.getByText('Đang mở')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    expect(screen.container.queryAll((node) => node.type === 'Modal')[0]?.props.visible).toBe(true);
    const reason = screen.getByLabelText('Lý do hủy khung rảnh');
    expect(reason.props.maxLength).toBe(500);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await fireEvent.changeText(reason, ' \n ');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    expect(f.writes).toHaveLength(0);
    await fireEvent.changeText(reason, 'a'.repeat(501));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    expect(f.writes).toHaveLength(0);
    await fireEvent.changeText(reason, '  Personal schedule change  ');
    expect(f.writes).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText('Khung rảnh đã được hủy.');
    expect(f.writes).toEqual([
      {
        path: '/api/v1/caregivers/schedules/slot/status',
        body: { status: 'CANCELLED', reason: 'Personal schedule change', version: 7 },
      },
    ]);
    expect(screen.getByText('Đã hủy')).toBeTruthy();
    expect(screen.getByText('Personal schedule change')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy khung rảnh' })).toBeNull();
    expect(f.reads.length).toBeGreaterThan(1);
  } finally {
    await screen.unmount();
  }
});

test('confirmation rechecks the actual Vietnam end boundary even before the next clock render', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-11-03T05:00:00Z'));
  const f = fixture();
  const screen = await openAvailability(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'My reason');
    clock.mockReturnValue(Date.parse('2030-11-04T10:04:00Z'));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    expect(f.writes).toHaveLength(0);
  } finally {
    clock.mockRestore();
    await screen.unmount();
  }
});

test.each([{ status: 'CANCELLED' }, { past: true }, { status: 'NEW_SERVER_STATE' }])(
  'unavailable schedule states expose no cancellation action: %s',
  async (options) => {
    const f = fixture(options);
    const screen = await openAvailability(f);
    try {
      expect(screen.queryByRole('button', { name: 'Hủy khung rảnh' })).toBeNull();
      if (options.status === 'CANCELLED')
        expect(screen.getByText('Reason from server')).toBeTruthy();
      expect(f.writes).toHaveLength(0);
    } finally {
      await screen.unmount();
    }
  },
);

test.each(['network', 'response'] as const)(
  'uncertain %s cancellation retains reason and fresh server cancellation prevents a duplicate',
  async (failure) => {
    const f = fixture({ failure });
    const screen = await openAvailability(f);
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
      await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'Keep my reason');
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      await screen.findByText(/Chưa xác định được kết quả/);
      expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      expect(f.writes).toHaveLength(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
      await screen.findByText('Khung rảnh này đã được hủy trên máy chủ.');
      expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Xác nhận hủy khung rảnh' })).toBeNull();
      expect(f.writes).toHaveLength(1);
    } finally {
      await screen.unmount();
    }
  },
);

test.each(['booked', 'conflict'] as const)(
  '%s conflict blocks repeats and a successful explicit read adopts the fresh version',
  async (failure) => {
    const f = fixture({ failure });
    const screen = await openAvailability(f);
    try {
      await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
      await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'Keep my reason');
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      await screen.findByText(
        failure === 'booked' ? /đã có lịch đặt, không thể hủy/ : /Dữ liệu đã thay đổi/,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      expect(f.writes).toHaveLength(1);
      f.controls.readFailure = true;
      await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Tải lại trạng thái' })).toBeEnabled(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      expect(f.writes).toHaveLength(1);
      f.controls.readFailure = false;
      f.controls.failure = undefined;
      await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' })).toBeEnabled(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
      await screen.findByText('Khung rảnh đã được hủy.');
      expect(f.writes[1]?.body).toMatchObject({ version: 9, reason: 'Keep my reason' });
    } finally {
      await screen.unmount();
    }
  },
);

test('closing a dirty modal asks to discard and reopening cannot clear an uncertain result', async () => {
  const f = fixture({ failure: 'network', commitOnFailure: false });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await openAvailability(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'Keep my reason');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent(screen.container.queryAll((node) => node.type === 'Modal')[0]!, 'requestClose');
    expect(screen.getByDisplayValue('Keep my reason')).toBeTruthy();
    expect(alert).toHaveBeenLastCalledWith(
      'Rời màn hình?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    await act(async () =>
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((button) => button.text === 'Bỏ thay đổi')
        ?.onPress?.(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'New reason');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    expect(f.writes).toHaveLength(1);
    f.controls.missing = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText(
      'Không tìm thấy khung rảnh trong trang vừa tải. Tải lại để kiểm tra trạng thái.',
    );
    expect(screen.getByDisplayValue('New reason')).toBeTruthy();
    expect(f.writes).toHaveLength(1);
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('a pending write locks the reason, close action and duplicate confirmation', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture({ gate });
  const screen = await openAvailability(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'My reason');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await fireEvent(screen.container.queryAll((node) => node.type === 'Modal')[0]!, 'requestClose');
    expect(screen.getByLabelText('Lý do hủy khung rảnh').props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled();
    expect(f.writes).toHaveLength(1);
    await act(async () => release());
    await screen.findByText('Khung rảnh đã được hủy.');
  } finally {
    release();
    await screen.unmount();
  }
});

test('a successful server response stays cancelled when the following list refresh fails', async () => {
  const f = fixture({ failReadAfterWrite: true });
  const screen = await openAvailability(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'My reason');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText('Khung rảnh đã được hủy.');
    expect(screen.getByText('Đã hủy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy khung rảnh' })).toBeNull();
    expect(f.writes).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('cancellation on a later page reconciles that page and never reuses a first-page record', async () => {
  const f = fixture({ secondPage: true, failure: 'conflict' });
  const screen = await openAvailability(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Hủy khung rảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Lý do hủy khung rảnh'), 'My reason');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText(/Dữ liệu đã thay đổi/);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    expect(f.reads.at(-1)).toBe('1');
    f.controls.failure = undefined;
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText('Khung rảnh đã được hủy.');
    expect(f.writes[1]?.body).toMatchObject({ version: 9 });
  } finally {
    await screen.unmount();
  }
});

test('approved-shift link fetches the target schedule beyond page one before withdrawing with its fresh version', async () => {
  const f = fixture({ secondPage: true });
  await f.api.restore();
  const Stack = createNativeStackNavigator<Routes>();
  const screen = await render(
    <AppProvider client={f.api}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="ProviderSchedule"
            initialParams={{ scheduleId: 'slot' }}
            component={ProviderScheduleScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>,
  );
  try {
    await screen.findByLabelText('Lý do hủy khung rảnh');
    expect(f.reads).toContain('1');
    expect(f.writes).toHaveLength(0);
    await fireEvent.changeText(
      screen.getByLabelText('Lý do hủy khung rảnh'),
      'Withdraw approved shift',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy khung rảnh' }));
    await screen.findByText('Khung rảnh đã được hủy.');
    expect(f.writes[0]?.body).toEqual({
      status: 'CANCELLED',
      reason: 'Withdraw approved shift',
      version: 7,
    });
  } finally {
    await screen.unmount();
  }
});
