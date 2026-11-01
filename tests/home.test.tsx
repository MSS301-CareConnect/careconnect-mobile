import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';

function fixture({ empty = false, failFirst = false } = {}) {
  let token: string | null = 'refresh';
  let failed = false;
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
      else if (path === '/booking-occurrences') {
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
  return api;
}

test('today section opens the assigned visits screen through View all', async () => {
  const screen = await render(<App client={fixture()} />);
  try {
    await screen.findByText('Lịch chăm sóc hôm nay');
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(await screen.findByRole('button', { name: 'Bộ lọc buổi chăm sóc' })).toBeTruthy();
    expect(await screen.findByText('Test first recipient')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('home keeps server totals while paginating a partial page of visits', async () => {
  const screen = await render(<App client={fixture()} />);
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

test('empty home retains assignment guidance and access to all visits', async () => {
  const screen = await render(<App client={fixture({ empty: true })} />);
  try {
    await screen.findByText('Chưa có ca chăm sóc trong mục này');
    expect(screen.getByText('Lịch mới sẽ xuất hiện khi trung tâm phân công cho bạn.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(await screen.findByRole('button', { name: 'Bộ lọc buổi chăm sóc' })).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('failed home read can be retried without losing access to the schedule', async () => {
  const screen = await render(<App client={fixture({ failFirst: true })} />);
  try {
    await screen.findByText(/Không thể tải dữ liệu/);
    expect(screen.getByRole('button', { name: 'Xem tất cả' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    expect(await screen.findByText('Test first recipient')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
