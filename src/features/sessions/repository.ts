import { ApiClient, ApiError } from '../../core/api';
import { page } from '../../core/json';
import { parseSession, parseNote, parseTask } from './models';
export class SessionRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  private parseWrite(value: unknown) {
    try {
      return parseSession(value);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async start(id: string, coordinates: { latitude?: number; longitude?: number }) {
    return this.parseWrite(
      await this.api.request('POST', '/care-sessions', { occurrenceId: id, ...coordinates }),
    );
  }
  async session(id: string) {
    return parseSession(await this.api.request('GET', `/care-sessions/${id}`));
  }
  async task(id: string, taskId: string, status: string, reason = '') {
    if (
      !['PENDING', 'DONE', 'SKIPPED'].includes(status) ||
      (status === 'SKIPPED' && (!reason.trim() || reason.trim().length > 500))
    )
      throw new Error('Invalid task update');
    const result = await this.api.request('PATCH', `/care-sessions/${id}/tasks/${taskId}`, {
      status,
      ...(status === 'SKIPPED' ? { skipReason: reason.trim() } : {}),
    });
    try {
      const task = parseTask(result);
      if (task.id !== taskId || task.status !== status) throw new Error('Invalid task response');
      return task;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async addTask(id: string, title: string) {
    if (!title.trim() || title.length > 200) throw new Error('Invalid task');
    const result = await this.api.request('POST', `/care-sessions/${id}/tasks`, {
      title: title.trim(),
    });
    try {
      return parseTask(result);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async notes(id: string, p = 0) {
    return page(
      await this.api.request('GET', `/care-sessions/${id}/notes`, undefined, { page: p, size: 20 }),
      parseNote,
    );
  }
  async addNote(id: string, content: string, vitals: Record<string, number>) {
    if (!content.trim() || content.length > 2000) throw new Error('Invalid note');
    const result = await this.api.request('POST', `/care-sessions/${id}/notes`, {
      content: content.trim(),
      ...(Object.keys(vitals).length ? { vitals } : {}),
    });
    try {
      return parseNote(result);
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async end(id: string, coordinates: { latitude?: number; longitude?: number }) {
    return this.parseWrite(await this.api.request('POST', `/care-sessions/${id}/end`, coordinates));
  }
}
