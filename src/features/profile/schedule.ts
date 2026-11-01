import { number, object, required, text } from '../../core/json';

export type ProviderSchedule = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: string;
  note: string;
  cancellationReason: string;
  version: number;
};

export function parseSchedule(value: unknown): ProviderSchedule {
  const j = object(value);
  const version = number(j.version);
  if (version === undefined || !Number.isSafeInteger(version) || version < 0)
    throw new Error('Invalid schedule version');
  const result: ProviderSchedule = {
    id: required(j.id),
    date: required(j.workDate),
    start: required(j.startTime),
    end: required(j.endTime),
    status: required(j.scheduleStatus),
    note: text(j.note),
    cancellationReason: text(j.cancellationReason),
    version,
  };
  const midnight = Date.parse(`${result.date}T00:00:00Z`);
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result.date) ||
    !Number.isFinite(midnight) ||
    new Date(midnight).toISOString().slice(0, 10) !== result.date ||
    !time.test(result.start) ||
    !time.test(result.end)
  )
    throw new Error('Invalid schedule date or time');
  return result;
}

export function canCancelSchedule(schedule: ProviderSchedule, now = Date.now()) {
  return (
    schedule.status === 'SCHEDULED' &&
    Date.parse(`${schedule.date}T${schedule.end}+07:00`) > now
  );
}
