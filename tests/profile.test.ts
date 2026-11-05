import { expect, test } from '@jest/globals';
import { isStrongPassword, utf8Length } from '../src/core/validation';
import {
  newestAvatar,
  validCertificate,
  validateProfileFile,
} from '../src/features/profile/models';

test('password validation follows strength and the backend 72 UTF-8 byte limit', () => {
  expect(isStrongPassword('Aa1!abcd')).toBe(true);
  expect(isStrongPassword('lowercase1!')).toBe(false);
  expect(isStrongPassword('Uppercase!')).toBe(false);
  const boundary = 'Aa1!' + 'é'.repeat(34);
  expect(utf8Length(boundary)).toBe(72);
  expect(isStrongPassword(boundary)).toBe(true);
  expect(isStrongPassword(boundary + 'é')).toBe(false);
  expect(utf8Length('Aa1!' + '😀'.repeat(17))).toBe(72);
  expect(isStrongPassword('Aa1!\nabc')).toBe(false);
});

test('certificate dates permit equal issue and expiry, but reject reversed or invalid dates', () => {
  const draft = {
    name: 'Qualification',
    issuedBy: 'Training center',
    credential: '',
    issuedDate: '2026-11-05',
    expiryDate: '2026-11-05',
  };
  expect(validCertificate(draft)).toBe(true);
  expect(validCertificate({ ...draft, expiryDate: '2026-11-04' })).toBe(false);
  expect(validCertificate({ ...draft, issuedDate: '2026-02-30' })).toBe(false);
  expect(validCertificate({ ...draft, name: ' ' })).toBe(false);
});

test('avatar selection uses the newest non-expired IMAGE instead of the first URL', () => {
  const now = Date.parse('2026-11-05T00:00:00Z');
  const base = {
    name: 'avatar.jpg',
    contentType: 'image/jpeg',
    size: 20,
    expiresAt: '2026-11-06T00:00:00Z',
    type: 'IMAGE',
  };
  const selected = newestAvatar(
    [
      { ...base, id: 'old', order: 1, url: 'https://files.example.test/old' },
      { ...base, id: 'new', order: 4, url: 'https://files.example.test/new' },
      {
        ...base,
        id: 'expired',
        order: 9,
        expiresAt: '2026-11-04T00:00:00Z',
        url: 'https://files.example.test/expired',
      },
      {
        ...base,
        id: 'document',
        type: 'DOCUMENT',
        order: 10,
        url: 'https://files.example.test/document',
      },
    ],
    now,
  );
  expect(selected?.id).toBe('new');
});

test('profile file rules separate avatar and certificate content/size limits', () => {
  expect(() =>
    validateProfileFile({ mimeType: 'image/webp', size: 5 * 1024 * 1024 }, 'avatar'),
  ).not.toThrow();
  expect(() => validateProfileFile({ mimeType: 'application/pdf', size: 1 }, 'avatar')).toThrow();
  expect(() =>
    validateProfileFile({ mimeType: 'application/pdf', size: 10 * 1024 * 1024 }, 'certificate'),
  ).not.toThrow();
  expect(() => validateProfileFile({ mimeType: 'image/webp', size: 10 }, 'certificate')).toThrow();
  expect(() => validateProfileFile({ mimeType: 'image/png' }, 'avatar')).toThrow();
});
