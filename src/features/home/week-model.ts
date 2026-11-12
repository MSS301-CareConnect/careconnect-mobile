import { addDays } from '../../core/time';
import { ProviderSchedule } from '../availability/models';
import { Visit } from '../visits/models';
import { groupVisitDays } from '../visits/booking-days';

export function weekFigures(monday: string, visits: Visit[], schedules: ProviderSchedule[]) {
  const groups = groupVisitDays(visits);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index);
    const figures = { day, count: 0, done: 0, completed: 0, upcoming: 0, missed: 0, available: 0 };
    for (const visit of groups.get(day) ?? []) {
      if (['CANCELLED', 'EXPIRED', 'PENDING_ASSIGNMENT', 'RESERVED'].includes(visit.status))
        continue;
      const minutes = Math.max(0, Date.parse(visit.endAt) - Date.parse(visit.startAt)) / 60000;
      figures.count++;
      if (['COMPLETED', 'CUSTOMER_NO_SHOW'].includes(visit.status)) {
        figures.done++;
        figures.completed += minutes;
      } else if (visit.status === 'CAREGIVER_MISSED' || visit.status === 'MISSED') {
        figures.missed += minutes;
      } else {
        figures.upcoming += minutes;
      }
    }
    for (const slot of schedules) {
      if (slot.date !== day || slot.status === 'CANCELLED') continue;
      const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
      figures.available += Math.max(0, minutes(slot.end) - minutes(slot.start));
    }
    return figures;
  });
}
