import { array, number, object, required, text } from '../../core/json';

export type BookingRequest = {
  id: string;
  bookingCode: string;
  status: string;
  bookingType: string;
  acceptanceDueAt: string;
  recipientAge?: number;
  recipientGender: string;
  area: string;
  customerNote: string;
  totalAmount?: number;
  services: string[];
  occurrences: { id: string; startAt: string; endAt: string }[];
};

// This preview deliberately has no patient name, full address, phone or clinical snapshot.
export function parseBookingRequest(value: unknown): BookingRequest {
  const j = object(value);
  return {
    id: required(j.id),
    bookingCode: text(j.bookingCode),
    status: required(j.status),
    bookingType: text(j.bookingType),
    acceptanceDueAt: text(j.acceptanceDueAt),
    recipientAge: number(j.recipientAge),
    recipientGender: text(j.recipientGender),
    area: [j.ward, j.district, j.province].map(text).filter(Boolean).join(', '),
    customerNote: text(j.customerNote),
    totalAmount: number(j.totalAmount),
    services: array(j.services)
      .map((v) => text(object(v).serviceName))
      .filter(Boolean),
    occurrences: array(j.occurrences)
      .map((v) => {
        const occurrence = object(v);
        return {
          id: required(occurrence.id),
          startAt: required(occurrence.startAt),
          endAt: required(occurrence.endAt),
        };
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt)),
  };
}
export function canAnswerRequest(request: BookingRequest, now = Date.now()) {
  return (
    request.status === 'PENDING_CAREGIVER_CONFIRMATION' && now < Date.parse(request.acceptanceDueAt)
  );
}
