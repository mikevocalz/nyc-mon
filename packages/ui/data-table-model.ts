// Pure row logic behind DataTable: text filtering, paging and selection.
// Kept out of the component so node:test can cover it without a renderer.

/** Folds case and accents so "Café" matches "cafe". */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The searchable text of one cell value; objects and functions are skipped. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(' ');
  return '';
}

/**
 * Every whitespace-separated term in `query` must appear in at least one of
 * the row's searchable values. An empty query keeps every row.
 */
export function rowMatches(values: readonly unknown[], query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = values.map((value) => foldText(cellText(value)));
  return terms.every((term) => haystack.some((text) => text.includes(term)));
}

/** Rows whose `pick(row)` values match `query`. Keeps input order. */
export function filterRows<T>(rows: readonly T[], query: string, pick: (row: T) => readonly unknown[]): T[] {
  if (!query.trim()) return [...rows];
  return rows.filter((row) => rowMatches(pick(row), query));
}

export interface PageWindow {
  /** Zero-based page actually shown, clamped into range. */
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

/** The slice of `total` rows for `page` at `pageSize`; 0 shows every row on one page. */
export function pageWindow(total: number, page: number, pageSize: number): PageWindow {
  if (pageSize <= 0) return { page: 0, pageCount: 1, start: 0, end: total };
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(0, Math.floor(page)), pageCount - 1);
  const start = clamped * pageSize;
  return { page: clamped, pageCount, start, end: Math.min(total, start + pageSize) };
}

/** Adds or removes one id. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/**
 * The header checkbox: when every visible id is selected it clears those ids
 * (keeping selections on other pages); otherwise it adds the visible ids.
 */
export function toggleVisible(selected: readonly string[], visible: readonly string[]): string[] {
  if (visible.length === 0) return [...selected];
  const all = visible.every((id) => selected.includes(id));
  if (all) return selected.filter((id) => !visible.includes(id));
  return [...new Set([...selected, ...visible])];
}

/** 'all' when every visible id is selected, 'some' when part are, else 'none'. */
export function visibleSelection(selected: readonly string[], visible: readonly string[]): 'all' | 'some' | 'none' {
  const count = visible.filter((id) => selected.includes(id)).length;
  if (count === 0) return 'none';
  return count === visible.length ? 'all' : 'some';
}
