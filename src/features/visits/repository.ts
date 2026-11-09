import { ApiClient, ApiError } from '../../core/api';
import { page } from '../../core/json';
import { vietnamDay } from '../../core/time';
import { parseVisit, Visit } from './models';
import { visitWindow, waitingForNoShow } from './actions';
import { parseRecipientProfile } from './recipient-models';
export class VisitRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  private parseWrite(value: unknown) {
    try {
      return parseVisit(value);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async visits(p = 0, from?: string, to?: string, status?: string) {
    return page(
      await this.api.request('GET', '/booking-occurrences', undefined, {
        from,
        to,
        status,
        page: p,
        size: 20,
      }),
      parseVisit,
    );
  }
  async today(now = new Date(), p = 0) {
    const day = vietnamDay(now);
    const [visits, done] = await Promise.all([
      this.visits(p, day, day),
      this.visits(0, day, day, 'COMPLETED'),
    ]);
    return { visits, completed: done.totalElements };
  }
  async nextToday(now = new Date()): Promise<Visit | undefined> {
    const day = vietnamDay(now);
    const rows: Visit[] = [];
    for (let p = 0; ; p++) {
      const result = await this.visits(p, day, day);
      rows.push(...result.items);
      if (p + 1 >= result.totalPages) break;
    }
    const ordered = rows.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return (
      ordered.find((visit) => visit.status === 'IN_PROGRESS') ??
      ordered.find(
        (visit) =>
          ['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) &&
          !waitingForNoShow(visit) &&
          now.getTime() < visitWindow(visit).closes &&
          now.getTime() < Date.parse(visit.endAt),
      )
    );
  }
  // Mọi buổi của caregiver trong một booking (trang booking): đọc hết các trang 100 buổi.
  async bookingVisits(bookingId: string) {
    const rows: Visit[] = [];
    for (let p = 0; ; p++) {
      const result = page(
        await this.api.request('GET', '/booking-occurrences', undefined, {
          bookingId,
          page: p,
          size: 100,
        }),
        parseVisit,
      );
      rows.push(...result.items);
      if (p + 1 >= result.totalPages) break;
    }
    return rows.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  // POST /caregiver-withdrawals: một hoặc nhiều buổi của cùng booking; OTHER bắt buộc ghi chú (BE kiểm lại 24h / chủ buổi).
  async withdraw(occurrenceIds: string[], reasonCode: 'PERSONAL' | 'OTHER', reasonDetail: string) {
    const detail = reasonDetail.trim();
    if (!occurrenceIds.length || occurrenceIds.length > 60)
      throw new Error('Invalid withdrawal visits');
    if (reasonCode === 'OTHER' && !detail) throw new Error('Withdrawal reason required');
    if (detail.length > 1000) throw new Error('Withdrawal reason too long');
    const result = await this.api.request('POST', '/caregiver-withdrawals', {
      occurrenceIds,
      reasonCode,
      reasonDetail: detail || undefined,
    });
    // Phản hồi thành công nhưng sai dạng = chưa rõ kết quả, không coi là lỗi an toàn để gửi lại.
    if (!Array.isArray(result) || result.length !== occurrenceIds.length)
      throw new ApiError(0, 0, true);
    return result.length;
  }
  async visit(id: string) {
    return parseVisit(await this.api.request('GET', `/booking-occurrences/${id}`));
  }
  async recipientProfile(id: string) {
    const profile = parseRecipientProfile(
      await this.api.request('GET', `/care-recipients/${encodeURIComponent(id)}`),
    );
    if (profile.snapshot.recipientId !== id) throw new Error('Recipient scope mismatch');
    return profile;
  }
  async acknowledge(id: string) {
    return this.parseWrite(
      await this.api.request('POST', `/booking-occurrences/${id}/acknowledge`),
    );
  }
  async reportNoShow(id: string, note: string) {
    const trimmed = note.trim();
    if (trimmed.length < 10 || trimmed.length > 1000) throw new Error('Invalid no-show note');
    const result = await this.api.request('POST', `/booking-occurrences/${id}/no-show-reports`, {
      note: trimmed,
    });
    return this.parseWrite(result);
  }
}
