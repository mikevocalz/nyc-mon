// N1–N4 decoder tests — tooling only, run with `node --test tooling/city/valdrada/`.
// Operates on the real pinned tile bytes in tooling/city/.cache/valdrada/ (run
// tooling/city/valdrada/fetch.mjs first) plus pins.json's integrity record.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  BF, BUILDING_OVERRIDES, LANDMARKS, TILE,
  buildingsOf, decodeTile, furnitureOf, holesOf, parseTile, project, roadsOf,
  tileIdsForSquare, toScene, toSceneNaive, unproject,
} from './decode.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '..', '.cache', 'valdrada');
const pins = JSON.parse(readFileSync(join(HERE, 'pins.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(CACHE, 'manifest.json'), 'utf8'));
const IDS = tileIdsForSquare(); // the fetched set — 20 tiles for the 850 m square +40 m margin

const tileBuf = (id) => {
  const b = readFileSync(join(CACHE, `${id}.bin`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

const inPoly = (ring, [px, pz]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const buildingAt = (tile, lon, lat) => {
  const [x, z] = toScene(...project(lon, lat));
  return tile.buildings.find((b) => inPoly(b.ring, [x, z]));
};

// ---- N1: decode round-trip; bad magic / unknown section rejected ----------------
test('N1: every cached tile decodes, counts match the manifest, decode is deterministic', () => {
  assert.equal(IDS.length, 20, 'the 850 m square +40 m margin is 20 near tiles');
  const RECORD = { bldg: 44, bholes: 12, roads: 24, furn: 20 };
  for (const id of IDS) {
    const buf = tileBuf(id);
    const { header, S } = parseTile(buf);
    assert.equal(header.v, 1, id);
    assert.equal(`t_${header.tx}_${header.tz}`, id, id);
    for (const [name, size] of Object.entries(RECORD)) {
      assert.equal(S[name].byteLength % size, 0, `${id} ${name} is not a whole number of records`);
    }
    const declared = manifest.tiles[id.slice(2)]; // manifest keys are x_z, files t_x_z.bin
    assert.ok(declared, `${id} missing from manifest`);
    assert.equal(S.bldg.byteLength / 44, declared.b, `${id} building count`);
    assert.equal(S.roads.byteLength / 24, declared.r, `${id} road count`);
    assert.equal(S.furn.byteLength / 20, declared.fu, `${id} furniture count`);
    assert.equal(S.bholes.byteLength / 12, declared.h ?? 0, `${id} hole count`);
    // decode twice — identical output (the overrides are pure functions of the bytes)
    assert.deepEqual(decodeTile(buf).buildings, decodeTile(buf).buildings, `${id} decode is not deterministic`);
    // sanity on decoded records
    const t = decodeTile(buf);
    for (const b of t.buildings) {
      assert.ok(b.ring.length >= 3 && b.ring.length === b.len, `${id}#${b.i} ring`);
      assert.ok(b.height > 0 && b.area > 0, `${id}#${b.i} height/area`);
    }
    for (const r of t.roads) assert.ok(r.pts.length === r.len && r.pts.length >= 2, `${id} road pts`);
  }
});

test('N1: bad magic, truncated header and unknown section type are rejected', () => {
  const buf = tileBuf(IDS[0]);
  const bad = new Uint8Array(buf.slice(0));
  bad[0] = 0x99;
  assert.throws(() => parseTile(bad.buffer), /bad tile magic/);
  assert.throws(() => parseTile(buf.slice(0, 16)), /|/); // RangeError on the short DataView — still a hard failure
  // synthetic tile: valid magic, one section of an unknown type
  const h = JSON.stringify({ v: 1, tx: 0, tz: 0, origin: [0, 0], names: [], sections: [{ name: 'x', type: 'BigInt64Array', offset: 0, bytes: 0, length: 0 }] });
  const hb = new TextEncoder().encode(h);
  const fake = new ArrayBuffer(8 + hb.length);
  const dv = new DataView(fake);
  dv.setUint32(0, 0x43544c31, true); dv.setUint32(4, hb.length, true);
  new Uint8Array(fake, 8).set(hb);
  assert.throws(() => parseTile(fake), /unknown section type/);
});

// ---- N2: BUILDING_OVERRIDES land ids 8/9/10 on the landmarkSpec footprints ------
test('N2: AR32C overrides put landmarks 8/9/10 on the right footprints (tile t_3_-6)', () => {
  const t = decodeTile(tileBuf('t_3_-6'));
  // Apollo: the compiled tile already carries −8 on its footprint; the AR32C override clears
  // STOREFRONT on the lobby footprint (landmarkSpec.js L227 — no id field).
  const apollo = LANDMARKS.find((l) => l.id === 8);
  const apolloB = buildingAt(t, apollo.lon, apollo.lat);
  assert.ok(apolloB, 'no footprint under the Apollo spec point');
  assert.equal(Math.abs(apolloB.landmarkId), 8);
  assert.equal(apolloB.flags & BF.STOREFRONT, 0, 'AR32C did not clear the lobby STOREFRONT');
  const lobby = BUILDING_OVERRIDES.find((o) => o.key === 'ar32cApollo');
  assert.equal(buildingAt(t, lobby.lon, lobby.lat).i, apolloB.i, 'lobby point on a different footprint');
  // Theresa + State Office: the COMPILED tile has the ids on the wrong footprints; the AR32C
  // override points (the corrected footprints' centroids) must carry −9 / −10.
  const theresa = buildingAt(t, ...(() => { const o = BUILDING_OVERRIDES.find((x) => x.key === 'ar32cTheresa'); return [o.lon, o.lat]; })());
  assert.equal(theresa.landmarkId, -9);
  assert.equal(theresa.height > 45 && theresa.floors >= 12, true, 'Theresa carrier is the 13-storey footprint');
  const acp = buildingAt(t, ...(() => { const o = BUILDING_OVERRIDES.find((x) => x.key === 'ar32cStateOffice'); return [o.lon, o.lat]; })());
  assert.equal(acp.landmarkId, -10);
  assert.ok(acp.height > 80 && acp.floors >= 19, 'State Office carrier is the 19-storey tower');
  // the displaced spec points land on buildings the overrides cleared to 0
  const spec9 = buildingAt(t, LANDMARKS.find((l) => l.id === 9).lon, LANDMARKS.find((l) => l.id === 9).lat);
  const spec10 = buildingAt(t, LANDMARKS.find((l) => l.id === 10).lon, LANDMARKS.find((l) => l.id === 10).lat);
  assert.ok(spec9 == null || spec9.landmarkId === 0, `spec-9 point still carries ${spec9?.landmarkId}`);
  assert.ok(spec10 == null || spec10.landmarkId === 0, `spec-10 point still carries ${spec10?.landmarkId}`);
  // each id appears on exactly one footprint
  for (const id of [8, 9, 10]) {
    assert.equal(t.buildings.filter((b) => Math.abs(b.landmarkId) === id).length, 1, `landmark ${id} not unique`);
  }
});

// ---- N3: reprojection -----------------------------------------------------------
test('N3: Valdrada->scene reprojection hits the landmark projections within 0.1 m', () => {
  // Expected scene metres for the spec points, computed with transform.ts's formula:
  //   x = dLon * (pi/180) * 6371008.8 * cos(40.81005deg); z = -dLat * (pi/180) * 6371008.8
  const expected = {
    8: [-23.5652, -2.2239], // Apollo      (40.81007, -73.95003)
    9: [54.7049, 94.5158],  // Theresa     (40.80920, -73.94910)
    10: [122.0340, 61.1573], // State Office (40.80950, -73.94830)
  };
  for (const l of LANDMARKS.filter((x) => expected[x.id])) {
    const [sx, sz] = toScene(...project(l.lon, l.lat));
    const [ex, ez] = expected[l.id];
    assert.ok(Math.hypot(sx - ex, sz - ez) <= 0.1, `landmark ${l.id}: ${sx},${sz} vs ${ex},${ez}`);
  }
  // unproject is the exact inverse of project
  const [rx, rz] = project(-73.9, 40.7);
  const [rlon, rlat] = unproject(rx, rz);
  assert.ok(Math.abs(rlon + 73.9) < 1e-12 && Math.abs(rlat - 40.7) < 1e-12);
});

test('N3: a naive offset-and-scale reprojection is wrong by >0.5 m inside the square', () => {
  // Invert the rounded scene coords back to Valdrada world metres, then compare the real
  // transform (unproject -> projectToScene) with the wrong "metres are metres" translation.
  const sceneToWorld = (sx, sz) => {
    const lon = sx / (Math.PI / 180 * 6_371_008.8 * Math.cos(40.81005 * Math.PI / 180)) + -73.94975;
    const lat = 40.81005 - sz / (Math.PI / 180 * 6_371_008.8);
    return project(lon, lat);
  };
  let worst = 0, where = '';
  for (const id of IDS) {
    const t = decodeTile(tileBuf(id));
    for (const b of t.buildings) {
      for (const [sx, sz] of b.ring) {
        const [wx, wz] = sceneToWorld(sx, sz);
        const [cx, cz] = toScene(wx, wz);
        const [nx, nz] = toSceneNaive(wx, wz);
        const err = Math.hypot(nx - cx, nz - cz);
        if (err > worst) { worst = err; where = `${id}#${b.i} ${wx.toFixed(0)},${wz.toFixed(0)}`; }
      }
    }
  }
  assert.ok(worst > 0.5, `naive transform max error ${worst.toFixed(2)} m at ${where} should exceed 0.5 m`);
});

// ---- N4: pin integrity -----------------------------------------------------------
test('N4: cached bytes match the recorded SHA-256 pins; tampering fails', () => {
  assert.equal(pins.tag, 'v0.4.0');
  assert.equal(pins.commit, '2724c79');
  const destOf = (rel) => {
    const name = rel.split('/').pop();
    if (rel.startsWith('Content/tiles/')) return join(CACHE, name);
    if (rel.startsWith('Content/data/')) return join(CACHE, '..', 'valdrada-public', 'data', name);
    if (rel.startsWith('Content/models/')) return join(CACHE, '..', 'valdrada-public', 'models', 'landmarks', name);
    if (rel.startsWith('Content/textures/')) return join(CACHE, '..', 'valdrada-textures', name);
    return join(CACHE, name);
  };
  for (const [rel, p] of Object.entries(pins.files)) {
    const buf = readFileSync(destOf(rel));
    assert.equal(createHash('sha256').update(buf).digest('hex'), p.sha256, `${rel} sha256`);
    assert.equal(buf.length, p.bytes, `${rel} byte size`);
    const tampered = Buffer.from(buf);
    tampered[tampered.length - 1] ^= 0xff;
    assert.notEqual(createHash('sha256').update(tampered).digest('hex'), p.sha256, `${rel} tamper not detected`);
  }
});
