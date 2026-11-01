import { array, object, required, text } from '../../core/json';
function noteDetails(j: Record<string, unknown>, keys: string[]) {
  return keys.flatMap((label) => {
    const raw = j[label];
    return typeof raw === 'number' && Number.isFinite(raw) ? [{ label, value: String(raw) }] : [];
  });
}
export type Task = { id: string; title: string; status: string; skipReason: string; note: string };
export type Session = {
  id: string;
  bookingId: string;
  occurrenceId: string;
  status: string;
  tasks: Task[];
  done: number;
  checkInAt: string;
  checkOutAt: string;
};
export function parseSession(value: unknown): Session {
  const j = object(value);
  const tasks = array(j.tasks).map((v) => {
    const t = object(v);
    return {
      id: required(t.id),
      title: text(t.title),
      status: required(t.status),
      skipReason: text(t.skipReason),
      note: text(t.note),
    };
  });
  return {
    id: required(j.sessionId),
    bookingId: required(j.bookingId),
    occurrenceId: text(j.occurrenceId),
    status: required(j.status),
    checkInAt: text(j.checkInAt),
    checkOutAt: text(j.checkOutAt),
    tasks,
    done: tasks.filter((t) => t.status === 'DONE').length,
  };
}
export type Note = {
  id: string;
  content: string;
  createdAt: string;
  vitals: { label: string; value: string }[];
};
export function parseNote(value: unknown): Note {
  const j = object(value);
  return {
    id: required(j.id),
    content: text(j.content),
    createdAt: text(j.createdAt),
    vitals: j.vitals
      ? noteDetails(object(j.vitals), [
          'systolic',
          'diastolic',
          'heartRate',
          'temperature',
          'spo2',
          'bloodGlucose',
        ])
      : [],
  };
}
export function validateVitals(values: Record<string, string>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!v.trim()) continue;
    const n = Number(v.replace(',', '.'));
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      (['systolic', 'diastolic', 'heartRate'].includes(k) && (!Number.isInteger(n) || n <= 0)) ||
      (k === 'spo2' && (!Number.isInteger(n) || n > 100)) ||
      (k === 'temperature' && (n < 30 || n > 45))
    )
      throw new Error('Invalid vitals');
    result[k] = n;
  }
  return result;
}
