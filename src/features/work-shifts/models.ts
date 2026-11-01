import { number, object, required, text } from '../../core/json';

export type WorkShift = {
  id: string;
  centerId: string;
  centerName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  status: string;
  capacity: number;
  approvedCount: number;
  registrationDeadline: string;
  note: string;
  version: number;
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
};
function integer(value: unknown, minimum = 0): number {
  const result = number(value);
  if (result === undefined || !Number.isSafeInteger(result) || result < minimum)
    throw new Error('Invalid work-shift number');
  return result;
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
  };
  if (
    !Number.isFinite(shiftStart(result)) ||
    (result.registrationDeadline && !Number.isFinite(Date.parse(result.registrationDeadline)))
  )
    throw new Error('Invalid work-shift date');
  return result;
}
export function parseRegistration(value: unknown): Registration {
  const j = object(value);
  return {
    id: required(j.id),
    workShiftId: required(j.workShiftId),
    status: required(j.registrationStatus),
    caregiverNote: text(j.caregiverNote),
    rejectionReason: text(j.rejectionReason),
    createdAt: text(j.createdAt),
    reviewedAt: text(j.reviewedAt),
    version: integer(j.version),
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
