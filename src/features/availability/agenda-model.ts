import { ProviderSchedule } from './models';
import { TimeOff } from './time-off';
import { Visit } from '../visits/models';

export type AgendaData = { schedules: ProviderSchedule[]; visits: Visit[]; timeOffs: TimeOff[] };
type Period = { start: number; end: number };
export type AgendaRow = Period &
  (
    | { kind: 'availability'; item: ProviderSchedule }
    | { kind: 'visit'; item: Visit }
    | { kind: 'timeOff'; item: TimeOff }
  );
export function agendaRows(day: string, data: AgendaData): AgendaRow[] {
  const start = Date.parse(`${day}T00:00:00+07:00`),
    end = start + 86400000;
  const rows: AgendaRow[] = [];
  for (const item of data.schedules) {
    if (item.date === day)
      rows.push({
        kind: 'availability',
        item,
        start: Date.parse(`${day}T${item.start}+07:00`),
        end: Date.parse(`${day}T${item.end}+07:00`),
      });
  }
  for (const item of data.visits) {
    if (['CANCELLED', 'EXPIRED'].includes(item.status)) continue;
    const a = Date.parse(item.startAt),
      b = Date.parse(item.endAt);
    if (a < end && b > start)
      rows.push({ kind: 'visit', item, start: Math.max(start, a), end: Math.min(end, b) });
  }
  for (const item of data.timeOffs) {
    const a = Date.parse(item.startAt),
      b = Date.parse(item.endAt);
    if (a < end && b > start)
      rows.push({ kind: 'timeOff', item, start: Math.max(start, a), end: Math.min(end, b) });
  }
  return rows.sort((a, b) => a.start - b.start || a.end - b.end);
}
