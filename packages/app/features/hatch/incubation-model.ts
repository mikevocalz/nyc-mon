import { transitionHatch } from '@acme/core/sim';
import type { EggRecord, HatchState } from '@acme/core/types';
import { hatchCopy } from './copy.ts';

/** The M11 states (screens/M11/08-handoff.md "State derivation"). `hatched` is not M11: M13 renders. */
export type IncubationView = 'counting' | 'ready' | 'overdue' | 'resume' | 'hatched';

/** Past this, a ready egg found on screen entry reads as overdue ("Ready since …"). */
export const OVERDUE_AFTER_MS = 60_000;

/**
 * Derives M11's state without writing: `tick` is evaluated, not persisted.
 * `entryMs` is when the screen was entered (overdue is judged there);
 * `readyLatched` keeps a ready screen ready if the clock moves backwards.
 */
export function incubationView(
  hatch: HatchState,
  egg: EggRecord,
  nowMs: number,
  entryMs: number,
  readyLatched: boolean,
): IncubationView {
  const view = transitionHatch(hatch, { type: 'tick', now: nowMs }, egg);
  switch (view.kind) {
    case 'incubating':
      return readyLatched ? 'ready' : 'counting';
    case 'ready':
      return entryMs - egg.incubationEndsAt >= OVERDUE_AFTER_MS ? 'overdue' : 'ready';
    case 'presenting':
      return 'resume';
    case 'hatched':
      return 'hatched';
  }
}

/** Whole minutes left, rounded up so the line never reads "0 min" (M11 copy). */
export function minutesLeft(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 60_000));
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The big time line for a state (`m11.time.*`). */
export function timeLine(view: IncubationView, endsAtMs: number, nowMs: number): string {
  switch (view) {
    case 'counting': {
      const left = endsAtMs - nowMs;
      return left < 60_000 ? hatchCopy('m11.time.under_minute') : hatchCopy('m11.time.minutes', { minutes: minutesLeft(endsAtMs, nowMs) });
    }
    case 'ready':
    case 'overdue':
      return hatchCopy('m11.time.ready');
    case 'resume':
    case 'hatched':
      return hatchCopy('m11.time.resume');
  }
}

/**
 * The detail line under the time: "Metro Egg · ready at 4:12 PM" while
 * counting, "Ready since …" when overdue, nothing otherwise. Clock time and
 * weekday come from `Intl.DateTimeFormat` in the device locale.
 */
export function detailLine(
  view: IncubationView,
  eggName: string,
  endsAtMs: number,
  nowMs: number,
  locale?: string,
): string | undefined {
  const end = new Date(endsAtMs);
  const clockTime = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(end);
  if (view === 'counting') return hatchCopy('m11.time.ready_at', { eggName, clockTime });
  if (view !== 'overdue') return undefined;
  const now = new Date(nowMs);
  if (sameLocalDay(end, now)) return hatchCopy('m11.time.overdue.today', { clockTime });
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameLocalDay(end, yesterday)) return hatchCopy('m11.time.overdue.yesterday');
  const days = (nowMs - endsAtMs) / 86_400_000;
  const weekday =
    days <= 6
      ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(end)
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(end);
  return hatchCopy('m11.time.overdue.earlier', { weekday });
}

/** Ring and LED progress 0–1 from creation to the end time. */
export function incubationProgress(egg: EggRecord, nowMs: number): number {
  const total = egg.incubationEndsAt - egg.createdAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - egg.createdAt) / total));
}
