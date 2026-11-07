import { array, number, object, required, text } from '../../core/json';
function noteDetails(j: Record<string, unknown>, keys: string[]) {
  return keys.flatMap((label) => {
    const raw = j[label];
    return typeof raw === 'number' && Number.isFinite(raw) ? [{ label, value: String(raw) }] : [];
  });
}
export type Task = {
  id: string;
  title: string;
  status: string;
  skipReason: string;
  note: string;
  type: string;
  scheduledTime: string;
  order: number;
};
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
export function parseTask(value: unknown, index = 0): Task {
  const task = object(value);
  return {
    id: required(task.id),
    title: text(task.title),
    status: required(task.status),
    skipReason: text(task.skipReason),
    note: text(task.note),
    type: text(task.taskType),
    scheduledTime: text(task.scheduledTime),
    order: number(task.sortOrder) ?? index,
  };
}
export function parseSession(value: unknown): Session {
  const j = object(value);
  const tasks = array(j.tasks).map(parseTask);
  return {
    id: required(j.sessionId),
    bookingId: required(j.bookingId),
    occurrenceId: text(j.occurrenceId),
    status: required(j.status),
    checkInAt: text(j.checkInAt),
    checkOutAt: text(j.checkOutAt),
    tasks: tasks.sort((a, b) => a.order - b.order),
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
