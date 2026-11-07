import React from 'react';
import { Linking } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { parseVisit } from '../src/features/visits/models';
import {
  parseRecipientProfile,
  parseRecipientSnapshot,
} from '../src/features/visits/recipient-models';
import { RecipientCard } from '../src/features/visits/recipient-profile';
import { VisitRepository } from '../src/features/visits/repository';

const snapshot = {
  recipientId: 'recipient-1',
  fullName: 'Nguyễn Văn An',
  dateOfBirth: '1953-08-12',
  age: 73,
  gender: 'MALE',
  bloodType: 'UNKNOWN',
  mobilityLevel: 'NEEDS_ASSISTANCE',
  independenceLevel: 'PARTIALLY_DEPENDENT',
  chronicConditions: 'Thông tin bệnh nền từ gia đình',
  careRequirements: 'Dặn dò chăm sóc từ gia đình',
  activeMedications: [
    {
      medicationName: 'Medicine from API',
      timeOfDay: ['18:00', '07:00'],
      route: 'ORAL',
      dosage: 'As provided',
      startDate: '2026-10-24',
    },
  ],
};
const profile = {
  careSnapshot: {
    ...snapshot,
    phoneNumber: '0900003007',
    addressLine: '62 Đường số 8',
    ward: 'Phường Bình Thạnh',
    allergies: 'Nội dung dị ứng do gia đình cung cấp',
    snapshotAt: '2026-11-07T07:42:00Z',
  },
  careDetails: {
    medicalHistory: 'Tiền sử từ API',
    sleepHabits: 'Giấc ngủ từ API',
    heightCm: 172,
    weightKg: 67,
  },
  emergencyContacts: [
    {
      fullName: 'Secondary contact',
      phoneNumber: '0900***000',
      relationship: 'Relative',
      primary: false,
      priority: 2,
    },
    {
      fullName: 'Primary contact',
      phoneNumber: '0900004070',
      relationship: 'Con',
      primary: true,
      priority: 3,
    },
  ],
};
const visitJson = {
  id: 'v',
  bookingId: 'b',
  recipientId: 'recipient-1',
  recipientName: 'Nguyễn Văn An',
  startAt: '2026-11-07T07:00:00Z',
  endAt: '2026-11-07T09:00:00Z',
  status: 'ACKNOWLEDGED',
  recipientSnapshot: snapshot,
};
const Stack = createNativeStackNavigator();
function fixture(hidden = false) {
  const reads: string[] = [];
  const controls = { status: 200 };
  const client = new ApiClient(
    'http://test',
    { get: async () => 'r', set: async () => undefined },
    async (input, init) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      if (init?.method === 'GET') reads.push(path);
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me') result = { id: 'u', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/care-recipients/recipient-1') {
        if (controls.status !== 200)
          return new Response(JSON.stringify({ code: 2004 }), { status: controls.status });
        result = profile;
      } else throw new Error('Unexpected API path');
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  function Content() {
    const { api, user } = useApp();
    return user ? (
      <RecipientCard
        visit={parseVisit({ ...visitJson, recipientSnapshot: hidden ? undefined : snapshot })}
        repo={new VisitRepository(api)}
      />
    ) : null;
  }
  function Subject() {
    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Test" component={Content} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
  return { client, reads, controls, Subject };
}
async function open(f: ReturnType<typeof fixture>) {
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.client}>
        <f.Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Người được chăm sóc');
  return screen;
}

test('summary preserves backend identity and opens a fresh assigned profile only on demand', async () => {
  const f = fixture();
  const screen = await open(f);
  const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    expect(screen.getByText('12/08/1953')).toBeTruthy();
    expect(screen.getByText('73 tuổi · Nam')).toBeTruthy();
    expect(screen.getByText('Chưa xác định')).toBeTruthy();
    expect(screen.getByText('Cần hỗ trợ khi di chuyển')).toBeTruthy();
    expect(screen.getByText('Giờ dùng: 07:00, 18:00')).toBeTruthy();
    expect(screen.queryByText('Thuốc đang sử dụng')).toBeNull();
    expect(f.reads.filter((path) => path.startsWith('/care-recipients'))).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Hồ sơ đầy đủ' }));
    await screen.findByText('Tiền sử từ API');
    expect(screen.getByText('172 cm')).toBeTruthy();
    expect(screen.getByText('67 kg')).toBeTruthy();
    expect(screen.getByText('Giấc ngủ từ API')).toBeTruthy();
    expect(screen.getByText('Nội dung dị ứng do gia đình cung cấp')).toBeTruthy();
    expect(screen.getByText('Secondary contact')).toBeTruthy();
    expect(screen.getByText('Medicine from API')).toBeTruthy();
    expect(screen.getByText('As provided · Uống')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gọi liên hệ: Secondary contact' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Gọi liên hệ: Primary contact' }));
    expect(call).toHaveBeenCalledWith('tel:0900004070');
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText('Tiền sử từ API')).toBeNull();
    f.controls.status = 404;
    await fireEvent.press(screen.getByRole('button', { name: 'Xem thuốc trong hồ sơ' }));
    await screen.findByText(/Hồ sơ không khả dụng/);
    expect(screen.queryByText('Tiền sử từ API')).toBeNull();
    expect(f.reads.filter((path) => path.startsWith('/care-recipients'))).toHaveLength(2);
  } finally {
    call.mockRestore();
    await screen.unmount();
  }
});

test('profile read failure is retryable and does not substitute booking data for a full profile', async () => {
  const f = fixture();
  f.controls.status = 503;
  const screen = await open(f);
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Hồ sơ đầy đủ' }));
    await screen.findByRole('button', { name: 'Tải lại trạng thái' });
    expect(screen.queryByText('Tiền sử từ API')).toBeNull();
    f.controls.status = 200;
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByText('Tiền sử từ API');
  } finally {
    await screen.unmount();
  }
});

test('hidden snapshot offers no full-profile access or secondary recipient read', async () => {
  const f = fixture(true);
  const screen = await open(f);
  try {
    expect(
      screen.getByText('Thông tin người bệnh chưa được cung cấp trong phạm vi ca này.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hồ sơ đầy đủ' })).toBeNull();
    expect(f.reads.filter((path) => path.startsWith('/care-recipients'))).toEqual([]);
  } finally {
    await screen.unmount();
  }
});

test('profile boundary retains absent clinical fields, all contacts, medication dates and rejects wrong scope', async () => {
  expect(parseRecipientSnapshot({}).age).toBeUndefined();
  expect(parseRecipientSnapshot({}).bloodType).toBe('');
  expect(parseRecipientSnapshot({ age: 0 }).age).toBe(0);
  expect(() => parseRecipientSnapshot({ dateOfBirth: '1953-02-30' })).toThrow();
  expect(() => parseRecipientProfile({ profile: {} })).toThrow();
  const parsed = parseRecipientProfile(profile);
  expect(parsed.contacts.map((c) => c.name)).toEqual(['Primary contact', 'Secondary contact']);
  expect(parsed.snapshot.medications[0]?.startDate).toBe('2026-10-24');
  expect(parsed.snapshot.medications[0]?.times).toEqual(['07:00', '18:00']);
  const request = jest.fn(async (_method: string, _path: string) => profile);
  const repo = new VisitRepository({ request });
  await expect(repo.recipientProfile('other-recipient')).rejects.toThrow(
    'Recipient scope mismatch',
  );
  expect(request).toHaveBeenCalledWith('GET', '/care-recipients/other-recipient');
});
