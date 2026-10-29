// The street-name lettering sits on its green blade: every glyph quad, taken
// into the blade's own frame (the instance matrix the blade box is drawn
// with), lies inside the plate face, on both faces, on the bundled tile.
// Mike, iPad 2026-10-28: "why is street sign text floating outside the signs".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { BLADE_HEIGHT, LETTER_HEIGHT } from './signage.ts';
import { buildStreetFurniture } from './street-furniture.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

type Mesh = InstanceType<typeof THREE.Mesh>;
type Instanced = InstanceType<typeof THREE.InstancedMesh>;

function build() {
  const m = new THREE.MeshBasicNodeMaterial();
  const materials = { poles: m, signBlades: m, lampHeads: m, lampPools: m, lettering: m } as never;
  return buildStreetFurniture(THREE, realTile(), materials);
}

test('street-name lettering lies on its blade face, inside the plate, on both faces', () => {
  const furniture = build();
  const blades = furniture.objects.find((o) => o.name === 'city:sign-blades') as Instanced;
  const letters = furniture.objects.find((o) => o.name === 'city:sign-lettering') as Mesh;
  assert.ok(blades && letters, 'blades and lettering meshes');
  assert.ok(furniture.signs.length > 50, `signs ${furniture.signs.length}`);

  // Blade frames: inverse instance matrices, and the box size (unit box scaled).
  const inverse: InstanceType<typeof THREE.Matrix4>[] = [];
  const size: [number, number, number][] = [];
  const centres: [number, number, number][] = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < blades.count; i++) {
    blades.getMatrixAt(i, m);
    m.decompose(p, q, s);
    centres.push([p.x, p.y, p.z]);
    size.push([s.x, s.y, s.z]);
    inverse.push(m.clone().invert());
  }
  // Every blade is a sign blade of the layout, in order.
  assert.equal(blades.count, furniture.signs.reduce((n, sign) => n + sign.blades.length, 0));

  const pos = letters.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  const local = new THREE.Vector3();
  const facesHit = new Map<number, Set<number>>();
  let worst = 0;
  let worstAt = '';
  // How far a glyph triangle leaves blade i's plate, metres (0 = on the plate face), and which face it is on.
  const leave = (t: number, i: number): { over: number; side: number; at: string } => {
    const [L, H, D] = size[i]!;
    let over = 0; let side = 0; let at = '';
    for (let k = 0; k < 3; k++) {
      local.copy(v.set(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k))).applyMatrix4(inverse[i]!);
      // Plate space in metres: x along the blade, y up, z through it.
      const x = local.x * L; const y = local.y * H; const z = local.z * D;
      const o = Math.max(Math.abs(x) - L / 2, Math.abs(y) - H / 2, Math.abs(z) - (D / 2 + 0.01), 0);
      if (o >= over) { over = o; at = `(${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}) in ${L.toFixed(2)} x ${H.toFixed(2)} x ${D.toFixed(3)}`; }
      side = Math.sign(z);
    }
    return { over, side, at };
  };
  for (let t = 0; t < pos.count; t += 3) {
    // The glyph's blade: of the blades at its pole, the one it leaves least.
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    let best = -1; let fit = { over: Infinity, side: 0, at: '' };
    for (let i = 0; i < centres.length; i++) {
      const [bx, , bz] = centres[i]!;
      if (Math.abs(bx - cx) > 3 || Math.abs(bz - cz) > 3) continue;
      const f = leave(t, i);
      if (f.over < fit.over) { fit = f; best = i; }
      // Every plate the glyph sits on counts it on that face (a blade drawn
      // twice in one place, where a street changes name at an avenue, shares it).
      if (f.over < 1e-4) {
        if (!facesHit.has(i)) facesHit.set(i, new Set());
        facesHit.get(i)!.add(f.side);
      }
    }
    assert.ok(best >= 0, `glyph at ${cx.toFixed(1)},${cz.toFixed(1)} has no blade`);
    if (fit.over > worst) { worst = fit.over; worstAt = `blade ${best} ${fit.at}`; }
  }
  assert.ok(worst < 1e-4, `lettering leaves its plate by ${worst.toFixed(3)} m at ${worstAt}`);
  // Both faces of every blade carry the name.
  for (let i = 0; i < blades.count; i++) {
    const sides = facesHit.get(i);
    assert.ok(sides && sides.has(1) && sides.has(-1), `blade ${i} lettered on ${sides ? [...sides] : 'no'} faces`);
  }
  // Sized to the plate: the letters fill most of the plate height.
  assert.ok(LETTER_HEIGHT < BLADE_HEIGHT && LETTER_HEIGHT / BLADE_HEIGHT > 0.5);
  furniture.dispose();
});
