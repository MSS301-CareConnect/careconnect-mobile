import { ApiClient, ApiError } from '../../core/api';
import { array, object, page, required } from '../../core/json';
import { parseSchedule, ProviderSchedule } from './models';
import { addDays, parseTimeOff, TimeOffInput, validTimeOff } from './time-off';
import { VisitRepository } from '../visits/repository';
import { Visit } from '../visits/models';
export class AvailabilityRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async schedules(p = 0, size = 20) {
    return page(
      await this.api.request('GET', '/caregivers/me/schedules', undefined, { page: p, size }),
      parseSchedule,
    );
  }
  async caregiverId() {
    return required(object(await this.api.request('GET', '/caregivers/me')).id);
  }
  async findSchedule(id: string) {
    for (let p = 0; ; p++) {
      const result = await this.schedules(p, 100);
      const schedule = result.items.find((item) => item.id === id);
      if (schedule) return schedule;
      if (p + 1 >= result.totalPages) return;
    }
  }
  async allSchedules() {
    const items: ProviderSchedule[] = [];
    for (let p = 0; ; p++) {
      const result = await this.schedules(p, 100);
      items.push(...result.items);
      if (p + 1 >= result.totalPages) return items;
    }
  }
  private async agendaVisits(from: string, to: string) {
    const repo = new VisitRepository(this.api);
    const items: Visit[] = [];
    for (let p = 0; ; p++) {
      const result = await repo.visits(p, from, to);
      items.push(...result.items);
      if (p + 1 >= result.totalPages) return items;
    }
  }
  async agenda(from: string, to: string) {
    const caregiverId = await this.caregiverId();
    const [schedules, visits, timeOffs] = await Promise.all([
      this.allSchedules(),
      this.agendaVisits(from, to),
      this.timeOffs(
        caregiverId,
        new Date(`${from}T00:00:00+07:00`).toISOString(),
        new Date(`${addDays(to, 1)}T00:00:00+07:00`).toISOString(),
      ),
    ]);
    return {
      schedules: schedules.filter((item) => item.date >= from && item.date <= to),
      visits,
      timeOffs,
    };
  }
  async timeOffs(caregiverId: string, from?: string, to?: string) {
    return array(
      await this.api.request(
        'GET',
        `/caregivers/${encodeURIComponent(caregiverId)}/time-offs`,
        undefined,
        { from, to },
      ),
    ).map(parseTimeOff);
  }
  async createTimeOff(caregiverId: string, input: TimeOffInput) {
    if (!validTimeOff(input)) throw new Error('Invalid time off');
    const response = await this.api.request(
      'POST',
      `/caregivers/${encodeURIComponent(caregiverId)}/time-offs`,
      { ...input, reason: input.reason?.trim() || undefined },
    );
    try {
      return parseTimeOff(response);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async deleteTimeOff(caregiverId: string, id: string) {
    return this.api.request(
      'DELETE',
      `/caregivers/${encodeURIComponent(caregiverId)}/time-offs/${encodeURIComponent(id)}`,
    );
  }
  async cancelSchedule(schedule: ProviderSchedule, reason: string) {
    if (
      schedule.status !== 'SCHEDULED' ||
      !Number.isSafeInteger(schedule.version) ||
      schedule.version < 0 ||
      !reason.trim() ||
      reason.length > 500
    )
      throw new Error('Invalid schedule cancellation');
    const response = await this.api.request(
      'PATCH',
      `/caregivers/schedules/${encodeURIComponent(schedule.id)}/status`,
      { status: 'CANCELLED', reason: reason.trim(), version: schedule.version },
    );
    try {
      const result = parseSchedule(response);
      if (result.id !== schedule.id || result.status !== 'CANCELLED')
        throw new Error('Inconsistent schedule cancellation response');
      return result;
    } catch {
      // A successful write with an unreadable result must never be replayed automatically.
      throw new ApiError(0, 0, true);
    }
  }
}
