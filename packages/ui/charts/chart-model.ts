/**
 * Chart geometry for the NYC-MON charts: pure TypeScript, shared by the
 * react-native-graph line plot, the Skia fallbacks and the bar and donut
 * canvases, so every platform draws the same numbers the same way.
 * Everything is in layout px with the origin at the top left.
 */

/** NeonBlade's data shape: one object per category, keyed by series. */
export type ChartDatum = Record<string, string | number>;

export interface SeriesInput {
  /** Key in each data object to read the value from. */
  dataKey: string;
  /** Legend and readout label. Defaults to dataKey. */
  label?: string;
  /** Colour preset, brand token or CSS colour. Defaults to the district's series colours. */
  color?: string;
}

export interface ResolvedSeries {
  dataKey: string;
  label: string;
  color?: string;
  values: number[];
}

const toNumber = (v: string | number | undefined) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * NeonBlade accepts either `series` or the single-series shorthand
 * (`dataKey`, `label`, `color`). Both resolve to the same list here.
 */
export function resolveSeries(
  data: readonly ChartDatum[],
  series: readonly SeriesInput[] | undefined,
  shorthand: { dataKey?: string; label?: string; color?: string } = {},
): ResolvedSeries[] {
  const list = series?.length ? series : [{ dataKey: shorthand.dataKey ?? 'value', label: shorthand.label, color: shorthand.color }];
  return list.map((s) => ({
    dataKey: s.dataKey,
    label: s.label ?? s.dataKey,
    color: s.color,
    values: data.map((d) => toNumber(d[s.dataKey])),
  }));
}

/** Category labels for the x axis. */
export function categoryLabels(data: readonly ChartDatum[], xAxisKey = 'name'): string[] {
  return data.map((d, i) => (d[xAxisKey] === undefined ? String(i + 1) : String(d[xAxisKey])));
}

export interface Ticks {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

function niceStep(raw: number) {
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * Round axis bounds and evenly spaced ticks that cover [min, max]. Bars
 * pass `includeZero` so every building stands on the street.
 */
export function niceTicks(values: readonly number[], count = 4, includeZero = false): Ticks {
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    hi = lo + 1;
  }
  const step = niceStep((hi - lo) / Math.max(1, count));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
  return { min, max, step, ticks };
}

/** Short value for axes and readouts: 950, 1.2k, 12k, 3.4M. */
export function formatValue(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Number(n.toFixed(1)));
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e4) return `${Math.round(value / 1e3)}k`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k`;
  return trim(value);
}

// ---- line ------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface PlotBox {
  width: number;
  height: number;
  /** Inset on the left and right so the stroke and the selection dot never clip. */
  padX: number;
  /** Inset on the top and bottom. */
  padY: number;
}

/** One series' values as plot points, evenly spaced across the box. */
export function linePoints(values: readonly number[], range: { min: number; max: number }, box: PlotBox): Point[] {
  const n = values.length;
  const w = Math.max(0, box.width - box.padX * 2);
  const h = Math.max(0, box.height - box.padY * 2);
  const span = range.max - range.min || 1;
  return values.map((v, i) => ({
    x: box.padX + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: box.padY + h - ((v - range.min) / span) * h,
  }));
}

export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

/**
 * NeonBlade's `curve` prop (Recharts' curve names). monotone and basis draw
 * the smooth spline; linear joins points straight; the step kinds hold each
 * value flat. step centres the riser between points, stepAfter rises at the
 * next point, stepBefore at the current one.
 */
export type CurveType = 'smooth' | 'monotone' | 'basis' | 'linear' | 'step' | 'stepAfter' | 'stepBefore';

/** Path commands for a curve type. The smooth kinds return smoothPath. */
export function curvePath(points: readonly Point[], curve: CurveType = 'smooth'): PathCommand[] {
  if (curve === 'smooth' || curve === 'monotone' || curve === 'basis') return smoothPath(points);
  const out: PathCommand[] = [];
  points.forEach((p, i) => {
    if (i === 0) {
      out.push({ type: 'M', x: p.x, y: p.y });
      return;
    }
    const prev = points[i - 1]!;
    if (curve === 'stepAfter') {
      out.push({ type: 'L', x: p.x, y: prev.y }, { type: 'L', x: p.x, y: p.y });
    } else if (curve === 'stepBefore') {
      out.push({ type: 'L', x: prev.x, y: p.y }, { type: 'L', x: p.x, y: p.y });
    } else if (curve === 'step') {
      const mid = (prev.x + p.x) / 2;
      out.push({ type: 'L', x: mid, y: prev.y }, { type: 'L', x: mid, y: p.y }, { type: 'L', x: p.x, y: p.y });
    } else {
      out.push({ type: 'L', x: p.x, y: p.y });
    }
  });
  return out;
}

/**
 * The same uniform B-spline react-native-graph draws (CreateGraphPath), so the
 * web fallback's curve matches the native graph point for point.
 */
export function smoothPath(points: readonly Point[]): PathCommand[] {
  const out: PathCommand[] = [];
  points.forEach((p, i) => {
    if (i === 0) {
      out.push({ type: 'M', x: p.x, y: p.y });
      return;
    }
    const p1 = points[i - 1]!;
    const p0 = points[i - 2] ?? p1;
    out.push({
      type: 'C',
      x1: (2 * p0.x + p1.x) / 3,
      y1: (2 * p0.y + p1.y) / 3,
      x2: (p0.x + 2 * p1.x) / 3,
      y2: (p0.y + 2 * p1.y) / 3,
      x: (p0.x + 4 * p1.x + p.x) / 6,
      y: (p0.y + 4 * p1.y + p.y) / 6,
    });
    if (i === points.length - 1) out.push({ type: 'C', x1: p.x, y1: p.y, x2: p.x, y2: p.y, x: p.x, y: p.y });
  });
  return out;
}

/** Index of the data point nearest to an x position, or -1 for no data. */
export function nearestIndex(x: number, count: number, box: Pick<PlotBox, 'width' | 'padX'>): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  const w = Math.max(1, box.width - box.padX * 2);
  const t = (x - box.padX) / w;
  return Math.min(count - 1, Math.max(0, Math.round(t * (count - 1))));
}

// ---- bars ------------------------------------------------------------------

export interface Bar {
  series: number;
  index: number;
  value: number;
  /** Front face rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Side wall depth, drawn up and to the right of the face. */
  depth: number;
}

export interface BarLayout {
  bars: Bar[];
  /** Baseline (the street) in px: y for vertical bars, x for horizontal. */
  baseline: number;
  /** Category band centres along the category axis, for labels and hit tests. */
  centers: number[];
  band: number;
  ticks: Ticks;
}

/**
 * Buildings, not bars: each value becomes a solid face with a side wall and
 * a roof, so the chart reads as a block of the city. Grouped series stand
 * shoulder to shoulder inside their category band.
 */
export function barLayout(input: {
  series: readonly { values: readonly number[] }[];
  width: number;
  height: number;
  layout?: 'vertical' | 'horizontal';
  /** Fraction of each category band left empty, 0 to 0.9. */
  barGap?: number;
}): BarLayout {
  const { series, width, height, layout = 'vertical' } = input;
  const gap = Math.min(0.9, Math.max(0, input.barGap ?? 0.35));
  const count = Math.max(0, ...series.map((s) => s.values.length));
  const ticks = niceTicks(series.flatMap((s) => s.values), 4, true);
  const span = ticks.max - ticks.min || 1;
  const along = layout === 'vertical' ? width : height;
  const across = layout === 'vertical' ? height : width;
  const band = count ? along / count : along;
  const groupWidth = band * (1 - gap);
  const each = series.length ? groupWidth / series.length : groupWidth;
  const depth = Math.max(0, Math.min(10, each * 0.22));
  // Headroom for the roof and crown above the tallest building.
  const headroom = Math.min(across * 0.12, 18) + depth;
  const usable = Math.max(1, across - headroom);
  const zero = ((0 - ticks.min) / span) * usable;
  const centers: number[] = [];
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const center = band * i + band / 2;
    centers.push(center);
    series.forEach((s, si) => {
      const value = s.values[i] ?? 0;
      const len = (Math.abs(value) / span) * usable;
      const start = center - groupWidth / 2 + each * si;
      const faceW = Math.max(1, each - depth - 1);
      if (layout === 'vertical') {
        const base = across - zero;
        bars.push({ series: si, index: i, value, x: start, y: value >= 0 ? base - len : base, w: faceW, h: len, depth });
      } else {
        bars.push({ series: si, index: i, value, x: value >= 0 ? zero : zero - len, y: start + depth, w: len, h: faceW, depth });
      }
    });
  }
  return { bars, baseline: layout === 'vertical' ? across - zero : zero, centers, band, ticks };
}

/** Category index under a point on the category axis, or -1 outside. */
export function bandAt(position: number, layout: Pick<BarLayout, 'band' | 'centers'>): number {
  if (!layout.centers.length || position < 0) return -1;
  const i = Math.floor(position / layout.band);
  return i < layout.centers.length ? i : -1;
}

/** Deterministic 0-1 hash, so the same building keeps the same lit windows. */
export function hash2(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lit windows on a vertical building's face: a grid of small solid rects,
 * about `lit` of them on. Faces too narrow for a column get none.
 */
export function buildingWindows(bar: Pick<Bar, 'x' | 'y' | 'w' | 'h' | 'index' | 'series'>, lit = 0.45): WindowRect[] {
  const cell = 7;
  const cols = Math.floor((bar.w - 4) / cell);
  const rows = Math.floor((bar.h - 8) / (cell + 2));
  if (cols < 1 || rows < 1) return [];
  const ox = bar.x + (bar.w - cols * cell) / 2 + 1.5;
  const out: WindowRect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (hash2(bar.index * 31 + c + bar.series * 7, r) < lit) {
        out.push({ x: ox + c * cell, y: bar.y + 6 + r * (cell + 2), w: cell - 3, h: cell - 2 });
      }
    }
  }
  return out;
}

// ---- donut -----------------------------------------------------------------

export interface Segment {
  index: number;
  value: number;
  fraction: number;
  /** Degrees, clockwise from 12 o'clock, gap already removed. */
  start: number;
  sweep: number;
  /** Mid angle in degrees from 12 o'clock, for the pop-out direction. */
  mid: number;
}

/** Ring segments for non-negative values with a gap of `paddingAngle` degrees between them. */
export function donutSegments(values: readonly number[], paddingAngle = 2): Segment[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const visible = clean.filter((v) => v > 0).length;
  const pad = visible > 1 ? paddingAngle : 0;
  const free = 360 - pad * visible;
  const out: Segment[] = [];
  let angle = 0;
  clean.forEach((v, index) => {
    if (v <= 0) return;
    const sweep = (v / total) * free;
    const start = angle + pad / 2;
    out.push({ index, value: v, fraction: v / total, start, sweep, mid: start + sweep / 2 });
    angle += sweep + pad;
  });
  return out;
}

/** The segment under a point, or -1 for the hole, the gaps and outside. */
export function segmentAt(
  x: number,
  y: number,
  ring: { cx: number; cy: number; inner: number; outer: number },
  segments: readonly Segment[],
): number {
  const dx = x - ring.cx;
  const dy = y - ring.cy;
  const r = Math.hypot(dx, dy);
  if (r < ring.inner || r > ring.outer) return -1;
  // 0 degrees at 12 o'clock, clockwise, matching donutSegments.
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  const hit = segments.find((s) => deg >= s.start && deg <= s.start + s.sweep);
  return hit ? hit.index : -1;
}

/** A point on a circle, angle in degrees clockwise from 12 o'clock. */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ---- accessibility ---------------------------------------------------------

/** One sentence a screen reader can say instead of drawing the line. */
export function describeSeries(series: Pick<ResolvedSeries, 'label' | 'values'>, labels: readonly string[]): string {
  const { values } = series;
  if (!values.length) return `${series.label}: no data.`;
  let lo = 0;
  let hi = 0;
  values.forEach((v, i) => {
    if (v < values[lo]!) lo = i;
    if (v > values[hi]!) hi = i;
  });
  const at = (i: number) => labels[i] ?? String(i + 1);
  const span = labels.length > 1 ? ` from ${at(0)} to ${at(values.length - 1)}` : '';
  return `${series.label}: ${values.length} points${span}. Low ${formatValue(values[lo]!)} (${at(lo)}), high ${formatValue(values[hi]!)} (${at(hi)}), latest ${formatValue(values[values.length - 1]!)}.`;
}
