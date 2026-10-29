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
import { VD_STOREFRONT_PLAN as PLAN } from './plan.generated.ts';

const toScene = valdradaToScene(dataset.origin as [number, number]);
const flat = () => 0;
const result = emitPlan(PLAN, flat);
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
  const gb = result.buffers.paint.extra.aGate!;
  let curtains = 0;
  for (let i = 0; i < gb.length; i += 3) {
    if (gb[i + 1]! < -999) continue;
    curtains++;
    assert.ok(gb[i + 2]! >= 0 && gb[i + 2]! <= 1 && gb[i]! > gb[i + 1]!);
  }
  assert.ok(curtains >= gates.length * 6, `${curtains / 6} curtains`);
});

test('no invented names: units are blank and closed, every sign belongs to a recorded front', () => {
  for (const f of PLAN.fronts.filter((x) => x.src === 2)) {
    assert.equal(f.signs.length, 0);
    assert.equal(f.awnings.length, 0);
  }
  assert.ok(result.features.filter((f) => f.kind === 'unit').every((f) => f.dayDown === 1));
  for (const f of result.features.filter((x) => x.kind === 'sign')) assert.notEqual(byFront.get(f.front)!.src, 2);
  // with a Valdrada checkout beside it, every lettered string is in Valdrada's own spec or namedShops source
  const root = process.env.VALDRADA ?? join(homedir(), 'src/valdrada');
  const specs = join(root, 'client/src/city/fk/specs');
  if (!existsSync(specs)) return;
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const corpus = fold([...readdirSync(specs).map((f) => readFileSync(join(specs, f), 'utf8')), readFileSync(join(root, 'client/src/city/namedShops.js'), 'utf8')].join('\n'));
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
  for (const s of SLOTS) tris += result.buffers[s].position.length / 9;
  assert.ok(tris > 0 && tris < 1_000_000, `${tris} triangles`);
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
