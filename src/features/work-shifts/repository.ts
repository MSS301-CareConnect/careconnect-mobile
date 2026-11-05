import { ApiClient, ApiError } from '../../core/api';
import { object, page, required, text } from '../../core/json';
import { vietnamDay } from '../../core/time';
import {
  hasActiveRegistration,
  parseRegistration,
  parseWorkShift,
  Registration,
  registrationShift,
} from './models';

export type ShiftFilters = {
  fromDate?: string;
  toDate?: string;
  shiftType?: string;
  hasVacancy?: boolean;
};

export class WorkShiftRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async open(p = 0, size = 20, filters: ShiftFilters = {}) {
    return page(
      await this.api.request('GET', '/work-shifts', undefined, {
        status: 'OPEN',
        page: p,
        size,
        ...filters,
        hasVacancy: filters.hasVacancy === undefined ? undefined : String(filters.hasVacancy),
      }),
      parseWorkShift,
    );
  }
  async shift(id: string) {
    return parseWorkShift(await this.api.request('GET', `/work-shifts/${id}`));
  }
  async registrations(p = 0, size = 20, status?: 'PENDING' | 'APPROVED') {
    return page(
      await this.api.request('GET', '/work-shifts/registrations/me', undefined, {
        page: p,
        size,
        status,
      }),
      parseRegistration,
    );
  }
  async mine(p = 0, status?: 'PENDING' | 'APPROVED') {
    const registrations = await this.registrations(p, 20, status);
    const ids = [
      ...new Set(
        registrations.items.filter((r) => !registrationShift(r)).map((r) => r.workShiftId),
      ),
    ];
    const shifts = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await this.shift(id).catch(() => undefined)] as const),
      ),
    );
    return {
      ...registrations,
      items: registrations.items.map((registration) => ({
        registration,
        shift: registrationShift(registration) ?? shifts.get(registration.workShiftId),
      })),
    };
  }
  async registrationOverview() {
    const [open, pending, approved, profile] = await Promise.all([
      this.open(0, 1, { fromDate: vietnamDay() }),
      this.registrations(0, 1, 'PENDING'),
      this.registrations(0, 1, 'APPROVED'),
      this.api.request('GET', '/caregivers/me'),
    ]);
    return {
      open: open.totalElements,
      pending: pending.totalElements,
      approved: approved.totalElements,
      centerName: text(object(profile).centerName),
    };
  }
  private async allRegistrations() {
    const items: Registration[] = [];
    for (let p = 0; ; p++) {
      const result = await this.registrations(p, 100);
      items.push(...result.items);
      if (p + 1 >= result.totalPages) return items;
    }
  }
  private async registrationForShift(id: string) {
    const matches = (await this.allRegistrations()).filter((r) => r.workShiftId === id);
    return matches.find(hasActiveRegistration) ?? matches[0];
  }
  async board(now = Date.now(), p = 0, filters: ShiftFilters = {}) {
    const [shifts, registrations, profile] = await Promise.all([
      this.open(p, 20, { fromDate: vietnamDay(new Date(now)), ...filters }),
      this.allRegistrations(),
      this.api.request('GET', '/caregivers/me'),
    ]);
    const j = object(profile);
    const active = new Map(
      registrations.filter(hasActiveRegistration).map((r) => [r.workShiftId, r]),
    );
    return {
      ...shifts,
      centerName: text(j.centerName),
      loadedAt: now,
      eligible:
        required(j.caregiverStatus) === 'ACTIVE' &&
        required(j.verificationStatus) === 'VERIFIED' &&
        (!j.centerStatus || j.centerStatus === 'ACTIVE'),
      items: shifts.items.map((shift) => ({ shift, registration: active.get(shift.id) })),
    };
  }
  async detail(id: string) {
    const [shiftResult, registration, profile] = await Promise.all([
      this.shift(id).then(
        (shift) => ({ shift, error: undefined }),
        (error: unknown) => ({ shift: undefined, error }),
      ),
      this.registrationForShift(id),
      this.api.request('GET', '/caregivers/me'),
    ]);
    if (!shiftResult.shift && !registration) throw shiftResult.error;
    const j = object(profile);
    return {
      shift: shiftResult.shift,
      registration,
      eligible:
        required(j.caregiverStatus) === 'ACTIVE' &&
        required(j.verificationStatus) === 'VERIFIED' &&
        (!j.centerStatus || j.centerStatus === 'ACTIVE'),
    };
  }
  async register(id: string, note: string) {
    if (note.length > 2000) throw new Error('Registration note exceeds limit');
    const response = await this.api.request('POST', `/work-shifts/${id}/registrations`, {
      caregiverNote: note.trim() || undefined,
    });
    try {
      return parseRegistration(response);
    } catch {
      // The server accepted the write, but its resulting state could not be read.
      throw new ApiError(0, 0, true);
    }
  }
  async cancel(registration: Registration) {
    if (registration.status !== 'PENDING')
      throw new Error('Only pending registrations may be cancelled');
    return this.api.request('DELETE', `/work-shifts/registrations/${registration.id}`, undefined, {
      version: registration.version,
    });
  }
}
