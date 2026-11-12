import { ApiClient, ApiError } from '../../core/api';
import { page } from '../../core/json';
import { Absence, AbsenceStatus, parseAbsence } from './models';

const PAGE_SIZE = 20;
// BookingService scopes the list to the signed-in caregiver; no caregiver id is sent.
export class AbsenceRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async list(status: AbsenceStatus | undefined, p = 0, bookingId?: string) {
    return page(
      await this.api.request('GET', '/caregiver-absences', undefined, {
        ...(status ? { status } : {}),
        ...(bookingId ? { bookingId } : {}),
        page: p,
        size: PAGE_SIZE,
      }),
      parseAbsence,
    );
  }
  async forVisit(bookingId: string, occurrenceId: string) {
    for (let p = 0; ; p++) {
      const result = await this.list(undefined, p, bookingId);
      const found = result.items.find((item) => item.occurrenceId === occurrenceId);
      if (found || p + 1 >= result.totalPages) return found ?? null;
    }
  }
  async pending() {
    const items: Absence[] = [];
    for (let p = 0; ; p++) {
      const result = await this.list('PENDING', p);
      items.push(...result.items);
      if (p + 1 >= result.totalPages) return items;
    }
  }
  async unexplainedCount() {
    return (await this.pending()).filter((item) => !item.explanation.trim()).length;
  }
  async get(id: string) {
    return parseAbsence(await this.api.request('GET', `/caregiver-absences/${id}`));
  }
  async explain(id: string, explanation: string) {
    const result = await this.api.request('POST', `/caregiver-absences/${id}/explanation`, {
      explanation,
    });
    try {
      const saved = parseAbsence(result);
      if (saved.id !== id || saved.explanation !== explanation.trim())
        throw new Error('Unexpected absence response');
      return saved;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
}
