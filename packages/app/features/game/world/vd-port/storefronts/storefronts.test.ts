// Lane B: the storefronts sit where Valdrada puts them, carry only the names Valdrada recorded, and their gates come
// down after dark.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import dataset from '../../../data/harlem-apollo.json' with { type: 'json' };
import { valdradaToScene } from '../transform.ts';
import { emitPlan, gateDrop, SLOTS, valdradaPoint, type Feature } from './emit.ts';
import { FASCIA_ATLAS_HEIGHT, FASCIA_ATLAS_R8, FASCIA_ATLAS_WIDTH } from './fascia-atlas.generated.ts';
import { loadVdStorefrontPlanFromDisk } from './load-from-disk.test-support.ts';

const PLAN = loadVdStorefrontPlanFromDisk();

const toScene = valdradaToScene(dataset.origin as [number, number]);
const flat = () => 0;
// The whole union plan, written a batch of fronts at a time: what the tests read (the features, each slot's triangle
// count, the gate curtains) is kept and the vertex buffers dropped, so the test holds one batch's buffers rather than
// every ring's at once (~18 M triangles, several GB). A front writes the same whatever is written beside it
// (ring-packages.test.ts holds the batched writes to the whole one).
const result = (() => {
  const features: Feature[] = [];
  const tris = { paint: 0, detail: 0, glass: 0 };
  // gates test: aGate entries not below -999 (and whether each is a well-formed curtain); dresser test: entries above it
  let curtainVerts = 0, curtainAbove = 0, malformed = 0;
  for (let b = 0; b < PLAN.fronts.length; b += 2000) {
    const r = emitPlan({ ...PLAN, fronts: PLAN.fronts.slice(b, b + 2000) }, flat);
    for (const f of r.features) features.push(f);
    for (const s of SLOTS) tris[s] += r.buffers[s].position.length / 9;
    for (const gb of [r.buffers.paint.extra.aGate!, r.buffers.detail.extra.aGate!]) {
      for (let i = 0; i < gb.length; i += 3) {
        if (gb[i + 1]! > -999) curtainAbove++;
        if (gb[i + 1]! < -999) continue;
        curtainVerts++;
        if (!(gb[i + 2]! >= 0 && gb[i + 2]! <= 1 && gb[i]! > gb[i + 1]!)) malformed++;
      }
    }
  }
  return { features, tris, curtainVerts, curtainAbove, malformed };
})();
const byFront = new Map(PLAN.fronts.map((f) => [f.id, f]));

/** Distance along the face between a feature and Valdrada's own point for its u, through transform.ts. */
function alongError(f: Feature): { along: number; out: number } {
  const front = byFront.get(f.front)!;
  const [vx, vz] = valdradaPoint(front, f.u);
  const [ex, ez] = toScene(vx, vz);
  const dx = f.x - ex, dz = f.z - ez;
  return { along: Math.abs(dx * front.u[0]! + dz * front.u[1]!), out: dx * front.n[0]! + dz * front.n[1]! };
}

test('measured storefronts: a door, a gate and the real sign within 5 cm of Valdrada', () => {
  const real = PLAN.fronts.filter((f) => f.src === 0);
  let complete = 0;
  for (const front of real) {
    const fs = result.features.filter((f) => f.front === front.id);
    for (const f of fs) {
      const e = alongError(f);
      assert.ok(e.along <= 0.05, `${front.addr} ${f.kind} ${f.text ?? ''}: ${e.along.toFixed(3)} m along the face from Valdrada`);
      assert.ok(Math.abs(e.out) < 2, `${front.addr} ${f.kind}: ${e.out.toFixed(2)} m off the wall plane`);
    }
    if (fs.some((f) => f.kind === 'door') && fs.some((f) => f.kind === 'gate') && fs.some((f) => f.kind === 'sign')) complete++;
  }
  assert.ok(real.length >= 150, `${real.length} measured faces in bounds`);
  assert.ok(complete >= 30, `${complete} measured faces carry a door, a gate and a sign`);
});

test('named fronts: the Amsterdam Ave shops with their doors and fascia names', () => {
  const texts = new Set(result.features.filter((f) => f.kind === 'sign').map((f) => f.text));
  for (const t of ['HARTLEY CHEMIST', 'PHARMACY', 'SLICED', 'SUZI CONFECTIONS', 'APPLETREE DELI', 'APPLETREE MARKET', "DUNKIN'"]) assert.ok(texts.has(t), t);
  const named = PLAN.fronts.filter((f) => f.src === 1);
  assert.ok(named.length >= 2);
  for (const front of named) for (const f of result.features.filter((x) => x.front === front.id)) assert.ok(alongError(f).along <= 0.05, `${front.id} ${f.kind}`);
  assert.ok(result.features.some((f) => byFront.get(f.front)?.src === 1 && f.kind === 'door'));
});

test('known 125th Street signs are where Valdrada measured them', () => {
  for (const t of ['SHOWMANS', 'CAPSULE', 'PHARMACY & SURGICAL', 'BLESSING GOOD YEAR', 'APOLLO']) {
    const hit = result.features.find((f) => f.kind === 'sign' && f.text?.toUpperCase().replace(/\s+/g, ' ') === t);
    assert.ok(hit, t);
    assert.ok(alongError(hit).along <= 0.05, t);
  }
});

test('gates: measured position by day, down after dark', () => {
  assert.equal(gateDrop(0, 0), 0);
  assert.equal(gateDrop(0.5, 0.28), 0.5);   // twilight is day for the shutters
  assert.equal(gateDrop(0, 1), 1);
  assert.equal(gateDrop(0.3, 0.86), 1);     // midnight preset
  const gates = result.features.filter((f) => f.kind === 'gate');
  assert.ok(gates.length >= 100, `${gates.length} gates`);
  assert.ok(gates.filter((g) => gateDrop(g.dayDown!, 0) < 1).length > gates.length / 2, 'most measured gates are up by day');
  assert.ok(gates.every((g) => gateDrop(g.dayDown!, 1) === 1), 'every gate is down at night');
  // the curtain carries its day position for the shader
  // walked per buffer: the union plan's two Float32Arrays together pass V8's plain-array limit (ring 8), so no spread
  const curtains = result.curtainVerts;
  assert.equal(result.malformed, 0, 'every curtain vertex: day share in [0, 1], top above foot');
  assert.ok(curtains / 6 >= gates.length, `${curtains / 6} curtains`);
});

test("the dresser units: Valdrada's sign roster, its gates up by day on about three in four, all down after dark", () => {
  const units = PLAN.fronts.flatMap((f) => (f.src === 2 ? f.units ?? [] : []));
  assert.ok(units.length > 4000, `${units.length} units`);
  const open = units.filter((u) => u.gate === 0).length / units.length;
  assert.ok(open > 0.7 && open < 0.82, `${(open * 100).toFixed(1)} % of units open by day (nycDress FAC8: 76 %)`);
  for (const u of units) assert.ok(u.slot >= 0 && PLAN.slots[u.slot], 'every unit carries a roster sign');
  // every open unit has storeBay's door in its entry bay; a gated one shows its gate instead
  const unitFronts = new Set(PLAN.fronts.filter((f) => f.src === 2).map((f) => f.id));
  const doors = result.features.filter((f) => f.kind === 'door' && unitFronts.has(f.front));
  assert.equal(doors.length, units.filter((u) => u.gate === 0).length);
  for (const f of PLAN.fronts.filter((x) => x.src === 2)) {
    for (const u of f.units ?? []) {
      if (u.gate !== 0) continue;
      const w = u.w - 0.5, gwidth = Math.min(2.2, w * 0.4), du = u.u + u.side * (w / 2 - gwidth / 2);
      const d = doors.find((x) => x.front === f.id && Math.abs(x.u - du) <= Math.max(0.06, (gwidth - 1.12) / 2) + 1e-6);
      assert.ok(d, `${f.id} unit at ${u.u}: a door in its entry bay`);
    }
  }
  // every unit's glazing has a curtain to close at night: one per open or full unit, two per partial one
  const curtains = result.curtainAbove / 6;
  const want = units.reduce((n, u) => n + (u.gate === 1 ? 2 : 1), 0) + result.features.filter((f) => f.kind === 'gate').length;
  assert.equal(curtains, want);
});

test("every lettered string is Valdrada's: its specs, namedShops, the sign rosters", () => {
  // every sign sits on a front the plan names: a spec'd face, a named front, or a dresser unit
  for (const f of result.features.filter((x) => x.kind === 'sign')) assert.ok(byFront.has(f.front));
  // with a Valdrada checkout beside it, every string is in Valdrada's own source: the fk specs, namedShops.js, the
  // facade rosters (fasciaAtlas.js, shopSigns.js) and the kit's storefront sign atlas (src/textures.js SIGN_TEXTS)
  const root = process.env.VALDRADA ?? join(homedir(), 'src/valdrada');
  const specs = join(root, 'client/src/city/fk/specs');
  if (!existsSync(specs)) return;
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const sources = [
    ...readdirSync(specs).map((f) => join(specs, f)),
    join(root, 'client/src/city/namedShops.js'), join(root, 'client/src/city/fasciaAtlas.js'),
    join(root, 'client/src/city/shopSigns.js'), join(root, 'src/textures.js'),
  ];
  const corpus = fold(sources.map((f) => readFileSync(f, 'utf8')).join('\n'));
  for (const text of PLAN.slots) {
    for (const part of text.split(/\s{2,}| ➚ | • /)) assert.ok(corpus.includes(fold(part)), `"${part}" is not in Valdrada's data`);
  }
});

test('budgets: three materials, one power-of-two atlas, texture growth under 24 MB', () => {
  assert.equal(SLOTS.length, 3);
  const pow2 = (n: number) => (n & (n - 1)) === 0;
  assert.ok(pow2(FASCIA_ATLAS_WIDTH) && pow2(FASCIA_ATLAS_HEIGHT));
  assert.equal(Buffer.from(FASCIA_ATLAS_R8, 'base64').length, FASCIA_ATLAS_WIDTH * FASCIA_ATLAS_HEIGHT);
  const bytes = FASCIA_ATLAS_WIDTH * FASCIA_ATLAS_HEIGHT * (4 / 3);   // R8 with its mip chain
  assert.ok(bytes <= 24 * 1024 * 1024, `${(bytes / 1048576).toFixed(1)} MB`);
  let tris = 0;
  for (const s of SLOTS) tris += result.tris[s];
  // the runaway check, per front so it holds as the plan grows: the union plan has emitted ~245 triangles a front at
  // every size so far (rings 1-6: ~53k fronts, ~12.9 M; rings 1-8: 75,691, 18.4 M; a rings 1-9 trial bake: 87,404, 21.6 M)
  assert.ok(tris > 0 && tris < 300 * PLAN.fronts.length, `${tris} triangles for ${PLAN.fronts.length} fronts`);
});

test('no unguarded normalize(cross(...)) in the lane', () => {
  for (const f of ['emit.ts', 'materials.ts', 'index.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/normalize\(\s*cross\(|cross\([^)]*\)\.normalize\(/.test(src), f);
  }
});

test('the plan builds only on the tile it was baked for', async () => {
  const { planFitsTile } = await import('./index.ts');
  assert.ok(planFitsTile(toScene), 'harlem-apollo.json');
  assert.ok(!planFitsTile(valdradaToScene([-73.98, 40.75])), 'another origin');
});

test("the camera floor the culls rely on is the chase camera's lowest pose", async () => {
  const { cameraPose, CAMERA_MIN_DISTANCE } = await import('../../../city-scene.ts');
  const { EYE_FLOOR } = await import('./emit.ts');
  const low = cameraPose({ x: 0, z: 0, yaw: 0, distance: CAMERA_MIN_DISTANCE });
  assert.ok(low.position[1] - 0.14 > EYE_FLOOR, `camera ${low.position[1].toFixed(2)} m, floor ${EYE_FLOOR} m over the curb`);
});
