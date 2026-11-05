import { ApiError } from '../../core/api';
import { Visit } from './models';
export function visitWindow(visit: Visit) {
  const start = Date.parse(visit.startAt);
  return {
    opens: visit.checkInOpensAt ? Date.parse(visit.checkInOpensAt) : start - 30 * 60000,
    closes: visit.checkInClosesAt ? Date.parse(visit.checkInClosesAt) : start + 30 * 60000,
  };
}
export function waitingForNoShow(visit: Visit) {
  return !!visit.noShowReportedAt && !visit.noShowDecidedAt;
}
export function canAcknowledge(visit: Visit, now = Date.now()) {
  return (
    visit.status === 'SCHEDULED' && now < Date.parse(visit.startAt) && !waitingForNoShow(visit)
  );
}
export function canReportNoShow(visit: Visit, now = Date.now()) {
  return (
    ['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) &&
    !visit.sessionId &&
    !visit.noShowReportedAt &&
    now >= Date.parse(visit.startAt) &&
    now < visitWindow(visit).closes
  );
}
export function visitErrorKey(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code === 5242) return 'visitUnpaid';
  if (error.code === 5234) return 'visitReassignment';
  if (error.code === 5817) return 'noShowWindowClosed';
  if (error.code === 5814) return 'noShowAlreadyReported';
  return undefined;
}
