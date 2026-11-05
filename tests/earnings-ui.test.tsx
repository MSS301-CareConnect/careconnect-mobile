import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { Routes } from '../src/app/routes';
import { KeptDepositsScreen } from '../src/features/earnings/screen';
const Stack = createNativeStackNavigator<Routes>();
function Subject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="KeptDeposits" component={KeptDepositsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture(denied = false) {
  const pages: number[] = [];
  const queries: { from: string | null; to: string | null }[] = [];
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else {
        if (denied) return new Response(JSON.stringify({ code: 403 }), { status: 403 });
        queries.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        if (path.endsWith('/summary'))
          result = { caregiverAmount: 90000, centerAmount: 0, totalAmount: 90000 };
        else {
          const p = Number(url.searchParams.get('page'));
          pages.push(p);
          result = {
            items: [
              {
                id: 'row' + p,
                occurrenceStartAt: '2030-01-01T01:00:00Z',
                createdAt: '2029-12-31T20:00:00Z',
                amount: p ? 60000 : 30000,
                reason: p ? 'PAYMENT_OVERDUE' : 'CUSTOMER_CANCEL',
              },
            ],
            page: p,
            totalPages: 2,
            totalElements: 2,
          };
        }
      }
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, pages, queries };
}
async function open(f: ReturnType<typeof fixture>) {
  return render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
}
test('ledger displays backend total, pages rows and resets pagination when changing the period', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await screen.findByText(/90\.000/);
    expect(screen.getByText(/30\.000/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await screen.findByText('Quá hạn thanh toán phần còn lại');
    expect(screen.getByText(/90\.000/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '30 ngày qua' }));
    await screen.findByText('Khách hủy sát giờ');
    expect(f.pages).toEqual([0, 1, 0]);
    expect(f.queries.every((query) => query.from?.endsWith('Z') && query.to?.endsWith('Z'))).toBe(
      true,
    );
  } finally {
    await screen.unmount();
  }
});
test('denied ledger never presents a zero earnings total', async () => {
  const screen = await open(fixture(true));
  try {
    await screen.findByText(/Bạn không có quyền truy cập/);
    expect(screen.queryByText('Tổng phần bạn được hưởng')).toBeNull();
  } finally {
    await screen.unmount();
  }
});
test('refresh updates the ledger cutoff and returns to the first page', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await screen.findByText(/90\.000/);
    const initialTo = f.queries[0]?.to;
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp' }));
    await screen.findByText('Quá hạn thanh toán phần còn lại');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tải lại trạng thái' })[0]!);
    await screen.findByText('Khách hủy sát giờ');
    expect(f.pages).toEqual([0, 1, 0]);
    expect(Date.parse(f.queries.at(-1)?.to ?? '')).toBeGreaterThanOrEqual(
      Date.parse(initialTo ?? ''),
    );
  } finally {
    await screen.unmount();
  }
});
