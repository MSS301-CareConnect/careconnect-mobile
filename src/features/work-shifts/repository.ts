import { ApiClient, ApiError } from '../../core/api';
import { object, page, required, text } from '../../core/json';
import { vietnamDay } from '../../core/time';
import {
  hasActiveRegistration,
  parseRegistration,
  parseWorkShift,
  Registration,
  registrationShift,
  WorkShift,
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
  private async registrationRows() {
    const registrations = await this.allRegistrations();
    const ids = [
      ...new Set(registrations.filter((r) => !registrationShift(r)).map((r) => r.workShiftId)),
    ];
    const shifts = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await this.shift(id).catch(() => undefined)] as const),
      ),
    );
    return registrations.map((registration) => ({
      registration,
      shift: registrationShift(registration) ?? shifts.get(registration.workShiftId),
    }));
  }
  private upcomingRegistration(
    row: { shift?: { workDate: string; startTime: string } },
    now: number,
  ) {
    return !!row.shift && Date.parse(`${row.shift.workDate}T${row.shift.startTime}+07:00`) > now;
  }
  private paginate<T>(items: T[], p: number) {
    if (!Number.isSafeInteger(p) || p < 0) throw new Error('Invalid registration page');
    return {
      items: items.slice(p * 20, (p + 1) * 20),
      page: p,
      totalPages: Math.ceil(items.length / 20),
      totalElements: items.length,
    };
  }
  async mine(p = 0, status?: 'PENDING' | 'APPROVED', now = Date.now()) {
    const rows = (await this.registrationRows()).filter((row) => {
      const upcoming = this.upcomingRegistration(row, now);
      return status
        ? row.registration.status === status && upcoming
        : !hasActiveRegistration(row.registration) || !upcoming;
    });
    if (status)
      rows.sort((a, b) =>
        `${a.shift?.workDate}${a.shift?.startTime}`.localeCompare(
          `${b.shift?.workDate}${b.shift?.startTime}`,
        ),
      );
    return this.paginate(rows, p);
  }
  private async availableOpenShifts(
    registrations: Registration[],
    now: number,
    filters: ShiftFilters = {},
  ) {
    const active = new Set(
      registrations.filter(hasActiveRegistration).map((item) => item.workShiftId),
    );
    const items: WorkShift[] = [];
    // Filter the entire server result before paginating, so registered rows cannot hide candidates.
    for (let p = 0; ; p++) {
      const result = await this.open(p, 100, { fromDate: vietnamDay(new Date(now)), ...filters });
      items.push(
        ...result.items.filter(
          (shift) =>
            shift.status === 'OPEN' &&
            !active.has(shift.id) &&
            Date.parse(`${shift.workDate}T${shift.startTime}+07:00`) > now &&
            (!shift.registrationDeadline || Date.parse(shift.registrationDeadline) > now),
        ),
      );
      if (p + 1 >= result.totalPages) break;
    }
    return items.sort((a, b) =>
      `${a.workDate}${a.startTime}`.localeCompare(`${b.workDate}${b.startTime}`),
    );
  }
  async registrationOverview(now = Date.now()) {
    const [rows, profile] = await Promise.all([
      this.registrationRows(),
      this.api.request('GET', '/caregivers/me'),
    ]);
    const open = await this.availableOpenShifts(
      rows.map((row) => row.registration),
      now,
    );
    return {
      open: open.length,
      pending: rows.filter(
        (row) => row.registration.status === 'PENDING' && this.upcomingRegistration(row, now),
      ).length,
      approved: rows.filter(
        (row) => row.registration.status === 'APPROVED' && this.upcomingRegistration(row, now),
      ).length,
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
    const [registrations, profile] = await Promise.all([
      this.allRegistrations(),
      this.api.request('GET', '/caregivers/me'),
    ]);
    const j = object(profile);
    const shifts = this.paginate(await this.availableOpenShifts(registrations, now, filters), p);
    return {
      ...shifts,
      centerName: text(j.centerName),
      loadedAt: now,
      eligible:
        required(j.caregiverStatus) === 'ACTIVE' &&
        required(j.verificationStatus) === 'VERIFIED' &&
        (!j.centerStatus || j.centerStatus === 'ACTIVE'),
      items: shifts.items.map((shift) => ({ shift })),
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
