import { number, object, required, text } from '../../core/json';

// BookingService caregiver absences (2026-11-10): a paid visit nobody checked in to. The customer is refunded in full;
// the caregiver explains, the center concludes once (EXCUSED / CONFIRMED). No money moves here.
export type AbsenceStatus = 'PENDING' | 'EXCUSED' | 'CONFIRMED';
export type AbsenceSource = 'MISSED_CHECK_IN' | 'NO_SHOW_REPORT_REJECTED';
export type Absence = {
  id: string;
  bookingId: string;
  bookingCode: string;
  recipientName: string;
  occurrenceId: string;
  occurrenceNo?: number;
  startAt: string;
  endAt: string;
  source: AbsenceSource;
  status: AbsenceStatus;
  explanation: string;
  explainedAt: string;
  conclusionNote: string;
  concludedAt: string;
};

const STATUSES: readonly AbsenceStatus[] = ['PENDING', 'EXCUSED', 'CONFIRMED'];
const SOURCES: readonly AbsenceSource[] = ['MISSED_CHECK_IN', 'NO_SHOW_REPORT_REJECTED'];
// Same bounds as CaregiverAbsenceExplanationRequest (400 5272 otherwise).
export const EXPLANATION_MIN = 10;
export const EXPLANATION_MAX = 1000;

function oneOf<T extends string>(value: unknown, values: readonly T[], what: string): T {
  const found = values.find((item) => item === value);
  if (!found) throw new Error(`Unknown ${what}`);
  return found;
}
export function parseAbsence(value: unknown): Absence {
  const j = object(value);
  return {
    id: required(j.id),
    bookingId: required(j.bookingId),
    bookingCode: text(j.bookingCode),
    recipientName: text(j.recipientName),
    occurrenceId: required(j.occurrenceId),
    occurrenceNo: number(j.occurrenceNo),
    startAt: required(j.startAt),
    endAt: required(j.endAt),
    source: oneOf(j.source, SOURCES, 'absence source'),
    status: oneOf(j.status, STATUSES, 'absence status'),
    explanation: text(j.explanation),
    explainedAt: text(j.explainedAt),
    conclusionNote: text(j.conclusionNote),
    concludedAt: text(j.concludedAt),
  };
}
// The trimmed text to send, or the copy key of why it cannot be sent.
export function checkExplanation(value: string): { text?: string; error?: string } {
  const trimmed = value.trim();
  if (trimmed.length < EXPLANATION_MIN) return { error: 'absenceExplanationShort' };
  if (trimmed.length > EXPLANATION_MAX) return { error: 'absenceExplanationLong' };
  return { text: trimmed };
}
