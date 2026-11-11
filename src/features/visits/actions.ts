import { ApiError } from '../../core/api';
import { checkInAllowed } from '../../core/time';
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
// 2026-11-11: BookingService nhận buổi tới khi đóng cửa sổ check-in; trong cửa sổ check-in thì bấm "Bắt đầu" luôn
// (check-in từ SCHEDULED cũng là nhận buổi), nên chỉ hiện "Nhận" trước khi cửa sổ mở.
export function canAcknowledge(visit: Visit, now = Date.now()) {
  return visit.status === 'SCHEDULED' && now < visitWindow(visit).opens && !waitingForNoShow(visit);
}
// Starting is the next step after accepting, or straight away for a visit not accepted in time, as on FE.
export function careStartStep(visit: Visit, now = Date.now()): 'none' | 'waiting' | 'ready' {
  if (
    !['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) ||
    visit.sessionId ||
    waitingForNoShow(visit)
  )
    return 'none';
  if (visit.status === 'SCHEDULED' && now < visitWindow(visit).opens) return 'none';
  const { opens, closes } = visitWindow(visit);
  if (
    !Number.isFinite(opens) ||
    !Number.isFinite(closes) ||
    now >= closes ||
    now >= Date.parse(visit.endAt)
  )
    return 'none';
  if (now < opens) return 'waiting';
  return checkInAllowed(
    visit.startAt,
    visit.endAt,
    now,
    visit.checkInOpensAt,
    visit.checkInClosesAt,
  )
    ? 'ready'
    : 'none';
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
// BookingService caregiver-withdrawal-lead (24h): chỉ xin hủy buổi bắt đầu sau mốc này.
export const WITHDRAWAL_LEAD_MS = 24 * 60 * 60000;
export function canWithdraw(visit: Visit, now = Date.now()) {
  return (
    ['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) &&
    !visit.needsReassignment &&
    !visit.sessionId &&
    Date.parse(visit.startAt) - now > WITHDRAWAL_LEAD_MS
  );
}
export function visitErrorKey(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code === 5260) return 'withdrawTooLate';
  if (error.code === 5261) return 'withdrawAlready';
  if (error.code === 5262) return 'withdrawNotAllowed';
  if (error.code === 5263) return 'withdrawDetailRequired';
  if (error.code === 5242) return 'visitUnpaid';
  if (error.code === 5234) return 'visitReassignment';
  if (error.code === 5817) return 'noShowWindowClosed';
  if (error.code === 5814) return 'noShowAlreadyReported';
  if (error.code === 5806) return 'sessionStillOpen';
  return undefined;
}
