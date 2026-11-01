import { ApiClient, ApiError } from '../../core/api';
import { array, number, object, page, required, text } from '../../core/json';
import { parseSchedule, ProviderSchedule } from './schedule';
export class ProfileRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async profile() {
    const j = object(await this.api.request('GET', '/caregivers/me'));
    return {
      id: required(j.id),
      fullName: text(j.fullName),
      center: text(j.centerName),
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
    return array(await this.api.request('GET', `/certificates/caregivers/${id}`)).map((v) => {
      const j = object(v);
      return {
        id: required(j.id),
        name: text(j.certificateName),
        issuedBy: text(j.issuedBy),
        issuedDate: text(j.issuedDate),
        expiryDate: text(j.expiryDate),
        status: text(j.verificationStatus),
      };
    });
  }
  async media(type: string, id: string) {
    return array(await this.api.request('GET', `/provider-media/${type}/${id}`)).map((v) => {
      const j = object(v);
      return {
        id: required(j.mediaFileId),
        url: text(j.downloadUrl),
        name: text(j.originalFileName),
      };
    });
  }
  async schedules(p = 0) {
    return page(
      await this.api.request('GET', '/caregivers/me/schedules', undefined, { page: p, size: 20 }),
      parseSchedule,
    );
  }
  async cancelSchedule(schedule: ProviderSchedule, reason: string) {
    if (
      schedule.status !== 'SCHEDULED' ||
      !Number.isSafeInteger(schedule.version) ||
      schedule.version < 0 ||
      !reason.trim() ||
      reason.length > 500
    )
      throw new Error('Invalid schedule cancellation');
    const response = await this.api.request(
      'PATCH',
      `/caregivers/schedules/${encodeURIComponent(schedule.id)}/status`,
      { status: 'CANCELLED', reason: reason.trim(), version: schedule.version },
    );
    try {
      const result = parseSchedule(response);
      if (result.id !== schedule.id || result.status !== 'CANCELLED')
        throw new Error('Inconsistent schedule cancellation response');
      return result;
    } catch {
      // A successful write with an unreadable result must never be replayed automatically.
      throw new ApiError(0, 0, true);
    }
  }
}
