// Emitter roundtrip tests for the Phase 4 game-system packs — node --test, run after
// tooling/city/valdrada/fetch.mjs has populated tooling/city/.cache/valdrada (pins.json's integrity
// record covers the tile bytes). Each emitter runs into a temp dir; the packs decode through the app's
// own TS loaders, once per kind, checking kind/key agreement, cell membership and determinism.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeColliderCell } from '../../../packages/app/features/game/world/vd-port/systems/colliders.ts';
import { decodeLabelCell } from '../../../packages/app/features/game/world/vd-port/systems/labels.ts';
import { decodePedCell } from '../../../packages/app/features/game/world/vd-port/systems/pednet.ts';
import { decodeSpawnCell } from '../../../packages/app/features/game/world/vd-port/systems/spawns.ts';
import { decodeTrafficCell } from '../../../packages/app/features/game/world/vd-port/systems/traffic.ts';
import { writeColliderCells } from './write-colliders.mjs';
import { writeLabelCells } from './write-labels.mjs';
import { writePedCells } from './write-pednet.mjs';
import { writeSpawnCells, loadEncounterProfiles } from './write-spawns.mjs';
import { writeTrafficCells } from './write-traffic.mjs';
import { tileIdsForSquare } from '../valdrada/decode.mjs';
import { CACHE, PINS, loadTiles } from './vd-game-cells.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const bytes = (p) => readFile(p).then((b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength));

const EMITTERS = [
  ['colliders', writeColliderCells, decodeColliderCell],
  ['pednet', writePedCells, decodePedCell],
  ['traffic', writeTrafficCells, decodeTrafficCell],
  ['spawns', writeSpawnCells, decodeSpawnCell],
  ['labels', writeLabelCells, decodeLabelCell],
];

let tiles;
test.before(async () => {
  tiles = loadTiles();
  assert.ok(tiles.length >= 20, 'the pinned tile set decoded');
});

// pins.json also carries the far tier's 3,500 city-wide tiles (fetch.mjs --far); the packs cover only the
// baked square, the same tileIdsForSquare() set build.mjs and assemble-city.mjs read.
test('loadTiles reads the baked square only, not every pinned tile', () => {
  const ids = tileIdsForSquare().sort();
  assert.deepEqual(tiles.map((t) => t.key).sort(), ids);
});

test('loadTiles fails closed when a cached tile drifts from its pin', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'vd-pin-drift-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const [first] = tileIdsForSquare().sort();
  for (const id of tileIdsForSquare()) await copyFile(join(CACHE, `${id}.bin`), join(dir, `${id}.bin`));
  const drifted = Buffer.from(await readFile(join(dir, `${first}.bin`)));
  drifted[drifted.length - 1] ^= 0xff;
  await writeFile(join(dir, `${first}.bin`), drifted);
  assert.throws(() => loadTiles(dir, PINS), new RegExp(`${first}.*sha256`));
});

for (const [kind, emit, decode] of EMITTERS) {
  test(`${kind}: every emitted pack roundtrips through the app loader with cell-correct frame`, async (t) => {
    const out = await mkdtemp(join(tmpdir(), `vd-${kind}-`));
    t.after(() => rm(out, { recursive: true, force: true }));
    const { entries, counts } = await emit({ out, tiles });
    assert.ok(entries.length > 100, `${kind} cells emitted`);
    assert.equal(counts.cells, entries.length);
    let records = 0;
    for (const e of entries) {
      const cell = decode(await bytes(e.file));
      const [kindName, key] = e.key.split('/');
      assert.equal(cell.key, key, `${e.key}: pack cell key matches the file name`);
      const [cx, cz] = key.split('_').map(Number);
      assert.equal(cell.cx, cx);
      assert.equal(cell.cz, cz);
      assert.equal(cell.positionFrame.x, cx * 128 + 64);
      assert.equal(cell.positionFrame.z, cz * 128 + 64);
      records += ({
        colliders: (c) => c.prisms.length + c.roads.length + c.furniture.length,
        pednet: (c) => c.edges.length + c.nodes.length + c.xwalks.length,
        traffic: (c) => c.lanes.length + c.nodes.length + c.connectors.length,
        spawns: (c) => c.entries.length + c.anchors.length,
        labels: (c) => c.labels.length,
      })[kindName](cell);
    }
    assert.ok(records > 500, `${kind}: ${records} decoded records`);
  });
}

test('emitters are deterministic: two runs write byte-identical packs', async (t) => {
  const a = await mkdtemp(join(tmpdir(), 'vd-det-a-'));
  const b = await mkdtemp(join(tmpdir(), 'vd-det-b-'));
  t.after(() => Promise.all([rm(a, { recursive: true, force: true }), rm(b, { recursive: true, force: true })]));
  for (const [, emit] of EMITTERS) {
    const ra = await emit({ out: a, tiles });
    const rb = await emit({ out: b, tiles });
    assert.deepEqual(ra.entries.map((e) => e.key), rb.entries.map((e) => e.key));
    for (let i = 0; i < ra.entries.length; i++) {
      const [ba, bb] = await Promise.all([bytes(ra.entries[i].file), bytes(rb.entries[i].file)]);
      assert.equal(sha(ba), sha(bb), `${ra.entries[i].key} byte-identical`);
    }
  }
});

test('manifest entries pin file bytes: sha256 and byteLength match what was written', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'vd-pins-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  for (const [, emit] of EMITTERS) {
    const { entries } = await emit({ out, tiles });
    for (const e of entries) {
      const buf = await readFile(e.file);
      // the same record write-cells-manifest.mjs emits: path, sha256, bytes
      const pin = { path: `${e.key}.bin`, sha256: sha(buf), bytes: buf.length };
      assert.equal(pin.sha256.length, 64);
      assert.ok(pin.bytes > 30, `${e.key} is a real pack`);
    }
  }
});

test('the encounter atlas parses as JSON: every entry carries a Manhattan tier and habitats', () => {
  const profiles = loadEncounterProfiles();
  const ids = Object.keys(profiles);
  assert.ok(ids.length >= 15, `${ids.length} bloodline profiles`);
  for (const id of ids) {
    assert.match(id, /^F\d+$/);
    assert.ok(profiles[id].tierByBorough?.Manhattan, `${id} Manhattan tier`);
    assert.ok(Array.isArray(profiles[id].habitats), `${id} habitats`);
  }
});
