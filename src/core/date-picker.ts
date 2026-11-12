import { NativeModules } from 'react-native';
import { isCalendarDay, vietnamDay } from './time';

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
  const result = await picker.pick(
    isCalendarDay(value) ? value : vietnamDay(),
    title,
    accept,
    cancel,
  );
  if (result === null) return undefined;
  if (typeof result !== 'string' || !isCalendarDay(result))
    throw new Error('Invalid selected date');
  return result;
}
