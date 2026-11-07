import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';
import { vietnamDay } from '../src/core/time';

const page = (items: unknown[]) => ({ items, page: 0, totalPages: 1, totalElements: items.length });
function fixture(
  options: {
    status?: string;
    eligible?: boolean;
    centerActive?: boolean;
    uncertain?: boolean;
    cancelConflict?: boolean;
    malformed?: boolean;
    shiftUnavailable?: boolean;
  } = {},
) {
  let registration = options.status
    ? {
        id: 'registration',
        workShiftId: 'shift',
        registrationStatus: options.status,
        caregiverNote: 'Test registration note',
        version: 7,
        rejectionReason: 'Test rejection reason',
      }
    : undefined;
  let posts = 0;
  let deletes = 0;
  const requests: { method?: string; path: string; query: string }[] = [];
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
      requests.push({ method: init?.method, path, query: url.search });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', fullName: 'Test caregiver', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/caregivers/me')
        result = {
          id: 'caregiver',
          centerName: 'Test center',
          centerStatus: options.centerActive === false ? 'INACTIVE' : 'ACTIVE',
          caregiverStatus: options.eligible === false ? 'INACTIVE' : 'ACTIVE',
          verificationStatus: 'VERIFIED',
        };
      else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (path === '/notifications' || path === '/booking-occurrences') result = page([]);
      else if (path === '/caregivers/me/schedules') result = page([]);
      else if (path === '/caregivers/caregiver/time-offs') result = [];
      else if (path === '/work-shifts/registrations/me') {
        const status = url.searchParams.get('status');
        result = page(
          registration && (!status || registration.registrationStatus === status)
            ? [registration]
            : [],
        );
      } else if (path === '/work-shifts/shift/registrations') {
        posts++;
        const body = JSON.parse(String(init?.body)) as { caregiverNote?: string };
        expect(Object.keys(body)).toEqual(['caregiverNote']);
        registration = {
          id: 'registration',
          workShiftId: 'shift',
          registrationStatus: 'PENDING',
          caregiverNote: body.caregiverNote ?? '',
          version: 7,
          rejectionReason: '',
        };
        if (options.uncertain) throw new TypeError('Network interrupted');
        result = options.malformed ? { id: 'created' } : registration;
      } else if (path === '/work-shifts/registrations/registration' && init?.method === 'DELETE') {
        deletes++;
        expect(url.searchParams.get('version')).toBe('7');
        if (options.cancelConflict) {
          if (registration)
            registration = { ...registration, registrationStatus: 'APPROVED', version: 8 };
          return new Response(JSON.stringify({ code: 4352 }), { status: 409 });
        }
        if (registration)
          registration = { ...registration, registrationStatus: 'CANCELLED', version: 8 };
      } else if (path === '/work-shifts/shift' && options.shiftUnavailable) {
        return new Response(JSON.stringify({ code: 4300 }), { status: 404 });
      } else if (path === '/work-shifts' || path === '/work-shifts/shift') {
        const shift = {
          id: 'shift',
          centerId: 'center',
          centerName: 'Test center',
          workDate: vietnamDay(new Date(Date.now() + 86400000)),
          startTime: '13:00:00',
          endTime: '17:04:00',
          shiftType: 'TEST SHIFT',
          shiftStatus: 'OPEN',
          capacity: 2,
          approvedCount: 0,
          version: 1,
          note: 'Test shift note',
        };
        if (path === '/work-shifts') {
          const from = url.searchParams.get('fromDate');
          const to = url.searchParams.get('toDate');
          const shifts = [
            {
              ...shift,
              id: 'past',
              shiftType: 'PAST SHIFT',
              workDate: vietnamDay(new Date(Date.now() - 86400000)),
            },
            shift,
          ].filter((item) => (!from || item.workDate >= from) && (!to || item.workDate <= to));
          const size = Number(url.searchParams.get('size') ?? 20);
          result = { ...page(shifts.slice(0, size)), totalElements: shifts.length };
        } else result = shift;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return { api, requests, counts: () => ({ posts, deletes }) };
}
async function openBoard(api: ApiClient) {
  const screen = await render(<App client={api} />);
  await fireEvent.press(await screen.findByRole('tab', { name: /Lịch làm việc/ }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký ca' }));
  return screen;
}
async function openShift(api: ApiClient, view: 'open' | 'pending' = 'open') {
  const screen = await openBoard(api);
  if (view === 'pending') await fireEvent.press(screen.getByRole('tab', { name: 'Chờ duyệt' }));
  const name = view === 'pending' ? /^Xem chi tiết ca, .*Đang chờ trung tâm duyệt$/ : 'Đăng ký ca';
  await fireEvent.press(await screen.findByRole('button', { name }));
  await screen.findByText('Test shift note');
  return screen;
}

test.each(['Xem chi tiết ca', 'Đăng ký ca'])(
  'an open shift exposes a separate detail link and register action; %s opens without a write',
  async (action) => {
    const f = fixture();
    const screen = await openBoard(f.api);
    try {
      await screen.findByText('TEST SHIFT');
      expect(screen.getByRole('button', { name: 'Xem chi tiết ca' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Đăng ký ca' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: action }));
      await screen.findByLabelText('Ghi chú đăng ký (không bắt buộc)');
      expect(f.counts()).toEqual({ posts: 0, deletes: 0 });
    } finally {
      await screen.unmount();
    }
  },
);

test('an already registered shift moves from Open to Pending and opens from its card', async () => {
  const f = fixture({ status: 'PENDING' });
  const screen = await openBoard(f.api);
  try {
    await screen.findByText('Hiện chưa có ca nào đang mở');
    expect(screen.queryByText('TEST SHIFT')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng ký ca' })).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Chờ duyệt' }));
    const card = await screen.findByRole('button', {
      name: /^Xem chi tiết ca, .*13:00–17:04, Đang chờ trung tâm duyệt$/,
    });
    expect(screen.queryByRole('button', { name: 'Xem chi tiết ca' })).toBeNull();
    await fireEvent.press(card);
    await screen.findByRole('button', { name: 'Hủy đăng ký' });
    expect(f.counts()).toEqual({ posts: 0, deletes: 0 });
  } finally {
    await screen.unmount();
  }
});

test('registering sends a note, remains pending, and cancellation needs confirmation plus version', async () => {
  const f = fixture();
  const screen = await openShift(f.api);
  try {
    await fireEvent.changeText(
      await screen.findByLabelText('Ghi chú đăng ký (không bắt buộc)'),
      'Test registration note',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký cho trung tâm' }));
    await screen.findByText('Đang chờ trung tâm duyệt');
    expect(screen.queryByLabelText('Ghi chú đăng ký (không bắt buộc)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    expect(f.counts().deletes).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    await screen.findByText('Đã hủy đăng ký');
    expect(f.counts()).toEqual({ posts: 1, deletes: 1 });
    expect(await screen.findByRole('button', { name: 'Gửi đăng ký cho trung tâm' })).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test.each(['network', 'response'])(
  'an uncertain %s registration retains the note and blocks duplicate writes until a fresh read',
  async (failure) => {
    const f = fixture({ uncertain: failure === 'network', malformed: failure === 'response' });
    const screen = await openShift(f.api);
    try {
      await fireEvent.changeText(
        await screen.findByLabelText('Ghi chú đăng ký (không bắt buộc)'),
        'Keep this note',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký cho trung tâm' }));
      await screen.findByText(/Chưa xác định được kết quả/);
      expect(screen.getByDisplayValue('Keep this note')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Gửi đăng ký cho trung tâm' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký cho trung tâm' }));
      expect(f.counts().posts).toBe(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
      await screen.findByText('Đang chờ trung tâm duyệt');
      expect(screen.queryByRole('button', { name: 'Gửi đăng ký cho trung tâm' })).toBeNull();
    } finally {
      await screen.unmount();
    }
  },
);

test('approved registration is read-only and reachable from my registrations', async () => {
  const f = fixture({ status: 'APPROVED' });
  const screen = await openBoard(f.api);
  try {
    await fireEvent.press(screen.getByRole('tab', { name: 'Đã duyệt' }));
    await screen.findByText('Đã duyệt đăng ký');
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', {
        name: /^Xem chi tiết ca, .*13:00–17:04, Đã duyệt đăng ký$/,
      }),
    );
    await screen.findByText('Đã duyệt đăng ký');
    expect(screen.getByText('Test registration note')).toBeTruthy();
    expect(screen.getByText('Test rejection reason')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy đăng ký' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gửi đăng ký cho trung tâm' })).toBeNull();
    expect(f.counts()).toEqual({ posts: 0, deletes: 0 });
  } finally {
    await screen.unmount();
  }
});

test.each([{ eligible: false }, { centerActive: false }])(
  'inactive caregiver or center blocks registration: %s',
  async (options) => {
    const f = fixture(options);
    const screen = await openBoard(f.api);
    try {
      const register = await screen.findByRole('button', { name: 'Đăng ký ca' });
      expect(register).toBeDisabled();
      await fireEvent.press(await screen.findByRole('button', { name: 'Xem chi tiết ca' }));
      const submit = await screen.findByRole('button', { name: 'Gửi đăng ký cho trung tâm' });
      expect(submit).toBeDisabled();
      await fireEvent.press(submit);
      expect(f.counts().posts).toBe(0);
    } finally {
      await screen.unmount();
    }
  },
);

test('a concurrent approval prevents cancellation and refresh reconciles the approved state', async () => {
  const f = fixture({ status: 'PENDING', cancelConflict: true });
  const screen = await openShift(f.api, 'pending');
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    await screen.findByText(/^Chỉ đăng ký đang chờ duyệt mới được hủy\. Hãy tải lại trạng thái\./);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    expect(f.counts().deletes).toBe(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Đã duyệt đăng ký');
    expect(screen.queryByRole('button', { name: 'Hủy đăng ký' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xác nhận hủy đăng ký' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});

test('my pending registration can still be cancelled when its shift is unavailable', async () => {
  const f = fixture({ status: 'PENDING', shiftUnavailable: true });
  const screen = await openBoard(f.api);
  try {
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }));
    await screen.findByText('Đang chờ trung tâm duyệt');
    await fireEvent.press(
      screen.getByRole('button', {
        name: /^Xem chi tiết ca, Chưa tải được thông tin ca này.*Đang chờ trung tâm duyệt$/,
      }),
    );
    await screen.findByText('Chưa tải được thông tin ca này. Tải lại để kiểm tra.');
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    await screen.findByText('Đã hủy đăng ký');
    expect(screen.queryByRole('button', { name: 'Gửi đăng ký cho trung tâm' })).toBeNull();
    expect(f.counts()).toEqual({ posts: 0, deletes: 1 });
  } finally {
    await screen.unmount();
  }
});

test('four primary tabs keep registration and day agenda inside work schedule, separate from visit filters', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await screen.findByRole('tab', { name: /Buổi được giao/ });
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    await fireEvent.press(await screen.findByRole('tab', { name: /Buổi được giao/ }));
    expect(screen.queryByRole('button', { name: 'Đăng ký ca làm việc' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lịch được trung tâm phân công' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Cần phản hồi' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: /Lịch làm việc/ }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký ca' }));
    await screen.findByText('TEST SHIFT');
    expect(screen.queryByText('PAST SHIFT')).toBeNull();
    expect(f.requests.filter((request) => request.path === '/work-shifts')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: expect.stringContaining(`fromDate=${vietnamDay()}`),
        }),
      ]),
    );
    expect(screen.getByText('13:00–17:04')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng ký ca' })).toBeTruthy();
    for (const name of ['Ca mở', 'Chờ duyệt', 'Đã duyệt', 'Lịch sử'])
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch theo ngày' }));
    await screen.findByText('Không có hoạt động trong ngày này.');
  } finally {
    await screen.unmount();
  }
});

test('visit filter drafts apply together and completed history remains accessible', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Buổi được giao/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bộ lọc buổi chăm sóc' }));
    const before = f.requests.filter((r) => r.path === '/booking-occurrences').length;
    await fireEvent.changeText(screen.getByLabelText('Từ ngày (YYYY-MM-DD)'), '2026-11-02');
    await fireEvent.changeText(screen.getByLabelText('Đến ngày (YYYY-MM-DD)'), '2026-11-03');
    await fireEvent.press(screen.getByRole('button', { name: 'Đã nhận ca' }));
    expect(f.requests.filter((r) => r.path === '/booking-occurrences')).toHaveLength(before);
    await fireEvent.press(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
    await waitFor(() =>
      expect(
        f.requests.some(
          (r) =>
            r.path === '/booking-occurrences' &&
            r.query.includes('from=2026-11-02') &&
            r.query.includes('to=2026-11-03') &&
            r.query.includes('status=ACKNOWLEDGED'),
        ),
      ).toBe(true),
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }));
    await waitFor(() => {
      const request = f.requests.filter((r) => r.path === '/booking-occurrences').at(-1);
      expect(request?.query).toContain('status=COMPLETED');
      expect(request?.query).not.toContain('from=');
      expect(request?.query).not.toContain('to=');
    });
  } finally {
    await screen.unmount();
  }
});
