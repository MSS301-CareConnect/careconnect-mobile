import { array, number, object, required, text } from '../../core/json';

export type RecipientMedication = {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  route: string;
  startDate: string;
  endDate: string;
  prescribedBy: string;
  notes: string;
};
export type RecipientContact = {
  name: string;
  relationship: string;
  phone: string;
  primary: boolean;
  priority?: number;
};
export type RecipientSnapshot = {
  recipientId: string;
  name: string;
  dateOfBirth: string;
  age?: number;
  gender: string;
  bloodType: string;
  phone: string;
  address: string;
  mobilityLevel: string;
  independenceLevel: string;
  allergies: string;
  chronicConditions: string;
  dietaryNotes: string;
  behaviorNotes: string;
  careRequirements: string;
  medications: RecipientMedication[];
  snapshotAt: string;
};
export type RecipientProfile = {
  snapshot: RecipientSnapshot;
  heightCm?: number;
  weightKg?: number;
  medicalHistory: string;
  sleepHabits: string;
  contacts: RecipientContact[];
};

function calendarDate(value: unknown) {
  const s = text(value);
  if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s).toISOString().slice(0, 10) !== s))
    throw new Error('Invalid recipient date');
  return s;
}
export function parseRecipientSnapshot(value: unknown): RecipientSnapshot {
  const j = object(value);
  const age = number(j.age);
  if (j.age != null && (age === undefined || !Number.isInteger(age) || age < 0))
    throw new Error('Invalid recipient age');
  const snapshotAt = text(j.snapshotAt);
  if (snapshotAt && !Number.isFinite(Date.parse(snapshotAt)))
    throw new Error('Invalid recipient timestamp');
  return {
    recipientId: text(j.recipientId),
    name: text(j.fullName),
    dateOfBirth: calendarDate(j.dateOfBirth),
    age,
    gender: text(j.gender),
    bloodType: text(j.bloodType),
    phone: text(j.phoneNumber),
    address: [j.addressLine, j.ward, j.district, j.province].map(text).filter(Boolean).join(', '),
    mobilityLevel: text(j.mobilityLevel),
    independenceLevel: text(j.independenceLevel),
    allergies: text(j.allergies),
    chronicConditions: text(j.chronicConditions),
    dietaryNotes: text(j.dietaryNotes),
    behaviorNotes: text(j.behaviorNotes),
    careRequirements: text(j.careRequirements),
    snapshotAt,
    medications: array(j.activeMedications).map((item) => {
      const m = object(item);
      return {
        name: text(m.medicationName),
        dosage: text(m.dosage),
        frequency: text(m.frequency),
        times: array(m.timeOfDay).map(text).filter(Boolean).sort(),
        route: text(m.route),
        startDate: calendarDate(m.startDate),
        endDate: calendarDate(m.endDate),
        prescribedBy: text(m.prescribedBy),
        notes: text(m.usageNotes),
      };
    }),
  };
}
export function parseRecipientProfile(value: unknown): RecipientProfile {
  const j = object(value);
  // Accept only the assigned-caregiver response, never the customer/admin profile shape.
  const snapshot = parseRecipientSnapshot(j.careSnapshot);
  required(snapshot.recipientId);
  const d = j.careDetails == null ? {} : object(j.careDetails);
  return {
    snapshot,
    heightCm: number(d.heightCm),
    weightKg: number(d.weightKg),
    medicalHistory: text(d.medicalHistory),
    sleepHabits: text(d.sleepHabits),
    contacts: array(j.emergencyContacts)
      .map((item) => {
        const c = object(item);
        return {
          name: text(c.fullName),
          relationship: text(c.relationship),
          phone: text(c.phoneNumber),
          primary: c.primary === true,
          priority: number(c.priority),
        };
      })
      .sort(
        (a, b) =>
          Number(b.primary) - Number(a.primary) ||
          (a.priority ?? Infinity) - (b.priority ?? Infinity),
      ),
  };
}
