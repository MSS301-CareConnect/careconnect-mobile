import { ApiClient } from '../../core/api';
import { page } from '../../core/json';
import { parseSession, parseNote } from './models';
export class SessionRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async start(id: string, coordinates: { latitude?: number; longitude?: number }) {
    return parseSession(
      await this.api.request('POST', '/care-sessions', { occurrenceId: id, ...coordinates }),
    );
  }
  async session(id: string) {
    return parseSession(await this.api.request('GET', `/care-sessions/${id}`));
  }
  async task(id: string, taskId: string, status: string, reason = '') {
    if (status === 'SKIPPED' && !reason.trim()) throw new Error('Skip reason required');
    return this.api.request('PATCH', `/care-sessions/${id}/tasks/${taskId}`, {
      status,
      ...(status === 'SKIPPED' ? { skipReason: reason.trim() } : {}),
    });
  }
  async addTask(id: string, title: string) {
    if (!title.trim() || title.length > 200) throw new Error('Invalid task');
    return this.api.request('POST', `/care-sessions/${id}/tasks`, { title: title.trim() });
  }
  async notes(id: string, p = 0) {
    return page(
      await this.api.request('GET', `/care-sessions/${id}/notes`, undefined, { page: p, size: 20 }),
      parseNote,
    );
  }
  async addNote(id: string, content: string, vitals: Record<string, number>) {
    if (!content.trim() || content.length > 2000) throw new Error('Invalid note');
    return this.api.request('POST', `/care-sessions/${id}/notes`, {
      content: content.trim(),
      ...(Object.keys(vitals).length ? { vitals } : {}),
    });
  }
  async end(id: string, coordinates: { latitude?: number; longitude?: number }) {
    return parseSession(await this.api.request('POST', `/care-sessions/${id}/end`, coordinates));
  }
}
