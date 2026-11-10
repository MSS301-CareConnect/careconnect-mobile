import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';

test('successful password change clears credentials and protected UI immediately', async () => {
  let token: string | null = 'refresh';
  let passwordWrites = 0;
  const api = new ApiClient(
    'http://test',
    {
      get: async () => token,
      set: async (value) => {
        token = value;
      },
    },
    async (input, init) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      let result: unknown = { items: [], page: 0, totalPages: 0, totalElements: 0 };
      if (path === '/auth/refresh') result = { accessToken: 'access', refreshToken: 'refresh' };
      else if (path === '/users/me')
        result = {
          id: 'user',
          fullName: 'Caregiver fixture',
          email: 'fixture@example.test',
          roles: ['CAREGIVER'],
          status: 'ACTIVE',
        };
      else if (path === '/caregivers/me')
        result = {
          id: 'caregiver',
          fullName: 'Caregiver fixture',
          caregiverStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        };
      else if (path === '/users/me/change-password') {
        expect(init?.method).toBe('POST');
        passwordWrites++;
        result = {};
      } else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (
        path.includes('/certificates/') ||
        path.includes('/provider-media/') ||
        path.endsWith('/services')
      )
        result = [];
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  const screen = await render(<App client={api} />);
  try {
    await fireEvent.press(await screen.findByRole('tab', { name: /Hồ sơ/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Bảo mật' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Đổi mật khẩu' }));
    await fireEvent.changeText(await screen.findByLabelText('Mật khẩu hiện tại'), 'Current1!');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'Changed1!');
    await fireEvent.changeText(screen.getByLabelText('Xác nhận mật khẩu mới'), 'Changed1!');
    await fireEvent.press(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByLabelText('Email');
    expect(token).toBeNull();
    expect(api.state.status).toBe('signedOut');
    expect(passwordWrites).toBe(1);
    expect(screen.queryByRole('tab', { name: /Hồ sơ/ })).toBeNull();
  } finally {
    await screen.unmount();
  }
});
