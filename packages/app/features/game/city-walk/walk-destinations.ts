// Where the website's walk can go, and what it can read, all from the baked Valdrada data — nothing invented:
//
//   - walkCameraBounds: the rect the walk's camera store clamps to, grown from the cell manifest's mapped cells
//     (the home tile and every baked ring) and the far tier's landmark positions, so a guest can reach any
//     place the bake actually drew without panning into the void past it;
//   - walkDestinations: the Go to list — the far-tier landmark registry's 59 named places (towers, buildings,
//     the monument, the bridges) plus the walk's own start on 125th Street;
//   - landmarkLabels / signLabels: the overlay's label set — the same landmarks, and the storefront plan's
//     recorded signs (spec'd and named fronts only; kit fronts carry invented names the port does not draw);
//   - pickOverlayLabels: which of those show this frame, and where on the canvas.
//
// Pure: no three, no IO. Positions are scene metres through the dataset's own Valdrada transform (the same
// affine the port draws with, transform.ts).
import type { CameraBounds } from '../city-camera.ts';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import type { CityCamera } from '../city-scene.ts';
import { VD_CELL_MANIFEST } from '../world/cell-source/data/vd-cells-manifest.ts';
import { valdradaToScene, type TileOrigin } from '../world/vd-port/transform.ts';
import { VD_FAR } from '../world/vd-port/far-tier/data/manifest.ts';
import type { StorefrontPlan } from '../world/vd-port/storefronts/plan-types.ts';
import { cameraBasis, projectToScreen, type WalkViewport } from './walk-view.ts';
import { CELL } from '../world/cells/cell-rules.ts';

/** One named place on the Go to list. */
export interface WalkDestination {
  readonly key: string;
  readonly name: string;
  /** The far manifest's kind: tower | building | monument | bridge. */
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  /** The camera distance that frames it (its silhouette radius x 2.4, clamped to the camera's range). */
  readonly distance: number;
}

/** How far past the mapped cells and landmarks the camera may still look, metres. */
const BOUNDS_MARGIN_M = 700;
/** Framing multiplier on a landmark's silhouette radius for its Go to distance. */
const DESTINATION_RADIUS_FACTOR = 2.4;
const DESTINATION_MIN_DISTANCE = 200;
const DESTINATION_MAX_DISTANCE = 3000;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface VdFarLandmark {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly center: readonly number[];
  readonly radius: number;
}

/**
 * The walk's pan rect: the union of the mapped cell coverage (every `kind/cx_cz` cell the cell manifest serves —
 * home tile and rings, scene frame) and each landmark's scene position, plus a margin so the camera can look
 * past an edge place instead of stopping on it.
 */
export function walkCameraBounds(origin: TileOrigin): CameraBounds {
  const toScene = valdradaToScene(origin);
  let minX = -2000, maxX = 2000, minZ = -2000, maxZ = 2000;
  for (const key of Object.keys(VD_CELL_MANIFEST.cells)) {
    // Far-tier keys are file names ('far/L4_-10_10.bin'), not streamer cells; skip them.
    const m = /(?:^|\/)(-?\d+)_(-?\d+)$/.exec(key);
    if (!m || key.startsWith('far/')) continue;
    const x0 = Number(m[1]) * CELL, z0 = Number(m[2]) * CELL;
    if (x0 < minX) minX = x0;
    if (x0 + CELL > maxX) maxX = x0 + CELL;
    if (z0 < minZ) minZ = z0;
    if (z0 + CELL > maxZ) maxZ = z0 + CELL;
  }
  for (const L of VD_FAR.landmarks?.entries ?? []) {
    const lm = L as VdFarLandmark;
    const [x, z] = toScene(lm.center[0]!, lm.center[2]!);
    const r = Number.isFinite(lm.radius) ? lm.radius : 0;
    if (x - r < minX) minX = x - r;
    if (x + r > maxX) maxX = x + r;
    if (z - r < minZ) minZ = z - r;
    if (z + r > maxZ) maxZ = z + r;
  }
  return { minX: minX - BOUNDS_MARGIN_M, maxX: maxX + BOUNDS_MARGIN_M, minZ: minZ - BOUNDS_MARGIN_M, maxZ: maxZ + BOUNDS_MARGIN_M };
}

/** The Go to list: the walk's own start first, then every far-tier landmark, kind-grouped (places, then bridges). */
export function walkDestinations(origin: TileOrigin): WalkDestination[] {
  const toScene = valdradaToScene(origin);
  const rank = (kind: string) => (kind === 'bridge' ? 1 : 0);
  const entries = (VD_FAR.landmarks?.entries ?? []) as readonly VdFarLandmark[];
  const places = entries
    .map((L) => {
      const [x, z] = toScene(L.center[0]!, L.center[2]!);
      return {
        key: `lm:${L.key}`,
        name: L.name,
        kind: L.kind,
        x,
        z,
        distance: clamp(L.radius * DESTINATION_RADIUS_FACTOR, DESTINATION_MIN_DISTANCE, DESTINATION_MAX_DISTANCE),
      };
    })
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name));
  return [
    { key: 'start', name: '125th Street, by the Apollo', kind: 'start', x: INITIAL_CITY_CAMERA.x, z: INITIAL_CITY_CAMERA.z, distance: INITIAL_CITY_CAMERA.distance },
    ...places,
  ];
}

/** The destination nearest a ground point, with its metres off, for the "you are here" line. The 'start' row is a
 * UI convenience for the Go to list, not a place name, so it never answers here. */
export function nearestDestination(x: number, z: number, destinations: readonly WalkDestination[]): { destination: WalkDestination; meters: number } | null {
  let best: WalkDestination | null = null;
  let bestD = Infinity;
  for (const d of destinations) {
    if (d.kind === 'start') continue;
    const meters = Math.hypot(d.x - x, d.z - z);
    if (meters < bestD) {
      best = d;
      bestD = meters;
    }
  }
  return best ? { destination: best, meters: bestD } : null;
}

// ---- overlay labels -------------------------------------------------------------

export type WalkLabelKind = 'landmark' | 'street' | 'sign';

/** One world-anchored name the overlay can place. */
export interface WalkLabel {
  readonly key: string;
  readonly text: string;
  readonly kind: WalkLabelKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Street labels only: the piece's local heading, for rotating the label along the street. */
  readonly angle?: number;
}

/** The landmarks as overlay labels, floating a little over each silhouette's recorded centre. */
export function landmarkLabels(origin: TileOrigin): WalkLabel[] {
  const toScene = valdradaToScene(origin);
  const entries = (VD_FAR.landmarks?.entries ?? []) as readonly VdFarLandmark[];
  return entries.map((L) => {
    const [x, z] = toScene(L.center[0]!, L.center[2]!);
    return { key: `lm:${L.key}`, text: L.name, kind: 'landmark' as const, x, y: L.center[1]! + L.radius * 0.25, z };
  });
}

// A sign label is worth reading only close up; past this zoom it is noise on the towers.
const SIGN_MAX_CAMERA_DISTANCE = 900;
const STREET_MAX_CAMERA_DISTANCE = 1400;
const SIGN_MAX_RANGE_M = 400;
const STREET_MAX_RANGE_M = 450;
const MAX_LANDMARK_LABELS = 14;
const MAX_NEAR_LABELS = 10;
/** Pixels past the canvas edge a projected label may still show at. */
const SCREEN_MARGIN_PX = 60;

export interface PlacedLabel {
  readonly key: string;
  readonly text: string;
  readonly kind: WalkLabelKind;
  readonly x: number;
  readonly y: number;
  /** Street labels only: screen-space angle of the piece, degrees, for CSS rotation. */
  readonly angle?: number;
}

const signKey = (text: string, x: number, z: number) => `sign:${text}:${Math.round(x / 40)}:${Math.round(z / 40)}`;

/**
 * The storefront plan's recorded signs as overlay labels: spec'd fronts (src 0) and namedShops fronts (src 1)
 * only — kit fronts (src 2) letter from an invented roster the port deliberately leaves blank. Anchored a couple
 * of metres over the sign band, deduped on repeated text at one spot.
 */
export function signLabels(plan: StorefrontPlan | null): WalkLabel[] {
  if (!plan) return [];
  const seen = new Set<string>();
  const labels: WalkLabel[] = [];
  for (const f of plan.fronts) {
    if (f.src === 2 || !f.signs?.length) continue;
    const ux = f.u[0]!, uz = f.u[1]!, nx = f.n[0]!, nz = f.n[1]!;
    for (const s of f.signs) {
      const text = s.text?.trim();
      if (!text) continue;
      const u = (s.u0 + s.u1) / 2;
      const x = f.p0[0]! + u * ux + s.z * nx;
      const z = f.p0[1]! + u * uz + s.z * nz;
      const key = signKey(text, x, z);
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push({ key, text, kind: 'sign', x, y: s.y + s.h + 4, z });
    }
  }
  return labels;
}

/**
 * The labels to draw this frame and their canvas positions. Landmarks stay (they read at skyline range); street
 * and sign labels appear only when the camera is low enough to read them and they sit near the look-at. Each
 * group keeps its nearest few, so the view is annotated, never papered over.
 */
export function pickOverlayLabels(
  camera: CityCamera,
  viewport: WalkViewport,
  groups: { landmarks: readonly WalkLabel[]; signs: readonly WalkLabel[]; streets: readonly WalkLabel[] },
): PlacedLabel[] {
  const basis = cameraBasis(camera);
  if (!basis) return [];
  const place = (label: WalkLabel): (PlacedLabel & { depth: number }) | null => {
    const p = projectToScreen(basis, label.x, label.y, label.z, viewport);
    if (!p) return null;
    if (p.x < -SCREEN_MARGIN_PX || p.x > viewport.width + SCREEN_MARGIN_PX || p.y < -SCREEN_MARGIN_PX || p.y > viewport.height + SCREEN_MARGIN_PX) return null;
    let angle: number | undefined;
    if (label.angle !== undefined) {
      const along = projectToScreen(basis, label.x + Math.cos(label.angle) * 12, label.y, label.z + Math.sin(label.angle) * 12, viewport);
      if (along) {
        let deg = (Math.atan2(along.y - p.y, along.x - p.x) * 180) / Math.PI;
        // Never upside down: flip the text the short way round.
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;
        angle = deg;
      }
    }
    return { key: label.key, text: label.text, kind: label.kind, x: p.x, y: p.y, depth: p.depth, ...(angle !== undefined ? { angle } : {}) };
  };
  const near = (label: WalkLabel, range: number) => Math.hypot(label.x - camera.x, label.z - camera.z) <= range;
  const landmarks = groups.landmarks.map(place).filter((p): p is NonNullable<typeof p> => p !== null);
  landmarks.sort((a, b) => a.depth - b.depth);
  const signs = camera.distance <= SIGN_MAX_CAMERA_DISTANCE
    ? groups.signs.filter((l) => near(l, SIGN_MAX_RANGE_M)).map(place).filter((p): p is NonNullable<typeof p> => p !== null)
    : [];
  signs.sort((a, b) => a.depth - b.depth);
  const streets = camera.distance <= STREET_MAX_CAMERA_DISTANCE
    ? groups.streets.filter((l) => near(l, STREET_MAX_RANGE_M)).map(place).filter((p): p is NonNullable<typeof p> => p !== null)
    : [];
  streets.sort((a, b) => a.depth - b.depth);
  return [
    ...landmarks.slice(0, MAX_LANDMARK_LABELS),
    ...signs.slice(0, MAX_NEAR_LABELS),
    ...streets.slice(0, MAX_NEAR_LABELS),
  ];
}
