import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { Routes } from '../src/app/routes';
import { WalletScreen } from '../src/features/wallet/screen';
import { WalletWithdrawScreen } from '../src/features/wallet/withdraw-screen';
const Stack = createNativeStackNavigator<Routes>();
function Subject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="WalletWithdraw" component={WalletWithdrawScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture() {
  const posted: unknown[] = [];
  let available = 90000;
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input, init) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/wallets/me')
        result = {
          availableBalance: available,
          heldBalance: 90000 - available,
          withdrawable: available > 0,
        };
      else if (path === '/wallets/me/statistics')
        result = {
          forfeitIncome: 90000,
          totalWithdrawn: 0,
          bookingCount: 1,
          series: [{ period: '2026-11-08', income: 90000, withdrawn: 0 }],
        };
      else if (path === '/wallets/me/transactions')
        result = {
          items: [
            {
              id: 't1',
              type: 'FORFEIT_CREDIT',
              amount: 90000,
              availableBefore: 0,
              availableAfter: 90000,
              heldBefore: 0,
              heldAfter: 0,
              createdAt: '2026-11-08T03:00:00Z',
            },
          ],
          page: 0,
          totalPages: 1,
          totalElements: 1,
        };
      else if (path === '/wallet-withdrawals' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        posted.push(body);
        available -= body.amount;
        result = { id: 'd1', ...body, status: 'PENDING', createdAt: '2026-11-09T03:00:00Z' };
      } else if (path === '/wallet-withdrawals')
        result = {
          items: posted.map((body, index) => ({
            id: 'd' + index,
            ...(body as object),
            status: 'PENDING',
            createdAt: '2026-11-09T03:00:00Z',
          })),
          page: 0,
          totalPages: 1,
          totalElements: posted.length,
        };
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, posted };
}
test('wallet shows the balance and ledger, checks the withdrawal form and lists the new request', async () => {
  const f = fixture();
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  try {
    await screen.findByText('Doanh thu trong kỳ');
    expect(screen.getAllByText(/90\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Bạn chưa gửi yêu cầu rút tiền nào.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rút tiền' }));
    await screen.findByText('Rút tiền về ngân hàng');
    await fireEvent.changeText(screen.getByLabelText('Số tiền muốn rút (₫)'), '100000');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi yêu cầu rút tiền' }));
    expect(screen.getByText('Số tiền vượt quá số dư khả dụng.')).toBeTruthy();
    expect(screen.getByText('Nhập tên ngân hàng.')).toBeTruthy();
    expect(f.posted).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Rút toàn bộ' }));
    await fireEvent.changeText(screen.getByLabelText('Tên ngân hàng'), 'Vietcombank');
    await fireEvent.changeText(screen.getByLabelText('Số tài khoản'), '0123456789');
    await fireEvent.changeText(screen.getByLabelText('Tên chủ tài khoản'), 'TRAN THI B');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi yêu cầu rút tiền' }));
    await screen.findByText('Chờ duyệt');
    expect(f.posted).toEqual([
      {
        amount: 90000,
        bankName: 'Vietcombank',
        bankAccountNumber: '0123456789',
        accountHolderName: 'TRAN THI B',
      },
    ]);
  } finally {
    await screen.unmount();
  }
});
