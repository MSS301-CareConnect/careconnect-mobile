import { ApiClient, ApiError } from '../../core/api';
import { page } from '../../core/json';
import { parseBookingRequest } from './models';

export class BookingRequestRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async list(p = 0, size = 20) {
    return page(
      await this.api.request('GET', '/bookings/caregiver-requests', undefined, { page: p, size }),
      parseBookingRequest,
    );
  }
  async count() {
    return (await this.list(0, 1)).totalElements;
  }
  async findPending(id: string) {
    for (let p = 0; ; p++) {
      const result = await this.list(p);
      const found = result.items.find((item) => item.id === id);
      if (found) return found;
      if (p + 1 >= result.totalPages) return undefined;
    }
  }
  private async decide(id: string, action: 'accept' | 'decline', body?: { reason: string }) {
    const result = await this.api.request('POST', `/bookings/${id}/caregiver-${action}`, body);
    try {
      const parsed = parseBookingRequest(result);
      const allowed =
        action === 'accept'
          ? ['AWAITING_INITIAL_PAYMENT']
          : ['PENDING_CAREGIVER_ASSIGNMENT', 'REJECTED'];
      if (parsed.id !== id || !allowed.includes(parsed.status))
        throw new Error('Invalid decision response');
      return parsed;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  accept(id: string) {
    return this.decide(id, 'accept');
  }
  decline(id: string, reason: string) {
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > 1000)
      return Promise.reject(new Error('Invalid decline reason'));
    return this.decide(id, 'decline', { reason: trimmed });
  }
}
