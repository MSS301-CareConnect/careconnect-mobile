import { number, object, required, text } from '../../core/json';
import { vietnamDay } from '../../core/time';

export type TimeOff = {
  id: string;
  caregiverId: string;
  startAt: string;
  endAt: string;
  reason: string;
  version: number;
};
export type TimeOffInput = { startAt: string; endAt: string; reason?: string };
export type TimeOffForm = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  reason: string;
};
const DAY = 86400000;
export function validTimeOff(input: TimeOffInput) {
  const start = Date.parse(input.startAt),
    end = Date.parse(input.endAt);
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start &&
    end - start <= 30 * DAY &&
    (input.reason?.length ?? 0) <= 500
  );
}
export function parseTimeOff(value: unknown): TimeOff {
  const j = object(value);
  const version = number(j.version);
  const result = {
    id: required(j.id),
    caregiverId: required(j.caregiverId),
    startAt: required(j.startAt),
    endAt: required(j.endAt),
    reason: text(j.reason),
    version: version ?? -1,
  };
  if (!validTimeOff(result) || !Number.isSafeInteger(result.version) || result.version < 0)
    throw new Error('Invalid time off');
  return result;
}
export function validDay(day: string) {
  const instant = Date.parse(`${day}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === day
  );
}
export function addDays(day: string, amount: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY).toISOString().slice(0, 10);
}
export function timeOffInput(form: TimeOffForm): TimeOffInput {
  if (!validDay(form.startDate) || !validDay(form.endDate)) throw new Error('Invalid date');
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!form.allDay && (!clock.test(form.startTime) || !clock.test(form.endTime)))
    throw new Error('Invalid time');
  const startAt = new Date(
    `${form.startDate}T${form.allDay ? '00:00' : form.startTime}:00+07:00`,
  ).toISOString();
  const endAt = new Date(
    `${form.allDay ? addDays(form.endDate, 1) : form.endDate}T${form.allDay ? '00:00' : form.endTime}:00+07:00`,
  ).toISOString();
  const input = { startAt, endAt, reason: form.reason.trim() || undefined };
  if (!validTimeOff({ ...input, reason: form.reason })) throw new Error('Invalid time off');
  return input;
}
export function timeOffRange(item: TimeOff) {
  const allDay =
    new Date(Date.parse(item.startAt) + 7 * 3600000).toISOString().slice(11, 19) === '00:00:00' &&
    new Date(Date.parse(item.endAt) + 7 * 3600000).toISOString().slice(11, 19) === '00:00:00';
  return {
    startDay: vietnamDay(new Date(item.startAt)),
    endDay: vietnamDay(new Date(Date.parse(item.endAt) - 1)),
    allDay,
  };
}
