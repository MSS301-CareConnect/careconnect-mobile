import React from 'react';
import { Alert, Linking, NativeModules, Text } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { pick } from '@react-native-documents/picker';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { CertificatesScreen } from '../src/features/profile/certificates-screen';

const Stack = createNativeStackNavigator();
const serverCertificate = {
  id: 'cert-existing',
  certificateName: 'Server certificate',
  issuedBy: 'Training center',
  credentialNumber: 'ABC',
  issuedDate: '2026-11-05',
  expiryDate: '2026-11-05',
  verificationStatus: 'REJECTED',
  verificationReason: 'Please provide a clearer document',
  version: 7,
};
const serverFile = {
  mediaFileId: 'file',
  originalFileName: 'qualification.pdf',
  mediaFileType: 'DOCUMENT',
  contentType: 'application/pdf',
  fileSize: 1024,
  displayOrder: 0,
  downloadUrl: 'https://files.example.test/cert',
  downloadUrlExpiresAt: '2030-01-01T00:00:00Z',
};
function SignedIn({ children }: { children: React.ReactNode }) {
  return useApp().user ? <>{children}</> : <Text>Restoring</Text>;
}
function fixture(
  options: {
    uploadFailure?: 'network' | 'denied';
    createFailure?: boolean;
    files?: (typeof serverFile)[];
    gate?: Promise<void>;
    certificateStatus?: string;
  } = {},
) {
  let token: string | null = 'refresh';
  let certificates = [
    {
      ...serverCertificate,
      verificationStatus: options.certificateStatus ?? serverCertificate.verificationStatus,
    },
  ];
  const calls: { method: string; path: string; body: unknown; query: URLSearchParams }[] = [];
  const controls = { failRead: false, uploadFailure: options.uploadFailure };
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
      const method = init?.method ?? 'GET';
      const body =
        init?.body instanceof FormData
          ? init.body
          : init?.body
            ? (JSON.parse(String(init.body)) as Record<string, unknown>)
            : undefined;
      calls.push({ method, path, body, query: url.searchParams });
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/caregivers/me') result = { id: 'caregiver' };
      else if (path === '/certificates/caregivers/caregiver' && method === 'GET') {
        if (controls.failRead) return new Response(JSON.stringify({ code: 503 }), { status: 503 });
        result = certificates;
      } else if (path.startsWith('/provider-media/CERTIFICATE/') && method === 'GET')
        result = options.files ?? [];
      else if (path.startsWith('/provider-media/CERTIFICATE/') && method === 'POST') {
        if (controls.uploadFailure === 'network') throw new TypeError('Upload interrupted');
        if (controls.uploadFailure === 'denied')
          return new Response(JSON.stringify({ code: 403 }), { status: 403 });
        result = [serverFile];
      } else if (path.startsWith('/certificates/') && method === 'POST') {
        await options.gate;
        if (options.createFailure && method === 'POST') throw new TypeError('Create interrupted');
        const fields = body as Record<string, unknown>;
        const saved = {
          ...serverCertificate,
          ...fields,
          id: 'cert-new',
          verificationStatus: 'PENDING',
          verificationReason: '',
          version: 0,
        };
        certificates = [...certificates.filter((item) => item.id !== saved.id), saved];
        result = saved;
      } else if (path.startsWith('/certificates/') && method === 'DELETE') {
        certificates = certificates.filter((item) => item.id !== path.split('/').at(-1));
        result = null;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return {
    api,
    calls,
    controls,
    writes: () =>
      calls.filter((call) => !['GET'].includes(call.method) && !call.path.startsWith('/auth')),
  };
}
async function open(f: ReturnType<typeof fixture>) {
  const screen = await render(
    <SafeAreaProvider>
      <AppProvider client={f.api}>
        <SignedIn>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen name="Certificates" component={CertificatesScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SignedIn>
      </AppProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Server certificate');
  return screen;
}
async function newForm(screen: Awaited<ReturnType<typeof open>>) {
  await fireEvent.press(screen.getByRole('button', { name: 'Thêm chứng chỉ' }));
  await fireEvent.changeText(screen.getByLabelText('Tên chứng chỉ *'), 'New certificate');
  await fireEvent.changeText(screen.getByLabelText('Đơn vị cấp *'), 'School');
}
async function selectFile(screen: Awaited<ReturnType<typeof open>>) {
  jest.mocked(pick).mockResolvedValueOnce([
    {
      uri: 'content://test/qualification',
      name: 'qualification.pdf',
      type: 'application/pdf',
      size: 1024,
      hasRequestedType: true,
      isVirtual: false,
      error: null,
      nativeType: 'application/pdf',
      convertibleToMimeTypes: null,
    },
  ] as Awaited<ReturnType<typeof pick>>);
  await fireEvent.press(screen.getByRole('button', { name: 'Chọn tệp chứng chỉ' }));
  await screen.findByText('qualification.pdf');
}

test.each([
  ['PENDING', 'Chờ xác minh'],
  ['CENTER_VERIFIED', 'Trung tâm đã xác minh'],
  ['ADMIN_VERIFIED', 'Đã xác minh chứng chỉ'],
  ['REJECTED', 'Chứng chỉ bị từ chối'],
])('certificate verification state %s has its own localized meaning', async (status, label) => {
  const screen = await open(fixture({ certificateStatus: status }));
  try {
    expect(screen.getByText(label)).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});
async function yes(alert: jest.SpiedFunction<typeof Alert.alert>) {
  await act(async () => alert.mock.calls.at(-1)?.[2]?.at(-1)?.onPress?.());
}

test('an explicit save creates once and reuses its checkpoint ID after a definite upload failure', async () => {
  const f = fixture({ uploadFailure: 'denied' });
  const screen = await open(f);
  try {
    await newForm(screen);
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await screen.findByText(/Bạn không có quyền truy cập/);
    expect(screen.getByText('Chi tiết chứng chỉ')).toBeTruthy();
    expect(screen.queryByLabelText('Tên chứng chỉ *')).toBeNull();
    expect(
      f.writes().filter((call) => call.path === '/certificates/caregivers/caregiver'),
    ).toHaveLength(1);
    f.controls.uploadFailure = undefined;
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu chứng chỉ' })).toBeNull());
    expect(
      f.writes().filter((call) => call.path === '/certificates/caregivers/caregiver'),
    ).toHaveLength(1);
    expect(
      f.writes().filter((call) => call.path === '/provider-media/CERTIFICATE/cert-new'),
    ).toHaveLength(2);
    expect(f.writes().filter((call) => call.method === 'PUT')).toHaveLength(0);
  } finally {
    await screen.unmount();
  }
});

test('an uncertain create has no correlation ID and stays blocked after a fresh list read', async () => {
  const f = fixture({ createFailure: true });
  const screen = await open(f);
  try {
    await newForm(screen);
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await screen.findByText(/Không xác định được chứng chỉ vừa tạo/);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại chứng chỉ' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại chứng chỉ' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Lưu chứng chỉ' })).toBeDisabled();
    expect(screen.getByDisplayValue('New certificate')).toBeTruthy();
    expect(f.writes()).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('uncertain upload requires fresh links and explicit removal of the uncertain selection before choosing again', async () => {
  const f = fixture({ uploadFailure: 'network' });
  const screen = await open(f);
  try {
    await newForm(screen);
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await screen.findByText(/Kiểm tra các tệp trên máy chủ/);
    expect(screen.getByRole('button', { name: 'Lưu chứng chỉ' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại chứng chỉ' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Bỏ tệp đã chọn' })).toBeEnabled(),
    );
    expect(
      f.calls.some(
        (call) => call.method === 'GET' && call.path === '/provider-media/CERTIFICATE/cert-new',
      ),
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ tệp đã chọn' }));
    expect(screen.getByRole('button', { name: 'Chọn tệp chứng chỉ' })).toBeEnabled();
    expect(
      f.writes().filter((call) => call.method === 'POST' && call.path.includes('/provider-media/')),
    ).toHaveLength(1);
  } finally {
    await screen.unmount();
  }
});

test('deletion confirms and sends the actual optimistic version, while rejected reasons remain visible', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    expect(screen.getByText('Please provide a clearer document')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xóa chứng chỉ: Server certificate' }),
    );
    expect(f.writes()).toHaveLength(0);
    await yes(alert);
    await waitFor(() => expect(screen.queryByText('Server certificate')).toBeNull());
    const deletion = f.writes()[0];
    expect(deletion).toMatchObject({ method: 'DELETE', path: '/certificates/cert-existing' });
    expect(deletion?.query.get('version')).toBe('7');
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('dirty close requires discard confirmation and a pending save locks fields and close', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const f = fixture({ gate });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f);
  try {
    await newForm(screen);
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng biểu mẫu chứng chỉ' }));
    expect(screen.getByDisplayValue('New certificate')).toBeTruthy();
    expect(alert).toHaveBeenCalled();
    await act(async () => alert.mock.calls.at(-1)?.[2]?.[0]?.onPress?.());
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    expect(screen.getByLabelText('Tên chứng chỉ *').props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Đóng biểu mẫu chứng chỉ' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    expect(f.writes()).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(screen.queryByDisplayValue('New certificate')).toBeNull());
  } finally {
    release();
    alert.mockRestore();
    await screen.unmount();
  }
});

test('invalid certificate files make no writes and equal issue/expiry dates remain a permitted explicit choice', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await newForm(screen);
    jest.mocked(pick).mockResolvedValueOnce([
      {
        uri: 'content://test/bad',
        name: 'bad.webp',
        type: 'image/webp',
        size: 1024,
        hasRequestedType: true,
        isVirtual: false,
        error: null,
        nativeType: 'image/webp',
        convertibleToMimeTypes: null,
      },
    ] as Awaited<ReturnType<typeof pick>>);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn tệp chứng chỉ' }));
    await screen.findByText(/Chọn một tệp PDF, JPEG hoặc PNG/);
    expect(f.writes()).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Ngày cấp'), '2026-11-05');
    await fireEvent.changeText(screen.getByLabelText('Ngày hết hạn'), '2026-11-04');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    expect(screen.getByText('Ngày hết hạn không được trước ngày cấp.')).toBeTruthy();
    expect(f.writes()).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Ngày hết hạn'), '2026-11-05');
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await waitFor(() => expect(screen.queryByDisplayValue('New certificate')).toBeNull());
    expect(f.writes()[0]?.body).toMatchObject({
      issuedDate: '2026-11-05',
      expiryDate: '2026-11-05',
    });
  } finally {
    await screen.unmount();
  }
});

test('saved certificate details are read only and open PDF pages inside the app', async () => {
  const originalModule = NativeModules.CareConnectCertificatePdf;
  const pdf = {
    open: jest.fn(async (_url: string) => ({ id: 4, pages: 2 })),
    render: jest.fn(async (_id: number, index: number) => `data:image/jpeg;base64,page${index}`),
    close: jest.fn(),
  };
  NativeModules.CareConnectCertificatePdf = pdf;
  const external = jest.spyOn(Linking, 'openURL');
  const f = fixture({ files: [serverFile] });
  const screen = await open(f);
  try {
    expect(screen.queryByRole('button', { name: 'Sửa chứng chỉ: Server certificate' })).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem chứng chỉ: Server certificate' }),
    );
    expect(screen.queryByText('ABC')).toBeNull();
    expect(screen.queryByLabelText('Tên chứng chỉ *')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu chứng chỉ' })).toBeNull();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xem tài liệu: qualification.pdf' }),
    );
    await screen.findByLabelText('qualification.pdf');
    expect(pdf.open).toHaveBeenCalledWith(serverFile.downloadUrl);
    expect(pdf.render).toHaveBeenCalledWith(4, 0);
    await fireEvent.press(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(pdf.render).toHaveBeenCalledWith(4, 1));
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng biểu mẫu chứng chỉ' }));
    expect(pdf.close).toHaveBeenCalledWith(4);
    expect(external).not.toHaveBeenCalled();
    expect(f.writes()).toHaveLength(0);
  } finally {
    await screen.unmount();
    NativeModules.CareConnectCertificatePdf = originalModule;
    external.mockRestore();
  }
});

test('saved certificate supports an attachment upload without updating its metadata', async () => {
  const f = fixture();
  const screen = await open(f);
  try {
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem chứng chỉ: Server certificate' }),
    );
    await screen.findByText('Chưa có tệp minh chứng.');
    await selectFile(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu chứng chỉ' })).toBeNull());
    expect(f.writes()).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/provider-media/CERTIFICATE/cert-existing',
      }),
    ]);
  } finally {
    await screen.unmount();
  }
});
