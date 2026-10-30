// The vd lane's kerb (city-mesh.ts curbFaces): every granite curb face in
// the no-depth sidewalk underlay has a depth-writing twin in the roofs mesh,
// turned toward the sidewalk, so the lower carriageway cannot paint over the
// raised sidewalk's edge. Without it the kerb edge receded toward the camera
// and the facelift's kerb light looked as if it lay in the road (Mike, iPad
// 2026-10-28).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityMeshes, LAYER } from './city-mesh.ts';
import { CURB_HEIGHT } from './curb.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { createStreetClearance } from './walkability.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('every curb face has a depth-writing twin facing the sidewalk', { skip: CURB_HEIGHT === 0 ? 'flat city: no kerb' : false }, () => {
  const dataset = realTile();
  const clearance = createStreetClearance(dataset);
  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const built = buildCityMeshes(THREE, dataset, materials, [0.5, -0.5], clearance);
  const mesh = (name: string) => built.meshes.find((m) => m.name === name)!;
  const y0 = LAYER.roads; const y1 = LAYER.sidewalks + CURB_HEIGHT;

  // Kerb-height vertical triangles in a buffer: the centre of their footprint, and the winding normal in xz.
  const kerbQuads = (name: string) => {
    const pos = mesh(name).geometry.getAttribute('position');
    const out: { x: number; z: number; nx: number; nz: number }[] = [];
    for (let t = 0; t + 2 < pos.count; t += 3) {
      const ys = [0, 1, 2].map((k) => pos.getY(t + k));
      if (Math.abs(Math.min(...ys) - y0) > 1e-4 || Math.abs(Math.max(...ys) - y1) > 1e-4) continue;
      const xs = [0, 1, 2].map((k) => pos.getX(t + k)); const zs = [0, 1, 2].map((k) => pos.getZ(t + k));
      const a = [xs[0]!, ys[0]!, zs[0]!]; const b = [xs[1]!, ys[1]!, zs[1]!]; const c = [xs[2]!, ys[2]!, zs[2]!];
      const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]; const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      const nx = u[1]! * v[2]! - u[2]! * v[1]!; const nz = u[0]! * v[1]! - u[1]! * v[0]!;
      const l = Math.hypot(nx, nz);
      if (l < 1e-9) continue;
      out.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, nx: nx / l, nz: nz / l });
    }
    return out;
  };
  const faces = kerbQuads('city:sidewalks');
  const twins = kerbQuads('city:roofs');
  assert.ok(faces.length > 2000, `${faces.length} curb face triangles`);
  // Each face has a twin on the same footprint (the underlay is double-sided, so its own winding says nothing).
  const at = new Map<string, typeof twins>();
  const key = (q: { x: number; z: number }) => `${q.x.toFixed(3)},${q.z.toFixed(3)}`;
  for (const q of twins) at.set(key(q), [...(at.get(key(q)) ?? []), q]);
  const lonely = faces.filter((f) => !(at.get(key(f)) ?? []).some((t) => Math.abs(t.nx * f.nx + t.nz * f.nz) > 0.99));
  assert.equal(lonely.length, 0, `${lonely.length} curb face triangles without a twin, first ${JSON.stringify(lonely[0])}`);
  // The twins' fronts face the sidewalk: a step along the winding normal leaves the carriageway, a step against it enters.
  const matched = faces.map((f) => at.get(key(f))!.find((t) => Math.abs(t.nx * f.nx + t.nz * f.nz) > 0.99)!);
  let wrong = 0;
  for (const q of matched) {
    if (clearance.kerbGap(q.x + q.nx * 0.3, q.z + q.nz * 0.3) <= clearance.kerbGap(q.x - q.nx * 0.3, q.z - q.nz * 0.3)) wrong++;
  }
  assert.equal(wrong, 0, `${wrong} of ${matched.length} twins face the road`);
  // The roofs mesh writes depth; the sidewalk underlay does not.
  assert.equal((mesh('city:roofs').material as InstanceType<typeof THREE.Material>).depthWrite, true);
  assert.equal((mesh('city:sidewalks').material as InstanceType<typeof THREE.Material>).depthWrite, false);
  built.dispose();
  materials.dispose();
});
