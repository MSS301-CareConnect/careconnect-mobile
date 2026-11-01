import { ApiClient, ApiError } from '../../core/api';
import { object, page, required, text } from '../../core/json';
import {
  hasActiveRegistration,
  parseRegistration,
  parseWorkShift,
  Registration,
  shiftStart,
  WorkShift,
} from './models';

export class WorkShiftRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async open(p = 0, size = 20) {
    return page(
      await this.api.request('GET', '/work-shifts', undefined, {
        status: 'OPEN',
        page: p,
        size,
      }),
      parseWorkShift,
    );
  }
  async shift(id: string) {
    return parseWorkShift(await this.api.request('GET', `/work-shifts/${id}`));
  }
  async registrations(p = 0, size = 20) {
    return page(
      await this.api.request('GET', '/work-shifts/registrations/me', undefined, {
        page: p,
        size,
      }),
      parseRegistration,
    );
  }
  async mine(p = 0) {
    const registrations = await this.registrations(p);
    const ids = [...new Set(registrations.items.map((r) => r.workShiftId))];
    const shifts = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await this.shift(id).catch(() => undefined)] as const),
      ),
    );
    return {
      ...registrations,
      items: registrations.items.map((registration) => ({
        registration,
        shift: shifts.get(registration.workShiftId),
      })),
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
  private async allOpen() {
    const items: WorkShift[] = [];
    for (let p = 0; ; p++) {
      const result = await this.open(p, 100);
      items.push(...result.items);
      if (p + 1 >= result.totalPages) return items;
    }
  }
  async board(now = Date.now()) {
    const [shifts, registrations, profile] = await Promise.all([
      this.allOpen(),
      this.allRegistrations(),
      this.api.request('GET', '/caregivers/me'),
    ]);
    const j = object(profile);
    const active = new Map(
      registrations.filter(hasActiveRegistration).map((r) => [r.workShiftId, r]),
    );
    return {
      centerName: text(j.centerName),
      loadedAt: now,
      eligible:
        required(j.caregiverStatus) === 'ACTIVE' && required(j.verificationStatus) === 'VERIFIED',
      items: shifts
        .filter((shift) => shiftStart(shift) > now)
        .sort((a, b) => shiftStart(a) - shiftStart(b))
        .map((shift) => ({ shift, registration: active.get(shift.id) })),
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
        required(j.caregiverStatus) === 'ACTIVE' && required(j.verificationStatus) === 'VERIFIED',
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
