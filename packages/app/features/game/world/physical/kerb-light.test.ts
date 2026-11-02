// The facelift's royal kerb light line (facelift.ts kerbLightSegments) on the
// bundled Harlem tile: every piece lies on the sidewalk side of a kerb,
// within about 10 cm of it, and no corner of any piece lands inside a drawn
// carriageway or crossing (the road mesh's own ribbons, city-mesh.ts strip).
// Mike, iPad 2026-10-28: "why are lights outside the sidewalk".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset } from '../../city-dataset.ts';
import { CURB_HEIGHT } from '../curb.ts';
import { pairs, ribbon } from '../geometry.ts';
import { createStreetClearance, WALKWAY_CLASSES } from '../walkability.ts';
import { FACELIFT, kerbLightSegments } from './facelift.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));

type Quad = [number, number][];

/** The carriageway and crossing quads exactly as city-mesh.ts draws them (strip at widthMeters / 2), in a 16 m grid. */
function carriageways(dataset: ReturnType<typeof realTile>) {
  const cell = 16;
  const grid = new Map<string, Quad[]>();
  for (const road of dataset.roads) {
    if (WALKWAY_CLASSES.has(road.class)) continue;
    const points = pairs(road.points);
    if (points.length < 2) continue;
    const { left, right } = ribbon(points, road.widthMeters / 2);
    for (let i = 1; i < points.length; i++) {
      const quad: Quad = [left[i - 1]!, left[i]!, right[i]!, right[i - 1]!];
      const xs = quad.map((p) => p[0]); const zs = quad.map((p) => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / cell); gx <= Math.floor(Math.max(...xs) / cell); gx++) {
        for (let gz = Math.floor(Math.min(...zs) / cell); gz <= Math.floor(Math.max(...zs) / cell); gz++) {
          const key = `${gx},${gz}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push(quad);
        }
      }
    }
  }
  const inQuad = (q: Quad, x: number, z: number) => {
    // Convex quad (or a bow-tie at a hairpin): inside when every edge turns the same way.
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = q[i]!; const [bx, bz] = q[(i + 1) % 4]!;
      const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax);
      if (Math.abs(cross) < 1e-9) continue;
      const s = Math.sign(cross);
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
  };
  const segDist = (x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) => {
    const dx = bx - ax; const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  };
  const near = (x: number, z: number) => {
    const out: Quad[] = [];
    for (let gx = Math.floor(x / cell) - 1; gx <= Math.floor(x / cell) + 1; gx++) {
      for (let gz = Math.floor(z / cell) - 1; gz <= Math.floor(z / cell) + 1; gz++) out.push(...(grid.get(`${gx},${gz}`) ?? []));
    }
    return out;
  };
  return {
    inRoad: (x: number, z: number) => (grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []).some((q) => inQuad(q, x, z)),
    /** Distance to the nearest drawn carriageway or crossing quad: the kerb line the road mesh draws. */
    kerbDistance: (x: number, z: number) => {
      let best = Infinity;
      for (const q of near(x, z)) {
        if (inQuad(q, x, z)) return 0;
        for (let i = 0; i < 4; i++) best = Math.min(best, segDist(x, z, q[i]!, q[(i + 1) % 4]!));
      }
      return best;
    },
  };
}

test('every kerb light piece sits on the sidewalk side of a kerb, within 10 cm, clear of every carriageway and crossing', () => {
  const dataset = realTile();
  const clearance = createStreetClearance(dataset);
  const segments = kerbLightSegments(dataset, clearance);
  const { inRoad, kerbDistance } = carriageways(dataset);
  const half = FACELIFT.kerbWidth / 2;
  let metres = 0;
  let worstGap = 0;
  let worstAt = '';
  const bad: string[] = [];
  for (const s of segments) {
    const length = Math.hypot(s.bx - s.ax, s.bz - s.az);
    metres += length;
    const dx = (s.bx - s.ax) / length; const dz = (s.bz - s.az) / length;
    const px = -dz * half; const pz = dx * half;
    const steps = Math.max(1, Math.ceil(length / 0.1));
    for (let k = 0; k <= steps; k++) {
      const x = s.ax + (s.bx - s.ax) * (k / steps); const z = s.az + (s.bz - s.az) * (k / steps);
      // Both long edges and the centre line stay out of the drawn road and crossing quads.
      for (const [ex, ez] of [[x + px, z + pz], [x, z], [x - px, z - pz]] as const) {
        if (inRoad(ex, ez) && bad.length < 5) bad.push(`(${ex.toFixed(2)}, ${ez.toFixed(2)})`);
      }
      // The centre line hugs a kerb: past every carriageway buffer, and within 10 cm of the drawn kerb.
      assert.ok(clearance.kerbGap(x, z) > 0, `kerb light inside a carriageway at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      const gap = kerbDistance(x, z);
      if (gap > worstGap) { worstGap = gap; worstAt = `(${x.toFixed(2)}, ${z.toFixed(2)})`; }
    }
  }
  assert.deepEqual(bad, [], `kerb light over the carriageway at ${bad.join(', ')}`);
  assert.ok(worstGap <= 0.1 + 1e-6, `kerb light centre ${worstGap.toFixed(3)} m from the nearest kerb at ${worstAt}`);
  // Still a lit avenue, not a handful of stubs.
  assert.ok(metres > 1000, `${metres.toFixed(0)} m of kerb light`);
  assert.ok(segments.every((s) => s.y > CURB_HEIGHT), 'on top of the raised sidewalk');
});
