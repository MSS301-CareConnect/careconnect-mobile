import React from 'react';
import { test, expect } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';
function client(
  handler: (path: string, init?: RequestInit) => Promise<Response>,
  token: string | null = null,
) {
  return new ApiClient(
    'http://test',
    {
      get: async () => token,
      set: async (v) => {
        token = v;
      },
    },
    (input, init) => handler(String(input).replace('http://test/api/v1', ''), init),
  );
}
const reply = (result: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify({ code: status, result }), { status }));
test.each(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'])(
  '%s visit and checklist render all strings inside Text',
  async (status) => {
    const hasSession = status !== 'SCHEDULED';
    const visit = {
      id: 'v',
      bookingId: 'b',
      startAt: '2026-11-01T03:00:00Z',
      endAt: '2026-11-01T05:00:00Z',
      status,
      recipientName: 'Test Recipient',
      ...(hasSession ? { sessionId: 's' } : {}),
      services: [],
    };
    const api = client((path) => {
      if (path === '/auth/refresh') return reply({ accessToken: 'a', refreshToken: 'r' });
      if (path === '/users/me')
        return reply({ id: 'u', fullName: 'Tester', roles: ['CAREGIVER'], status: 'ACTIVE' });
      if (path.startsWith('/notifications'))
        return reply(
          path.includes('count')
            ? { count: 0 }
            : { items: [], page: 0, totalPages: 0, totalElements: 0 },
        );
      if (path === '/booking-occurrences/v') return reply(visit);
      if (path.startsWith('/booking-occurrences'))
        return reply({ items: [visit], page: 0, totalPages: 1, totalElements: 1 });
      if (path === '/care-sessions/s')
        return reply({
          sessionId: 's',
          bookingId: 'b',
          status: status === 'COMPLETED' ? 'ENDED' : 'IN_PROGRESS',
          tasks: ['PENDING', 'DONE', 'SKIPPED'].map((taskStatus, i) => ({
            id: String(i),
            title: `Test task ${i}`,
            status: taskStatus,
            ...(taskStatus === 'SKIPPED' ? { skipReason: 'Test skip reason' } : {}),
          })),
        });
      if (path.startsWith('/care-sessions/s/notes'))
        return reply({ items: [], page: 0, totalPages: 0, totalElements: 0 });
      return reply(null, 404);
    }, 'r');
    const screen = await render(<App client={api} />);
    try {
      await fireEvent.press(await screen.findByText('Test Recipient'));
      await screen.findByText(hasSession ? 'Mở ca chăm sóc' : 'Xác nhận nhận ca');
      if (hasSession) {
        await fireEvent.press(screen.getByText('Mở ca chăm sóc'));
        await screen.findByText('Test task 0');
        expect(screen.getByText('Test task 1')).toBeTruthy();
        expect(screen.getByText('Test task 2')).toBeTruthy();
        expect(screen.getByText('Test skip reason')).toBeTruthy();
      }
    } finally {
      await screen.unmount();
    }
  },
);

test('login retains entered credentials on server error and supports English', async () => {
  const api = client(() => reply(null, 403));
  const screen = await render(<App client={api} />);
  await screen.findByText('Đồng hành cùng mỗi ca chăm sóc');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'caregiver@example.test');
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'retained-password');
  await fireEvent.press(screen.getByText('Đăng nhập'));
  await screen.findByText(/Bạn không có quyền truy cập/);
  expect(screen.getByDisplayValue('caregiver@example.test')).toBeTruthy();
  expect(screen.getByDisplayValue('retained-password')).toBeTruthy();
  await fireEvent.press(screen.getByText('English'));
  expect(screen.getByText('Here for every moment of care')).toBeTruthy();
  await screen.unmount();
});
test('transient session restore exposes retry and never shows protected screens', async () => {
  const api = client(() => reply(null, 503), 'refresh');
  const screen = await render(<App client={api} />);
  await screen.findByText('Thử lại');
  expect(screen.queryByText('Ca chăm sóc hôm nay')).toBeNull();
  await screen.unmount();
});
test('failed note write keeps form and blocks repeat until server reconciliation', async () => {
  const visit = {
    id: 'v',
    bookingId: 'b',
    startAt: '2026-11-01T01:00:00Z',
    endAt: '2026-11-01T03:00:00Z',
    status: 'IN_PROGRESS',
    recipientName: 'Test Recipient',
    sessionId: 's',
    services: [],
  };
  let writes = 0;
  const api = client((path, init) => {
    if (path === '/auth/refresh') return reply({ accessToken: 'a', refreshToken: 'r' });
    if (path === '/users/me')
      return reply({
        id: 'u',
        fullName: 'Tester',
        email: 'care@example.test',
        roles: ['CAREGIVER'],
        status: 'ACTIVE',
      });
    if (path.startsWith('/notifications'))
      return reply(
        path.includes('count')
          ? { count: 0 }
          : { items: [], page: 0, totalPages: 0, totalElements: 0 },
      );
    if (path === '/booking-occurrences/v') return reply(visit);
    if (path.startsWith('/booking-occurrences'))
      return reply({ items: [visit], page: 0, totalPages: 1, totalElements: 1 });
    if (path === '/care-sessions/s')
      return reply({ sessionId: 's', bookingId: 'b', status: 'IN_PROGRESS', tasks: [] });
    if (path.startsWith('/care-sessions/s/notes')) {
      if (init?.method === 'POST') {
        writes++;
        return Promise.reject(new TypeError('network'));
      }
      return reply({ items: [], page: 0, totalPages: 0, totalElements: 0 });
    }
    return reply(null, 404);
  }, 'r');
  const screen = await render(<App client={api} />);
  await screen.findByText('Test Recipient');
  await fireEvent.press(screen.getByText('Test Recipient'));
  await fireEvent.press(await screen.findByText('Mở ca chăm sóc'));
  await screen.findByLabelText('Nội dung ghi chú');
  await fireEvent.changeText(screen.getByLabelText('Nội dung ghi chú'), 'Retain this note');
  await fireEvent.press(screen.getByRole('button', { name: 'Lưu ghi chú' }));
  await screen.findByText(/Chưa xác định được kết quả/);
  expect(screen.getByDisplayValue('Retain this note')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Lưu ghi chú' }));
  expect(writes).toBe(1);
  await screen.unmount();
});

test('login can retry after an uncertain network failure', async () => {
  let attempts = 0;
  const api = client(() => {
    attempts++;
    return Promise.reject(new TypeError('network'));
  });
  const screen = await render(<App client={api} />);
  await screen.findByText('Đồng hành cùng mỗi ca chăm sóc');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'care@example.test');
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'password');
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByText(/Không kết nối được máy chủ/);
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(attempts).toBe(2);
  await screen.unmount();
});
