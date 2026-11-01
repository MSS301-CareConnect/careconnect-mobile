export type Json = Record<string, unknown>;
export function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid API object');
  return value as Json;
}
export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export function required(value: unknown): string {
  const s = text(value);
  if (!s) throw new Error('Missing API identifier');
  return s;
}
export function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
export function array(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Invalid API list');
  return value;
}
export type Page<T> = { items: T[]; page: number; totalPages: number; totalElements: number };
export function page<T>(value: unknown, parse: (v: unknown) => T): Page<T> {
  const j = object(value);
  if (
    !Array.isArray(j.items) ||
    number(j.page) === undefined ||
    number(j.totalPages) === undefined ||
    number(j.totalElements) === undefined
  )
    throw new Error('Invalid API page');
  return {
    items: j.items.map(parse),
    page: j.page as number,
    totalPages: j.totalPages as number,
    totalElements: j.totalElements as number,
  };
}
