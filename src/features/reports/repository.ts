import { ApiClient, ApiError } from '../../core/api';
import { page } from '../../core/json';
import { Report, ReportPhotoInput, conditions, parseReport, reportFields } from './models';
export class ReportRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  private parseWrite(value: unknown) {
    try {
      return parseReport(value);
    } catch {
      // A successful write with an unreadable response may already have committed.
      throw new ApiError(0, 0, true);
    }
  }
  async find(bookingId: string, sessionId: string): Promise<Report | undefined> {
    let p = 0;
    for (;;) {
      const result = page(
        await this.api.request('GET', '/care-reports', undefined, { bookingId, page: p, size: 20 }),
        parseReport,
      );
      const found = result.items.find((r) => r.sessionId === sessionId);
      if (found) return found;
      if (p + 1 >= result.totalPages) return undefined;
      p++;
    }
  }
  async save(report: Report) {
    if (
      report.status === 'SUBMITTED' ||
      !conditions.includes(report.overallCondition) ||
      !report.summary.trim() ||
      reportFields.some((k) => report[k].length > (k === 'summary' ? 4000 : 2000))
    )
      throw new Error('Invalid report');
    const body = {
      sessionId: report.sessionId,
      overallCondition: report.overallCondition,
      ...Object.fromEntries(reportFields.map((k) => [k, report[k]])),
      ...(report.id ? { version: report.version } : {}),
    };
    return this.parseWrite(
      await this.api.request(
        report.id ? 'PUT' : 'POST',
        report.id ? `/care-reports/${report.id}` : '/care-reports',
        body,
      ),
    );
  }
  async submit(id: string) {
    return this.parseWrite(await this.api.request('POST', `/care-reports/${id}/submit`));
  }
  validatePhotos(files: { mimeType?: string; size?: number }[], existing: number) {
    if (
      !files.length ||
      files.length + existing > 5 ||
      files.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.mimeType ?? '') ||
          f.size === undefined ||
          f.size <= 0 ||
          f.size > 10 * 1024 * 1024,
      )
    )
      throw new Error('Invalid report photos');
  }
  async upload(id: string, files: ReportPhotoInput[], existing: number) {
    this.validatePhotos(files, existing);
    const form = new FormData();
    for (const f of files)
      form.append('files', { uri: f.uri, name: f.name, type: f.mimeType } as unknown as Blob);
    return this.parseWrite(await this.api.request('POST', `/care-reports/${id}/photos`, form));
  }
  async saveWithPhotos(
    report: Report,
    files: ReportPhotoInput[],
    checkpoint: (value: Report, uploaded: boolean) => void,
  ) {
    if (files.length) this.validatePhotos(files, report.photos.length);
    let saved = await this.save(report);
    checkpoint(saved, false);
    if (files.length) {
      saved = await this.upload(saved.id, files, saved.photos.length);
      checkpoint(saved, true);
    }
    return saved;
  }
  async remove(id: string, mediaId: string) {
    return this.api.request('DELETE', `/care-reports/${id}/photos/${mediaId}`);
  }
}
