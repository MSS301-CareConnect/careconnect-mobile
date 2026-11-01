import { array, object, required, text } from '../../core/json';
export const statuses = [
  'SCHEDULED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'MISSED',
  'CUSTOMER_NO_SHOW',
];
export type Detail = { label: string; value: string };
export type Visit = {
  id: string;
  bookingId: string;
  bookingCode: string;
  startAt: string;
  endAt: string;
  status: string;
  name: string;
  address: string;
  customerNote: string;
  phone: string;
  sessionId: string;
  services: string[];
  special: Detail[];
  snapshot?: {
    info: Detail[];
    medications: { name: string; details: string }[];
    emergency?: { name: string; phone: string };
  };
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
export function parseVisit(value: unknown): Visit {
  const j = object(value),
    snapshot = j.recipientSnapshot ? object(j.recipientSnapshot) : undefined;
  const contact = snapshot?.primaryEmergencyContact
    ? object(snapshot.primaryEmergencyContact)
    : undefined;
  return {
    id: required(j.id),
    bookingId: required(j.bookingId),
    bookingCode: text(j.bookingCode),
    startAt: required(j.startAt),
    endAt: required(j.endAt),
    status: required(j.status),
    name: text(j.recipientName),
    address: text(j.serviceAddress),
    customerNote: text(j.customerNote),
    phone: text(j.customerPhone),
    sessionId: text(j.sessionId),
    services: array(j.services).map((v) => text(object(v).serviceName)),
    special: details(j.specialNotes ? object(j.specialNotes) : {}, specialKeys),
    snapshot: snapshot
      ? {
          info: details(snapshot, [
            'fullName',
            'dateOfBirth',
            'age',
            'gender',
            'bloodType',
            'mobilityLevel',
            'independenceLevel',
            ...specialKeys,
          ]),
          medications: array(snapshot.activeMedications).map((v) => {
            const m = object(v);
            return {
              name: text(m.medicationName),
              details: [m.dosage, m.frequency, ...array(m.timeOfDay), m.route, m.usageNotes]
                .map(text)
                .filter(Boolean)
                .join(' · '),
            };
          }),
          emergency: contact
            ? {
                name: [text(contact.fullName), text(contact.relationship)]
                  .filter(Boolean)
                  .join(' · '),
                phone: text(contact.phoneNumber),
              }
            : undefined,
        }
      : undefined,
  };
}
