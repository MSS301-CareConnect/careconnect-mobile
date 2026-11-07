import { ApiClient, ApiError } from '../../core/api';
import { array, number, object, required, text } from '../../core/json';
import { PickedDocument } from '../../core/documents';
import {
  Certificate,
  CertificateDraft,
  AccountSession,
  parseAccountSession,
  parseCertificate,
  parseProfileMedia,
  validCertificate,
  validateProfileFile,
} from './models';
export class ProfileRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async profile() {
    const j = object(await this.api.request('GET', '/caregivers/me'));
    return {
      id: required(j.id),
      fullName: text(j.fullName),
      dateOfBirth: text(j.dateOfBirth),
      gender: text(j.gender),
      center: text(j.centerName),
      centerStatus: text(j.centerStatus),
      bio: text(j.bio),
      experience: number(j.experienceYears),
      rating: number(j.ratingAverage),
      verification: text(j.verificationStatus),
      status: text(j.caregiverStatus),
    };
  }
  async skills(id: string) {
    return array(await this.api.request('GET', `/caregivers/${id}/services`)).map((v) => {
      const j = object(v);
      return { id: required(j.centerServiceId), name: text(j.serviceName) };
    });
  }
  async certificates(id: string) {
    return array(await this.api.request('GET', `/certificates/caregivers/${id}`)).map(
      parseCertificate,
    );
  }
  async media(type: string, id: string) {
    return array(await this.api.request('GET', `/provider-media/${type}/${id}`)).map(
      parseProfileMedia,
    );
  }
  async uploadMedia(type: 'CAREGIVER_PROFILE' | 'CERTIFICATE', id: string, file: PickedDocument) {
    validateProfileFile(file, type === 'CAREGIVER_PROFILE' ? 'avatar' : 'certificate');
    const body = new FormData();
    body.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    const result = await this.api.request('POST', `/provider-media/${type}/${id}`, body);
    try {
      const files = array(result).map(parseProfileMedia);
      if (!files.length) throw new Error('Empty media write result');
      return files;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async removeMedia(type: 'CAREGIVER_PROFILE' | 'CERTIFICATE', id: string, mediaId: string) {
    return this.api.request('DELETE', `/provider-media/${type}/${id}/${mediaId}`);
  }
  async createCertificate(caregiverId: string, value: CertificateDraft) {
    if (!validCertificate(value)) throw new Error('Invalid certificate');
    const result = await this.api.request('POST', `/certificates/caregivers/${caregiverId}`, {
      certificateName: value.name.trim(),
      issuedBy: value.issuedBy.trim(),
      credentialNumber: value.credential.trim() || null,
      issuedDate: value.issuedDate || null,
      expiryDate: value.expiryDate || null,
    });
    try {
      return parseCertificate(result);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async deleteCertificate(value: Certificate) {
    if (!Number.isSafeInteger(value.version) || value.version < 0)
      throw new Error('Invalid certificate version');
    return this.api.request('DELETE', `/certificates/${value.id}`, undefined, {
      version: value.version,
    });
  }
  async saveCertificateWithFile(
    caregiverId: string,
    draft: CertificateDraft,
    existing: Certificate | undefined,
    file: PickedDocument,
    checkpoint: (value: Certificate, uploaded: boolean) => void,
  ) {
    validateProfileFile(file, 'certificate');
    const saved = existing ?? (await this.createCertificate(caregiverId, draft));
    checkpoint(saved, false);
    await this.uploadMedia('CERTIFICATE', saved.id, file);
    checkpoint(saved, true);
    return saved;
  }
  async sessions() {
    return array(await this.api.request('GET', '/auth/sessions')).map(parseAccountSession);
  }
  async revokeSession(id: string) {
    return this.api.request('DELETE', `/auth/sessions/${encodeURIComponent(id)}`);
  }
  async revokeOtherSessions(sessions: AccountSession[]) {
    const current = sessions.filter((item) => item.current);
    const currentId = current[0]?.id;
    if (current.length !== 1 || !currentId)
      throw new Error('Current session must be identified before revoking other sessions');
    const ids = new Set(
      sessions.filter((item) => !item.current && item.id !== currentId).map((item) => item.id),
    );
    // The backend has no bulk endpoint. Stop on the first failure; never replay this batch.
    for (const id of ids) await this.revokeSession(id);
  }
}
