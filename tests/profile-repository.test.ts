import { expect, test } from '@jest/globals';
import { ProfileRepository } from '../src/features/profile/repository';
import { ApiError } from '../src/core/api';
import type { Certificate } from '../src/features/profile/models';

test('certificate creation checkpoints the server ID before upload failure and does not recreate it', async () => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  let fail = true;
  const repo = new ProfileRepository({
    request: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path.startsWith('/certificates/'))
        return {
          id: 'certificate',
          certificateName: 'Qualification',
          issuedBy: 'Training center',
          verificationStatus: 'PENDING',
          version: 4,
        };
      if (fail) throw new ApiError(503, 7001, true);
      return [
        {
          mediaFileId: 'file',
          mediaFileType: 'DOCUMENT',
          displayOrder: 0,
          downloadUrl: 'https://files.example.test/cert.pdf',
        },
      ];
    },
  });
  const draft = {
    name: 'Qualification',
    issuedBy: 'Training center',
    credential: '',
    issuedDate: '',
    expiryDate: '',
  };
  const file = {
    uri: 'content://fixture/certificate',
    name: 'certificate.pdf',
    mimeType: 'application/pdf',
    size: 10,
  };
  let checkpoint: Certificate | undefined;
  await expect(
    repo.saveCertificateWithFile('caregiver', draft, undefined, file, (value) => {
      checkpoint = value;
    }),
  ).rejects.toMatchObject({ uncertain: true });
  expect(checkpoint?.id).toBe('certificate');
  expect(checkpoint?.version).toBe(4);
  fail = false;
  await repo.saveCertificateWithFile('caregiver', draft, checkpoint, file, () => undefined);
  expect(calls.filter((call) => call.path.startsWith('/certificates/'))).toHaveLength(1);
  expect(
    calls.filter((call) => call.path === '/provider-media/CERTIFICATE/certificate'),
  ).toHaveLength(2);
});

test('certificate update and delete preserve actual version; malformed write response is uncertain', async () => {
  const calls: { method: string; path: string; body: unknown; query: unknown }[] = [];
  const repo = new ProfileRepository({
    request: async (method, path, body, query) => {
      calls.push({ method, path, body, query });
      return {};
    },
  });
  const cert = {
    id: 'certificate',
    name: 'Qualification',
    issuedBy: 'Training center',
    credential: '',
    issuedDate: '',
    expiryDate: '',
    version: 9,
    status: 'VERIFIED',
    reason: '',
  };
  await expect(repo.saveCertificate('caregiver', cert, cert)).rejects.toMatchObject({
    uncertain: true,
  });
  expect(calls[0]).toMatchObject({
    method: 'PUT',
    path: '/certificates/certificate',
    body: { version: 9 },
  });
  await repo.deleteCertificate(cert);
  expect(calls[1]).toMatchObject({ method: 'DELETE', query: { version: 9 } });
});
