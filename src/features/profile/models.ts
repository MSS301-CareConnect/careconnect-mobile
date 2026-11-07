import { number, object, required, text } from '../../core/json';

export type CertificateDraft = {
  name: string;
  issuedBy: string;
  credential: string;
  issuedDate: string;
  expiryDate: string;
};
export type Certificate = CertificateDraft & {
  id: string;
  status: string;
  reason: string;
  version: number;
};
export type ProfileMedia = {
  id: string;
  name: string;
  type: string;
  contentType: string;
  size?: number;
  order: number;
  url: string;
  expiresAt: string;
};
export type AccountSession = {
  id: string;
  deviceId: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

function version(value: unknown) {
  const result = number(value);
  if (result === undefined || !Number.isSafeInteger(result) || result < 0)
    throw new Error('Invalid optimistic version');
  return result;
}
export function parseCertificate(value: unknown): Certificate {
  const j = object(value);
  return {
    id: required(j.id),
    name: required(j.certificateName),
    issuedBy: required(j.issuedBy),
    credential: text(j.credentialNumber),
    issuedDate: text(j.issuedDate),
    expiryDate: text(j.expiryDate),
    status: required(j.verificationStatus),
    reason: text(j.verificationReason),
    version: version(j.version),
  };
}
export function parseProfileMedia(value: unknown): ProfileMedia {
  const j = object(value);
  return {
    id: required(j.mediaFileId),
    name: text(j.originalFileName),
    type: required(j.mediaFileType),
    contentType: text(j.contentType),
    size: number(j.fileSize),
    order: version(j.displayOrder),
    url: text(j.downloadUrl),
    expiresAt: text(j.downloadUrlExpiresAt),
  };
}
export function newestAvatar(files: ProfileMedia[], now = Date.now()) {
  return files
    .filter(
      (file) =>
        file.type === 'IMAGE' &&
        file.url.startsWith('https://') &&
        (!file.expiresAt || Date.parse(file.expiresAt) > now),
    )
    .sort((a, b) => b.order - a.order)[0];
}
export function validCertificateDate(value: string) {
  if (!value) return true;
  const instant = Date.parse(value + 'T00:00:00Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  );
}
export function validCertificate(value: CertificateDraft) {
  return (
    !!value.name.trim() &&
    value.name.length <= 255 &&
    !!value.issuedBy.trim() &&
    value.issuedBy.length <= 255 &&
    value.credential.length <= 255 &&
    validCertificateDate(value.issuedDate) &&
    validCertificateDate(value.expiryDate) &&
    (!value.issuedDate || !value.expiryDate || value.expiryDate >= value.issuedDate)
  );
}
export function validateProfileFile(
  file: { mimeType?: string; size?: number },
  purpose: 'avatar' | 'certificate',
) {
  const types =
    purpose === 'avatar'
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['application/pdf', 'image/jpeg', 'image/png'];
  const max = (purpose === 'avatar' ? 5 : 10) * 1024 * 1024;
  if (
    !types.includes(file.mimeType ?? '') ||
    file.size === undefined ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size > max
  )
    throw new Error('Invalid profile file');
}
export function parseAccountSession(value: unknown): AccountSession {
  const j = object(value);
  if (typeof j.isCurrent !== 'boolean') throw new Error('Invalid current session flag');
  return {
    id: required(j.sessionId),
    deviceId: text(j.deviceId),
    userAgent: text(j.userAgent),
    ip: text(j.ip),
    createdAt: text(j.createdAt),
    lastActiveAt: text(j.lastActiveAt),
    current: j.isCurrent,
  };
}
