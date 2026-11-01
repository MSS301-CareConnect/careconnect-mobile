import React from 'react';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { Alert } from 'react-native';
import { pickDocuments } from '../src/core/documents';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { ApiClient } from '../src/core/api';

const page = (items: unknown[]) => ({ items, page: 0, totalPages: 1, totalElements: items.length });
jest.mock('../src/core/documents', () => ({ pickDocuments: jest.fn() }));
const pick = jest.mocked(pickDocuments);
const photo = {
  uri: 'content://fixture/photo',
  name: 'photo.png',
  mimeType: 'image/png',
  size: 1024,
  lastModified: 1,
};
beforeEach(() => {
  pick.mockReset();
});
function fixture(
  existing = false,
  options: { uncertainSave?: boolean; uncertainUpload?: boolean } = {},
) {
  let token: string | null = 'refresh';
  let report = existing
    ? {
        id: 'report',
        sessionId: 'session',
        status: 'DRAFT',
        version: 7,
        overallCondition: 'IMPROVED',
        summary: 'Saved summary',
        recommendations: 'Saved recommendations',
        mealNotes: 'Saved meal note',
        medicationNotes: 'Saved medication note',
        mobilityNotes: 'Saved mobility note',
        moodNotes: 'Saved mood note',
        photos: [] as { mediaFileId: string; downloadUrl: string }[],
      }
    : undefined;
  const writes: { method?: string; body: Record<string, unknown> }[] = [];
  const events: string[] = [];
  const visit = {
    id: 'visit',
    bookingId: 'booking',
    sessionId: 'session',
    startAt: '2026-11-01T02:00:00Z',
    endAt: '2026-11-01T04:00:00Z',
    status: 'COMPLETED',
    recipientName: 'Report fixture',
    services: [],
  };
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
      let result: unknown;
      if (path === '/auth/refresh') result = { accessToken: 'a', refreshToken: 'r' };
      else if (path === '/users/me')
        result = { id: 'user', roles: ['CAREGIVER'], status: 'ACTIVE' };
      else if (path === '/notifications/unread-count') result = { count: 0 };
      else if (path === '/notifications' || path === '/care-sessions/session/notes')
        result = page([]);
      else if (path === '/booking-occurrences/visit') result = visit;
      else if (path === '/booking-occurrences') result = page([visit]);
      else if (path === '/care-sessions/session')
        result = { sessionId: 'session', bookingId: 'booking', status: 'ENDED', tasks: [] };
      else if (path === '/care-reports' && init?.method === 'GET')
        result = page(report ? [report] : []);
      else if (path === '/care-reports/report/photos' && report) {
        events.push('upload');
        report = {
          ...report,
          version: report.version + 1,
          photos: [{ mediaFileId: 'media', downloadUrl: 'https://example.test/photo.png' }],
        };
        if (options.uncertainUpload) throw new TypeError('Network interrupted after upload');
        result = report;
      } else if (path === '/care-reports/report/submit' && report) {
        events.push('submit');
        report = { ...report, status: 'SUBMITTED', version: report.version + 1 };
        result = report;
      } else if (path === '/care-reports' || path === '/care-reports/report') {
        events.push('save');
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        writes.push({ method: init?.method, body });
        report = {
          id: 'report',
          sessionId: String(body.sessionId),
          status: 'DRAFT',
          version: Number(body.version ?? 0) + 1,
          overallCondition: String(body.overallCondition),
          summary: String(body.summary),
          recommendations: String(body.recommendations),
          mealNotes: String(body.mealNotes),
          medicationNotes: String(body.medicationNotes),
          mobilityNotes: String(body.mobilityNotes),
          moodNotes: String(body.moodNotes),
          photos: report?.photos ?? [],
        };
        if (options.uncertainSave && writes.length === 1)
          throw new TypeError('Network interrupted after save');
        result = report;
      } else return new Response(JSON.stringify({ code: 404 }), { status: 404 });
      return new Response(JSON.stringify({ code: 200, result }), { status: 200 });
    },
  );
  return { api, writes, events };
}
async function openReport(api: ApiClient) {
  const screen = await render(<App client={api} />);
  await fireEvent.press(await screen.findByText('Report fixture'));
  await fireEvent.press(await screen.findByRole('button', { name: 'Mở ca chăm sóc' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Báo cáo chăm sóc' }));
  await screen.findByLabelText('Khuyến nghị');
  return screen;
}

test('report has only summary and recommendations text fields, with an explicit required condition', async () => {
  const f = fixture();
  const screen = await openReport(f.api);
  try {
    expect(screen.getByLabelText('Tóm tắt buổi chăm sóc')).toBeTruthy();
    for (const label of ['Ăn uống', 'Sử dụng thuốc', 'Vận động', 'Tâm trạng'])
      expect(screen.queryByLabelText(label)).toBeNull();
    expect(screen.getByRole('button', { name: 'Thêm ảnh' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Tóm tắt buổi chăm sóc'), 'Care summary');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    expect(f.writes).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Ổn định' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await waitFor(() => expect(f.writes).toHaveLength(1));
    expect(f.writes[0]).toEqual({
      method: 'POST',
      body: expect.objectContaining({
        overallCondition: 'STABLE',
        summary: 'Care summary',
        recommendations: '',
      }),
    });
  } finally {
    await screen.unmount();
  }
});

test('photos can be selected before saving or filling the report and removed without API writes', async () => {
  const f = fixture();
  const screen = await openReport(f.api);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    expect(f.events).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ ảnh đã chọn: photo.png' }));
    expect(screen.queryByText('photo.png')).toBeNull();
    expect(f.events).toEqual([]);
    expect(pick).toHaveBeenCalledWith({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      multiple: true,
    });
  } finally {
    await screen.unmount();
  }
});

test('saving a report saves its draft before uploading selected photos', async () => {
  const f = fixture();
  const screen = await openReport(f.api);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    await fireEvent.press(screen.getByRole('button', { name: 'Ổn định' }));
    await fireEvent.changeText(screen.getByLabelText('Tóm tắt buổi chăm sóc'), 'Care summary');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await screen.findByRole('button', { name: 'Xem tài liệu' });
    expect(f.events).toEqual(['save', 'upload']);
    expect(screen.queryByText('photo.png')).toBeNull();
  } finally {
    await screen.unmount();
  }
});

test('cancelled and invalid selections retain queued photos and make no requests', async () => {
  const f = fixture(true);
  const screen = await openReport(f.api);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    pick.mockResolvedValueOnce({ canceled: true, assets: null });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    expect(screen.getByText('photo.png')).toBeTruthy();
    for (const assets of [
      [{ ...photo, uri: 'content://fixture/large', size: 11 * 1024 * 1024 }],
      [{ ...photo, uri: 'content://fixture/gif', mimeType: 'image/gif' }],
      Array.from({ length: 5 }, (_, i) => ({ ...photo, uri: `content://fixture/${i}` })),
    ]) {
      pick.mockResolvedValueOnce({ canceled: false, assets });
      await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
      await screen.findByText('Chỉ chọn tối đa 5 ảnh JPEG/PNG/WebP, mỗi ảnh không quá 10 MB.');
      expect(screen.getByText('photo.png')).toBeTruthy();
    }
    expect(f.events).toEqual([]);
  } finally {
    await screen.unmount();
  }
});

test('an uncertain save reconciles its draft ID without losing text or photos or creating twice', async () => {
  const f = fixture(false, { uncertainSave: true });
  const screen = await openReport(f.api);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    await fireEvent.press(screen.getByRole('button', { name: 'Ổn định' }));
    await fireEvent.changeText(screen.getByLabelText('Tóm tắt buổi chăm sóc'), 'Retain summary');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    expect(f.events).toEqual(['save']);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu bản nháp' })).toBeEnabled());
    expect(screen.getByDisplayValue('Retain summary')).toBeTruthy();
    expect(screen.getByText('photo.png')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await screen.findByRole('button', { name: 'Xem tài liệu' });
    expect(f.writes.map((w) => w.method)).toEqual(['POST', 'PUT']);
    expect(f.events).toEqual(['save', 'save', 'upload']);
  } finally {
    await screen.unmount();
  }
});

test('an uncertain photo upload is not repeated after reload until the uncertain selection is removed', async () => {
  const f = fixture(true, { uncertainUpload: true });
  const screen = await openReport(f.api);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await screen.findByText(/Chưa xác định được kết quả/);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
    await screen.findByRole('button', { name: 'Xem tài liệu' });
    expect(screen.getByText('photo.png')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    expect(f.events).toEqual(['save', 'upload']);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ ảnh đã chọn: photo.png' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await waitFor(() => expect(f.events).toEqual(['save', 'upload', 'save']));
  } finally {
    await screen.unmount();
  }
});

test('confirmed submission saves and uploads selected photos before submitting', async () => {
  const f = fixture(true);
  const screen = await openReport(f.api);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    pick.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm ảnh' }));
    await screen.findByText('photo.png');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi báo cáo cho người thân' }));
    expect(f.events).toEqual([]);
    const button = alert.mock.calls
      .at(-1)?.[2]
      ?.find((b) => b.text === 'Gửi báo cáo cho người thân');
    expect(button).toBeTruthy();
    await act(async () => button?.onPress?.());
    await screen.findByText('Báo cáo đã gửi');
    expect(f.events).toEqual(['save', 'upload', 'submit']);
    expect(screen.queryByRole('button', { name: 'Thêm ảnh' })).toBeNull();
  } finally {
    alert.mockRestore();
    await screen.unmount();
  }
});

test('editing the two visible fields preserves existing optional notes and optimistic version', async () => {
  const f = fixture(true);
  const screen = await openReport(f.api);
  try {
    await fireEvent.changeText(screen.getByLabelText('Tóm tắt buổi chăm sóc'), 'Updated summary');
    await fireEvent.changeText(screen.getByLabelText('Khuyến nghị'), 'Updated recommendations');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await waitFor(() => expect(f.writes).toHaveLength(1));
    expect(f.writes[0]).toEqual({
      method: 'PUT',
      body: expect.objectContaining({
        version: 7,
        overallCondition: 'IMPROVED',
        summary: 'Updated summary',
        recommendations: 'Updated recommendations',
        mealNotes: 'Saved meal note',
        medicationNotes: 'Saved medication note',
        mobilityNotes: 'Saved mobility note',
        moodNotes: 'Saved mood note',
      }),
    });
  } finally {
    await screen.unmount();
  }
});
