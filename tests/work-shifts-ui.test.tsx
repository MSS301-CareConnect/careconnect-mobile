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
      if (
        path === '/work-shifts' &&
        (url.searchParams.has('fromDate') || url.searchParams.has('toDate'))
      )
        return new Response(JSON.stringify({ code: 4004 }), { status: 503 });
      requests.push({ method: init?.method, path, query: url.search });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', fullName: 'Test caregiver', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/caregivers/me')
        result = {
          centerName: 'Test center',
          caregiverStatus: options.eligible === false ? 'INACTIVE' : 'ACTIVE',
          verificationStatus: 'VERIFIED',
        };
      else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (path === '/notifications' || path === '/booking-occurrences') result = page([]);
      else if (path === '/work-shifts/registrations/me')
        result = page(registration ? [registration] : []);
      else if (path === '/work-shifts/shift/registrations') {
        posts++;
        const body = JSON.parse(String(init?.body)) as { caregiverNote?: string };
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
        result =
          path === '/work-shifts'
            ? page([
                {
                  ...shift,
                  id: 'past',
                  shiftType: 'PAST SHIFT',
                  workDate: vietnamDay(new Date(Date.now() - 86400000)),
                },
                shift,
              ])
            : shift;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return { api, requests, counts: () => ({ posts, deletes }) };
}
async function openShift(api: ApiClient) {
  const screen = await render(<App client={api} />);
  await fireEvent.press(await screen.findByRole('tab', { name: /Ca làm việc/ }));
  await screen.findAllByText('TEST SHIFT');
  await fireEvent.press(
    screen.queryByRole('button', { name: 'Đăng ký ca' }) ??
      screen.queryByRole('button', { name: 'Xem chi tiết ca' }) ??
      screen.getByRole('button', { name: /^Xem chi tiết ca, .*Đã đăng ký$/ }),
  );
  await screen.findByText('Test shift note');
  return screen;
}

test.each(['Xem chi tiết ca', 'Đăng ký ca'])(
  'an open shift exposes a separate detail link and register action; %s opens without a write',
  async (action) => {
    const f = fixture();
    const screen = await render(<App client={f.api} />);
    try {
      await fireEvent.press(await screen.findByRole('tab', { name: /Ca làm việc/ }));
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

test('an already registered open shift opens from its card without a nested detail button', async () => {
  const f = fixture({ status: 'PENDING' });
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Ca làm việc/ }));
    const card = await screen.findByRole('button', {
      name: /^Xem chi tiết ca, .*13:00–17:04, Đã đăng ký$/,
    });
    expect(screen.queryByRole('button', { name: 'Đăng ký ca' })).toBeNull();
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
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký' }));
    await screen.findByText('Đang chờ trung tâm duyệt');
    expect(screen.queryByLabelText('Ghi chú đăng ký (không bắt buộc)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    expect(f.counts().deletes).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    await screen.findByText('Đã hủy đăng ký');
    expect(f.counts()).toEqual({ posts: 1, deletes: 1 });
    expect(await screen.findByRole('button', { name: 'Gửi đăng ký' })).toBeTruthy();
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
      await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký' }));
      await screen.findByText(/Chưa xác định được kết quả/);
      expect(screen.getByDisplayValue('Keep this note')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký' }));
      expect(f.counts().posts).toBe(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
      await screen.findByText('Đang chờ trung tâm duyệt');
      expect(screen.queryByRole('button', { name: 'Gửi đăng ký' })).toBeNull();
    } finally {
      await screen.unmount();
    }
  },
);

test('approved registration is read-only and reachable from my registrations', async () => {
  const f = fixture({ status: 'APPROVED' });
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Ca làm việc/ }));
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
    expect(screen.queryByRole('button', { name: 'Gửi đăng ký' })).toBeNull();
    expect(f.counts()).toEqual({ posts: 0, deletes: 0 });
  } finally {
    await screen.unmount();
  }
});

test('inactive caregiver gets an eligibility message and cannot register', async () => {
  const f = fixture({ eligible: false });
  const screen = await openShift(f.api);
  try {
    await screen.findByText('Hồ sơ cần được xác minh và đang hoạt động để đăng ký ca.');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi đăng ký' }));
    expect(f.counts().posts).toBe(0);
  } finally {
    await screen.unmount();
  }
});

test('a concurrent approval prevents cancellation and refresh reconciles the approved state', async () => {
  const f = fixture({ status: 'PENDING', cancelConflict: true });
  const screen = await openShift(f.api);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy đăng ký' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hủy đăng ký' }));
    await screen.findByText('Chỉ đăng ký đang chờ duyệt mới được hủy. Hãy tải lại trạng thái.');
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
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Ca làm việc/ }));
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
    expect(screen.queryByRole('button', { name: 'Gửi đăng ký' })).toBeNull();
    expect(f.counts()).toEqual({ posts: 0, deletes: 1 });
  } finally {
    await screen.unmount();
  }
});

test('primary work-shift and availability tabs are separate from visit filters, and new shifts are visible', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Buổi được giao/ }));
    expect(screen.queryByRole('button', { name: 'Đăng ký ca làm việc' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lịch được trung tâm phân công' })).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: /Ca làm việc/ }));
    await screen.findByText('TEST SHIFT');
    expect(screen.queryByText('PAST SHIFT')).toBeNull();
    expect(screen.getByText('13:00–17:04')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng ký ca' })).toBeTruthy();
    expect(screen.getByText('Đăng ký của tôi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: /Lịch rảnh/ }));
    await screen.findByText(/Các khung giờ đã được trung tâm duyệt/);
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
    await fireEvent.press(screen.getByRole('button', { name: 'Lịch sử' }));
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
