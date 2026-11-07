import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';
import { vietnamDay } from '../src/core/time';

function fixture({ empty = false, failFirst = false } = {}) {
  let token: string | null = 'refresh';
  let failed = false;
  const requests: { path: string; query: URLSearchParams }[] = [];
  const api = new ApiClient(
    'http://test',
    {
      get: async () => token,
      set: async (value) => {
        token = value;
      },
    },
    async (input) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      requests.push({ path, query: url.searchParams });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'access', refreshToken: 'refresh' };
      else if (path === '/users/me')
        result = {
          id: 'caregiver',
          fullName: 'Test caregiver',
          roles: ['CAREGIVER'],
          status: 'ACTIVE',
        };
      else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (path === '/notifications')
        result = { items: [], page: 0, totalPages: 0, totalElements: 0 };
      else if (path === '/bookings/caregiver-requests') {
        result = { items: [], page: 0, totalPages: 0, totalElements: 0 };
      } else if (path === '/booking-occurrences') {
        if (failFirst && !failed) {
          failed = true;
          return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        }
        const completed = url.searchParams.get('status') === 'COMPLETED';
        const page = Number(url.searchParams.get('page') ?? 0);
        result = {
          items:
            empty || completed
              ? []
              : [
                  {
                    id: `visit-${page}`,
                    bookingId: 'booking',
                    startAt: '2026-11-01T03:00:00Z',
                    endAt: '2026-11-01T05:00:00Z',
                    status: 'SCHEDULED',
                    recipientName: page ? 'Test second recipient' : 'Test first recipient',
                    services: [],
                  },
                ],
          page,
          totalPages: empty ? 0 : completed ? 1 : 2,
          totalElements: empty ? 0 : completed ? 9 : 23,
        };
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { api, requests };
}

test('today section opens the assigned visits screen through View all', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await screen.findByText('Sắp bắt đầu');
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(await screen.findByRole('button', { name: 'Bộ lọc buổi chăm sóc' })).toBeTruthy();
    expect(await screen.findByText('Test first recipient')).toBeTruthy();
    await waitFor(() => {
      const query = f.requests
        .filter(
          (request) => request.path === '/booking-occurrences' && !request.query.has('status'),
        )
        .at(-1)?.query;
      expect(query?.get('from')).toBe(vietnamDay());
      expect(query?.get('to')).toBe(vietnamDay());
      expect(query?.has('status')).toBe(false);
    });
  } finally {
    await screen.unmount();
  }
});

test('Home reads the request count and the response tab loads the full request list', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await screen.findByText('Test first recipient');
    const requestReads = () =>
      f.requests.filter((request) => request.path === '/bookings/caregiver-requests');
    expect(requestReads().map((request) => request.query.get('size'))).toEqual(['1']);
    await fireEvent.press(screen.getByRole('tab', { name: /Buổi được giao/ }));
    await fireEvent.press(screen.getByRole('tab', { name: /^Cần phản hồi/ }));
    expect(await screen.findByText('Không có yêu cầu đang chờ trả lời.')).toBeTruthy();
    expect(requestReads().some((request) => request.query.get('size') === '20')).toBe(true);
  } finally {
    await screen.unmount();
  }
});

test('View all resets previously selected history to the Vietnam day range', async () => {
  const f = fixture();
  const screen = await render(<App client={f.api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Buổi được giao/ }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }));
    await waitFor(() => {
      const query = f.requests
        .filter(
          (request) =>
            request.path === '/booking-occurrences' && request.query.get('status') !== 'SCHEDULED',
        )
        .at(-1)?.query;
      expect(query?.get('status')).toBe('COMPLETED');
    });
    await fireEvent.press(screen.getByTestId('home-tab'));
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả' }));
    await waitFor(() => {
      const query = f.requests
        .filter(
          (request) => request.path === '/booking-occurrences' && !request.query.has('status'),
        )
        .at(-1)?.query;
      expect(query?.get('from')).toBe(vietnamDay());
      expect(query?.get('to')).toBe(vietnamDay());
      expect(query?.has('status')).toBe(false);
    });
    expect(await screen.findByText('Test first recipient')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('failed Home reads withhold totals and empty-day actions until a successful read', async () => {
  const screen = await render(<App client={fixture({ failFirst: true }).api} />);
  try {
    await screen.findByText(/Không thể tải dữ liệu/);
    expect(screen.queryByLabelText('Hôm nay: 0')).toBeNull();
    expect(screen.queryByLabelText('Đã hoàn thành: 0')).toBeNull();
    expect(screen.queryByText('Hôm nay bạn chưa có buổi nào')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng ký ca' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xem buổi sắp tới' })).toBeNull();
  } finally {
    await screen.unmount();
  }
});

test('home keeps server totals while paginating a partial page of visits', async () => {
  const screen = await render(<App client={fixture().api} />);
  try {
    await screen.findByText('Test first recipient');
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await screen.findByText('Test second recipient');
    expect(screen.queryByText('Test first recipient')).toBeNull();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('Tổng: 23 · Trang 2/2')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('an empty day opens upcoming visits with the Vietnam start date and no end date', async () => {
  const f = fixture({ empty: true });
  const screen = await render(<App client={f.api} />);
  try {
    await screen.findByText('Hôm nay bạn chưa có buổi nào');
    await fireEvent.press(screen.getByRole('button', { name: 'Xem buổi sắp tới' }));
    expect(await screen.findByRole('button', { name: 'Bộ lọc buổi chăm sóc' })).toBeTruthy();
    await waitFor(() => {
      const query = f.requests
        .filter((request) => request.path === '/booking-occurrences')
        .at(-1)?.query;
      expect(query?.get('from')).toBe(vietnamDay());
      expect(query?.has('to')).toBe(false);
      expect(query?.has('status')).toBe(false);
    });
  } finally {
    await screen.unmount();
  }
});

test('failed home read can be retried without losing access to the schedule', async () => {
  const screen = await render(<App client={fixture({ failFirst: true }).api} />);
  try {
    await screen.findByText(/Không thể tải dữ liệu/);
    expect(screen.getByRole('button', { name: 'Xem tất cả' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    expect(await screen.findByText('Test first recipient')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('an empty day opens registration within the integrated work schedule', async () => {
  const screen = await render(<App client={fixture({ empty: true }).api} />);
  try {
    await screen.findByText('Hôm nay bạn chưa có buổi nào');
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng ký ca' }));
    expect(await screen.findByRole('tab', { name: 'Đăng ký ca', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Lịch làm việc/, selected: true })).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
