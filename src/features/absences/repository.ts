import { ApiClient } from '../../core/api';
import { page } from '../../core/json';
import { AbsenceStatus, parseAbsence } from './models';

const PAGE_SIZE = 20;
// BookingService scopes the list to the signed-in caregiver; no caregiver id is sent.
export class AbsenceRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async list(status: AbsenceStatus | undefined, p = 0) {
    return page(
      await this.api.request('GET', '/caregiver-absences', undefined, {
        ...(status ? { status } : {}),
        page: p,
        size: PAGE_SIZE,
      }),
      parseAbsence,
    );
  }
  async get(id: string) {
    return parseAbsence(await this.api.request('GET', `/caregiver-absences/${id}`));
  }
  async explain(id: string, explanation: string) {
    return parseAbsence(
      await this.api.request('POST', `/caregiver-absences/${id}/explanation`, { explanation }),
    );
  }
}
