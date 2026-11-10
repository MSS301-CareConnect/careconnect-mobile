import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { Routes } from '../src/app/routes';
import { AbsenceExplainScreen, AbsencesScreen } from '../src/features/absences/screen';

const Stack = createNativeStackNavigator<Routes>();
function Subject() {
  const { user } = useApp();
  return user ? (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Absences" component={AbsencesScreen} />
        <Stack.Screen name="AbsenceExplain" component={AbsenceExplainScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  ) : null;
}
function fixture() {
  const posted: unknown[] = [];
  const absence: Record<string, unknown> = {
    id: 'a1',
    bookingId: 'b1',
    bookingCode: 'BK0001',
    recipientName: 'Bà Lan',
    occurrenceId: 'o1',
    occurrenceNo: 2,
    startAt: '2026-11-10T01:00:00Z',
    endAt: '2026-11-10T03:00:00Z',
    source: 'MISSED_CHECK_IN',
    status: 'PENDING',
  };
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input, init) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/caregiver-absences/a1/explanation') {
        const body = JSON.parse(String(init?.body));
        posted.push(body);
        absence.explanation = body.explanation;
        absence.explainedAt = '2026-11-10T05:00:00Z';
        result = absence;
      } else if (path === '/caregiver-absences/a1') result = absence;
      else if (path === '/caregiver-absences')
        result = { items: [absence], page: 0, totalPages: 1, totalElements: 1 };
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, posted };
}

test('the caregiver sees a pending absence, is told the minimum length and sends an explanation', async () => {
  const f = fixture();
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  try {
    await screen.findByText(/BK0001 · Bà Lan · Không check-in đúng hạn/);
    expect(screen.getByText('Chưa có giải trình.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi giải trình' }));
    const field = await screen.findByLabelText('Giải trình');
    await fireEvent.changeText(field, 'Bị ốm');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi giải trình' }));
    expect(screen.getByText('Giải trình cần ít nhất 10 ký tự.')).toBeTruthy();
    expect(f.posted).toEqual([]);
    await fireEvent.changeText(field, '  Xe hỏng giữa đường, đã gọi trung tâm  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi giải trình' }));
    await screen.findByText('Giải trình: Xe hỏng giữa đường, đã gọi trung tâm');
    expect(f.posted).toEqual([{ explanation: 'Xe hỏng giữa đường, đã gọi trung tâm' }]);
    expect(screen.getByRole('button', { name: 'Sửa giải trình' })).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
