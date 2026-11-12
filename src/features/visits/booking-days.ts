import { vietnamDay } from '../../core/time';
import { canWithdraw, visitWindow, waitingForNoShow } from './actions';
import { Visit } from './models';

export function groupVisitDays(visits: Visit[]) {
  const days = new Map<string, Visit[]>();
  for (const visit of [...visits].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))) {
    const day = vietnamDay(new Date(visit.startAt));
    const items = days.get(day);
    if (items) items.push(visit);
    else days.set(day, [visit]);
  }
  return days;
}

export function acceptableVisits(visits: Visit[], now: number) {
  return visits.filter(
    (visit) =>
      visit.status === 'SCHEDULED' &&
      !visit.needsReassignment &&
      !visit.sessionId &&
      !waitingForNoShow(visit) &&
      now < Math.min(visitWindow(visit).closes, Date.parse(visit.endAt)),
  );
}

export function dayWithdrawal(visits: Visit[], now: number) {
  const owned = visits.filter(
    (visit) => ['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) && !visit.needsReassignment,
  );
  return { visits: owned, allowed: owned.length > 0 && owned.every((v) => canWithdraw(v, now)) };
}

export function withdrawalBatches(visits: Visit[]) {
  const batches: Visit[][] = [];
  let current: Visit[] = [];
  for (const day of groupVisitDays(visits).values()) {
    if (day.length > 60) throw new Error('A day exceeds the withdrawal limit');
    if (current.length + day.length > 60) {
      batches.push(current);
      current = [];
    }
    current.push(...day);
  }
  if (current.length) batches.push(current);
  return batches;
}
