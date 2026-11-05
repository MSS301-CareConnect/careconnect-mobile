import { number, object, required, text } from '../../core/json';

export type ShiftOverview = {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  status: string;
  cancellationReason: string;
};
export type WorkShift = ShiftOverview & {
  centerId: string;
  centerName: string;
  capacity: number;
  approvedCount: number;
  registrationDeadline: string;
  note: string;
  version: number;
  cancelledAt: string;
};
export type Registration = {
  id: string;
  workShiftId: string;
  status: string;
  caregiverNote: string;
  rejectionReason: string;
  createdAt: string;
  reviewedAt: string;
  version: number;
  workDate: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  shiftStatus: string;
  shiftCancellationReason: string;
  scheduleId: string;
  scheduleStatus: string;
  scheduleVersion?: number;
};
function integer(value: unknown, minimum = 0): number {
  const result = number(value);
  if (result === undefined || !Number.isSafeInteger(result) || result < minimum)
    throw new Error('Invalid work-shift number');
  return result;
}
function validateInterval(value: { workDate: string; startTime: string; endTime: string }) {
  const midnight = Date.parse(`${value.workDate}T00:00:00Z`);
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.workDate) ||
    !Number.isFinite(midnight) ||
    new Date(midnight).toISOString().slice(0, 10) !== value.workDate ||
    !clock.test(value.startTime) ||
    !clock.test(value.endTime) ||
    Date.parse(`${value.workDate}T${value.endTime}+07:00`) <=
      Date.parse(`${value.workDate}T${value.startTime}+07:00`)
  )
    throw new Error('Invalid work-shift interval');
}
export function parseWorkShift(value: unknown): WorkShift {
  const j = object(value);
  const result: WorkShift = {
    id: required(j.id),
    centerId: required(j.centerId),
    centerName: text(j.centerName),
    workDate: required(j.workDate),
    startTime: required(j.startTime),
    endTime: required(j.endTime),
    shiftType: text(j.shiftType),
    status: required(j.shiftStatus),
    capacity: integer(j.capacity, 1),
    approvedCount: integer(j.approvedCount),
    registrationDeadline: text(j.registrationDeadline),
    note: text(j.note),
    version: integer(j.version),
    cancellationReason: text(j.cancellationReason),
    cancelledAt: text(j.cancelledAt),
  };
  validateInterval(result);
  if (
    !Number.isFinite(shiftStart(result)) ||
    (result.registrationDeadline && !Number.isFinite(Date.parse(result.registrationDeadline)))
  )
    throw new Error('Invalid work-shift date');
  return result;
}
export function parseRegistration(value: unknown): Registration {
  const j = object(value);
  const result = {
    id: required(j.id),
    workShiftId: required(j.workShiftId),
    status: required(j.registrationStatus),
    caregiverNote: text(j.caregiverNote),
    rejectionReason: text(j.rejectionReason),
    createdAt: text(j.createdAt),
    reviewedAt: text(j.reviewedAt),
    version: integer(j.version),
    workDate: text(j.workDate),
    startTime: text(j.startTime),
    endTime: text(j.endTime),
    shiftType: text(j.shiftType),
    shiftStatus: text(j.shiftStatus),
    shiftCancellationReason: text(j.shiftCancellationReason),
    scheduleId: text(j.scheduleId),
    scheduleStatus: text(j.scheduleStatus),
    scheduleVersion: j.scheduleVersion == null ? undefined : integer(j.scheduleVersion),
  };
  if (result.workDate || result.startTime || result.endTime) validateInterval(result);
  return result;
}
export function registrationShift(registration: Registration): ShiftOverview | undefined {
  if (!registration.workDate || !registration.startTime || !registration.endTime) return;
  return {
    id: registration.workShiftId,
    workDate: registration.workDate,
    startTime: registration.startTime,
    endTime: registration.endTime,
    shiftType: registration.shiftType,
    status: registration.shiftStatus,
    cancellationReason: registration.shiftCancellationReason,
  };
}
export function shiftStart(shift: WorkShift) {
  return Date.parse(`${shift.workDate}T${shift.startTime}+07:00`);
}
export function hasActiveRegistration(registration?: Registration) {
  return registration?.status === 'PENDING' || registration?.status === 'APPROVED';
}
export function registrationBlockReason(
  shift: WorkShift,
  registration: Registration | undefined,
  eligible: boolean,
  now = Date.now(),
) {
  if (!eligible) return 'workShiftEligibility';
  if (hasActiveRegistration(registration)) return 'workShiftAlreadyRegistered';
  if (shift.status !== 'OPEN') return 'workShiftNotOpen';
  if (now >= shiftStart(shift)) return 'workShiftStarted';
  if (shift.registrationDeadline && now >= Date.parse(shift.registrationDeadline))
    return 'workShiftDeadlinePassed';
  if (shift.approvedCount >= shift.capacity) return 'workShiftFull';
  return undefined;
}
