import { array, object, required, text } from '../../core/json';
import { parseRecipientSnapshot, RecipientSnapshot } from './recipient-models';
// Trạng thái buổi caregiver thấy (BookingService spec booking v1.0 §11.2); RESERVED / PENDING_ASSIGNMENT / EXPIRED chỉ có
// trước khi khách thanh toán nên không có trong bộ lọc.
export const statuses = [
  'SCHEDULED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'CAREGIVER_MISSED',
  'CUSTOMER_NO_SHOW',
];
export type Detail = { label: string; value: string };
export type Visit = {
  id: string;
  bookingId: string;
  bookingCode: string;
  startAt: string;
  endAt: string;
  checkInOpensAt: string;
  checkInClosesAt: string;
  status: string;
  name: string;
  recipientId?: string;
  address: string;
  customerNote: string;
  phone: string;
  sessionId: string;
  noShowReportedAt: string;
  noShowDecidedAt: string;
  noShowNote: string;
  missedReason: string;
  services: string[];
  special: Detail[];
  snapshot?: RecipientSnapshot;
};
const specialKeys = [
  'allergies',
  'chronicConditions',
  'dietaryNotes',
  'behaviorNotes',
  'careRequirements',
];
function details(j: Record<string, unknown>, keys: string[]): Detail[] {
  return keys.flatMap((label) => {
    const value = typeof j[label] === 'number' ? String(j[label]) : text(j[label]);
    return value ? [{ label, value }] : [];
  });
}
function instant(value: unknown, optional = false) {
  const parsed = optional ? text(value) : required(value);
  if (parsed && !Number.isFinite(Date.parse(parsed))) throw new Error('Invalid visit timestamp');
  return parsed;
}
export function parseVisit(value: unknown): Visit {
  const j = object(value),
    snapshot = j.recipientSnapshot ? object(j.recipientSnapshot) : undefined;
  return {
    id: required(j.id),
    bookingId: required(j.bookingId),
    bookingCode: text(j.bookingCode),
    startAt: instant(j.startAt),
    endAt: instant(j.endAt),
    checkInOpensAt: instant(j.checkInOpensAt, true),
    checkInClosesAt: instant(j.checkInClosesAt, true),
    status: required(j.status),
    name: text(j.recipientName),
    recipientId: text(j.recipientId),
    address: text(j.serviceAddress),
    customerNote: text(j.customerNote),
    phone: text(j.customerPhone),
    sessionId: text(j.sessionId),
    noShowReportedAt: instant(j.noShowReportedAt, true),
    noShowDecidedAt: instant(j.noShowDecidedAt, true),
    noShowNote: text(j.noShowNote),
    missedReason: text(j.missedReason),
    services: array(j.services).map((v) => text(object(v).serviceName)),
    special: details(j.specialNotes ? object(j.specialNotes) : {}, specialKeys),
    snapshot: snapshot ? parseRecipientSnapshot(snapshot) : undefined,
  };
}
