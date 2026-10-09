/**
 * Calendar maths for `DaysCalendar` (M18; DECISIONS D-15a). The model has no
 * notion of a streak, a run or a missed day: a day either has a journal entry
 * ("together") or it does not, and a past day without one is drawn exactly
 * like a future day. The count only rises because it counts entries' days,
 * which are never deleted. Pure; dates are ISO `YYYY-MM-DD` in the device zone.
 */

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

/** How a day cell is drawn. There is no `missed` state by design. */
export type DayKind = 'together' | 'plain';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO date for a day of a month. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Days in a month (Gregorian). */
export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for the first day of the month. */
function firstWeekday({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/**
 * Weeks of the month as rows of seven cells; `null` pads the first and last
 * week. `weekStartsOn` 0 is Sunday, 1 Monday.
 */
export function monthGrid(ym: YearMonth, weekStartsOn: 0 | 1 = 0): (string | null)[][] {
  const lead = (firstWeekday(ym) - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(ym); d += 1) cells.push(isoDate(ym.year, ym.month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A day is `together` when it has an entry; every other day, past or future, is `plain`. */
export function dayKind(iso: string, daysTogether: ReadonlySet<string>): DayKind {
  return daysTogether.has(iso) ? 'together' : 'plain';
}

/**
 * Days together up to and including `today`. A set of distinct days, so the
 * number can only stay or rise as entries are added.
 */
export function daysTogetherCount(daysTogether: ReadonlySet<string>, today: string): number {
  let n = 0;
  for (const d of daysTogether) if (d <= today) n += 1;
  return n;
}

/** Compare two months: negative, zero or positive. */
export function compareMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/** The month one step away. */
export function shiftMonth({ year, month }: YearMonth, direction: -1 | 1): YearMonth {
  const m = month + direction;
  if (m < 1) return { year: year - 1, month: 12 };
  if (m > 12) return { year: year + 1, month: 1 };
  return { year, month: m };
}

/** The month containing an ISO date. */
export function monthOf(iso: string): YearMonth {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

/** Month navigation bounds: never before the hatch month, never past today's month. */
export function canShift(shown: YearMonth, direction: -1 | 1, minMonth: YearMonth, today: string): boolean {
  return direction < 0 ? compareMonth(shown, minMonth) > 0 : compareMonth(shown, monthOf(today)) < 0;
}
