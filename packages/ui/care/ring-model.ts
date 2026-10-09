/**
 * Geometry and value maths shared by the kit's rings (IncubationRing,
 * CareMeterRing). Angles are degrees clockwise from 12 o'clock. Pure and
 * worklet-safe, so the UI thread and node:test run the same code. Skia and
 * SVG draw from these numbers; neither owns state (brief §3.4).
 */

/** Clamp to 0..1; NaN reads as 0. */
export function clamp01(v: number): number {
  'worklet';
  if (!(v > 0)) return 0;
  return v > 1 ? 1 : v;
}

/** Elapsed share of an incubation at `nowMs`: `(now − startedAt) / (endsAt − startedAt)`, clamped. */
export function countdownProgress(nowMs: number, startedAt: number, endsAt: number): number {
  'worklet';
  const span = endsAt - startedAt;
  if (span <= 0) return 1;
  return clamp01((nowMs - startedAt) / span);
}

/** Reduced motion: the ring moves one step per whole minute, never continuously. */
export function minuteSteppedProgress(nowMs: number, startedAt: number, endsAt: number): number {
  'worklet';
  if (nowMs >= endsAt) return 1;
  return countdownProgress(Math.floor(nowMs / 60_000) * 60_000, startedAt, endsAt);
}

/** One arc: where it starts and how far it sweeps, in degrees from 12 o'clock. */
export interface ArcSpan {
  startDeg: number;
  sweepDeg: number;
}

/** Degrees that a straight gap of `gapPt` takes on a circle of `radiusPt`. */
export function gapDegrees(gapPt: number, radiusPt: number): number {
  if (radiusPt <= 0) return 0;
  return (gapPt / (2 * Math.PI * radiusPt)) * 360;
}

/**
 * `count` equal arcs around the ring with a `gapPt` gap between neighbours.
 * The first arc is centred so the first gap straddles 12 o'clock.
 */
export function stopArcs(count: number, gapPt: number, radiusPt: number): ArcSpan[] {
  if (count <= 0) return [];
  const gap = count === 1 ? 0 : gapDegrees(gapPt, radiusPt);
  const sweep = (360 - gap * count) / count;
  return Array.from({ length: count }, (_, i) => ({ startDeg: gap / 2 + i * (sweep + gap), sweepDeg: sweep }));
}

/** A point on the circle at `deg` from 12 o'clock, clockwise. */
export function pointAt(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Centre of an arc, used to place each stop's accessible hit target over its label. */
export function arcMidpoint(cx: number, cy: number, r: number, arc: ArcSpan): { x: number; y: number } {
  return pointAt(cx, cy, r, arc.startDeg + arc.sweepDeg / 2);
}

/**
 * SVG path data for an arc (web fallback). A full sweep is drawn as two
 * halves, because a single SVG arc whose ends meet draws nothing.
 */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const sweep = Math.max(0, Math.min(360, sweepDeg));
  if (sweep === 0) return '';
  if (sweep >= 359.999) {
    const a = pointAt(cx, cy, r, startDeg);
    const b = pointAt(cx, cy, r, startDeg + 180);
    return `M ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(b.x)} ${f(b.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(a.x)} ${f(a.y)}`;
  }
  const a = pointAt(cx, cy, r, startDeg);
  const b = pointAt(cx, cy, r, startDeg + sweep);
  return `M ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${f(b.x)} ${f(b.y)}`;
}

const f = (n: number) => Number(n.toFixed(3));

/**
 * The next stop for a trackpad step (M10 "Trackpad and keys"): from no
 * choice, +1 picks the first stop and −1 the last; otherwise shorter / longer,
 * stopping at the ends rather than wrapping.
 */
export function stepStop(count: number, current: number | null, direction: -1 | 1): number | null {
  if (count <= 0) return null;
  if (current === null || current < 0) return direction > 0 ? 0 : count - 1;
  return Math.max(0, Math.min(count - 1, current + direction));
}

/** Whole percent for `accessibilityValue.now`. */
export function percentOf(value: number): number {
  return Math.round(clamp01(value) * 100);
}

/**
 * The care ring's accessible name: the caption, plus the low word when low
 * ("Fullness, low"). The percent travels in `accessibilityValue`, which the
 * platform speaks after the name ("Fullness, low, 22 percent"), so the kit
 * adds no words of its own.
 */
export function careRingName(label: string, low: boolean, lowLabel: string): string {
  return low && lowLabel ? `${label}, ${lowLabel}` : label;
}
