import { NativeModules } from 'react-native';
import { vietnamDay } from './time';

export async function pickCalendarDate(
  value: string,
  title: string,
  accept: string,
  cancel: string,
) {
  const picker = NativeModules.CareConnectDatePicker as
    | {
        pick?: (initial: string, title: string, accept: string, cancel: string) => Promise<unknown>;
      }
    | undefined;
  if (!picker?.pick) throw new Error('Date picker is unavailable');
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + 'T00:00:00Z')) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
  const result = await picker.pick(valid(value) ? value : vietnamDay(), title, accept, cancel);
  if (result === null) return undefined;
  if (typeof result !== 'string' || !valid(result)) throw new Error('Invalid selected date');
  return result;
}
