import { expect, jest, test } from '@jest/globals';
import { parseQuota, validChatImages } from '../src/features/assistant/models';
import { weekFigures } from '../src/features/home/week-model';
import { parseVisit } from '../src/features/visits/models';

const quota = parseQuota({
  guest: false,
  maxPromptLength: 800,
  imagesAllowed: true,
  maxImages: 2,
  maxImageSizeMb: 3,
  maxTotalImageSizeMb: 4,
});
const image = {
  uri: 'content://image',
  name: 'example.png',
  mimeType: 'image/png',
  size: 3 * 1024 ** 2,
};

test('assistant sends a JSON multipart part with the signed-in conversation and uses the long gateway timeout', async () => {
  const originalFormData = Object.getOwnPropertyDescriptor(globalThis, 'FormData');
  Object.defineProperty(globalThis, 'FormData', {
    configurable: true,
    value: jest.requireActual<{ default: typeof FormData }>(
      'react-native/Libraries/Network/FormData',
    ).default,
  });
  try {
    const { AssistantRepository } = jest.requireActual<
      typeof import('../src/features/assistant/repository')
    >('../src/features/assistant/repository');
    const request = jest.fn(
      async (
        _method: string,
        _path: string,
        _body?: unknown,
        _query?: unknown,
        _options?: unknown,
      ) => ({ conversationId: 'c', conversationTitle: 'Chăm sóc', answer: 'Trả lời' }),
    );
    const repo = new AssistantRepository({ request });
    await expect(repo.send('  Câu hỏi ', 'c', [image], quota)).resolves.toMatchObject({
      id: 'c',
      answer: 'Trả lời',
    });
    const [method, path, body, query, options] = request.mock.calls[0]!;
    expect([method, path, query, options]).toEqual([
      'POST',
      '/ai/chat',
      undefined,
      { timeoutMs: 95000 },
    ]);
    expect((body as FormData).getParts()).toEqual([
      expect.objectContaining({
        string: JSON.stringify({ prompt: 'Câu hỏi', conversationId: 'c' }),
        headers: {
          'content-disposition': 'form-data; name="request"',
          'content-type': 'application/json; charset=utf-8',
        },
      }),
      expect.objectContaining({ uri: image.uri, type: image.mimeType, name: image.name }),
    ]);
    expect(validChatImages([image, image], quota)).toBe(false);
    expect(validChatImages([{ ...image, name: 'invalid.pdf' }], quota)).toBe(false);
    await expect(repo.send('Câu hỏi', 'c', [image, image], quota)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce({
      conversationId: 'other',
      conversationTitle: 'Chat',
      answer: 'Reply',
    });
    await expect(repo.send('Câu hỏi', 'c', [], quota)).rejects.toMatchObject({ uncertain: true });
  } finally {
    if (originalFormData) Object.defineProperty(globalThis, 'FormData', originalFormData);
    else Reflect.deleteProperty(globalThis, 'FormData');
  }
});

test('weekly statistics group by Vietnam days and preserve closed, missed and open time', () => {
  const visit = (id: string, status: string, startAt: string, endAt: string) =>
    parseVisit({ id, bookingId: 'b', status, startAt, endAt });
  const results = weekFigures(
    '2026-11-09',
    [
      visit('1', 'COMPLETED', '2026-11-08T18:00:00Z', '2026-11-08T19:00:00Z'),
      visit('2', 'CAREGIVER_MISSED', '2026-11-09T00:00:00Z', '2026-11-09T01:30:00Z'),
      visit('3', 'ACKNOWLEDGED', '2026-11-09T05:00:00Z', '2026-11-09T07:00:00Z'),
      visit('4', 'CANCELLED', '2026-11-09T09:00:00Z', '2026-11-09T10:00:00Z'),
    ],
    [
      {
        id: 's',
        date: '2026-11-09',
        start: '08:00',
        end: '17:00',
        status: 'SCHEDULED',
        version: 2,
        note: '',
        cancellationReason: '',
      },
    ],
  );
  expect(results).toHaveLength(7);
  expect(results[0]).toEqual({
    day: '2026-11-09',
    count: 3,
    done: 1,
    completed: 60,
    upcoming: 120,
    missed: 90,
    available: 540,
  });
  expect(results[1]).toMatchObject({ day: '2026-11-10', count: 0, available: 0 });
});
