import { array, number, object, required, text } from '../../core/json';
export type ReportPhotoInput = { uri: string; name: string; mimeType?: string; size?: number };
export type Report = {
  id: string;
  sessionId: string;
  status: string;
  version?: number;
  overallCondition: string;
  summary: string;
  mealNotes: string;
  medicationNotes: string;
  mobilityNotes: string;
  moodNotes: string;
  recommendations: string;
  photos: { id: string; url: string }[];
};
export const reportFields = [
  'summary',
  'mealNotes',
  'medicationNotes',
  'mobilityNotes',
  'moodNotes',
  'recommendations',
] as const;
export const conditions = ['STABLE', 'IMPROVED', 'DECLINED', 'NEEDS_ATTENTION'];
export function emptyReport(sessionId: string): Report {
  return {
    id: '',
    sessionId,
    status: 'DRAFT',
    overallCondition: '',
    summary: '',
    mealNotes: '',
    medicationNotes: '',
    mobilityNotes: '',
    moodNotes: '',
    recommendations: '',
    photos: [],
  };
}
export function parseReport(value: unknown): Report {
  const j = object(value);
  return {
    id: required(j.id),
    sessionId: required(j.sessionId),
    status: required(j.status),
    version: number(j.version),
    overallCondition: text(j.overallCondition),
    summary: text(j.summary),
    mealNotes: text(j.mealNotes),
    medicationNotes: text(j.medicationNotes),
    mobilityNotes: text(j.mobilityNotes),
    moodNotes: text(j.moodNotes),
    recommendations: text(j.recommendations),
    photos: array(j.photos).map((v) => {
      const p = object(v);
      return { id: required(p.mediaFileId), url: text(p.downloadUrl) };
    }),
  };
}
