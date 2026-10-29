// The far tier's baked output: tools/lod/build_persistent.mjs chunks and bake-far.mjs landmarks in
// tooling/city/.cache/vd-lod16/ (run fetch.mjs --far, build_persistent.mjs and bake-far.mjs first).
// Decodes every shipped CTL1 through the same parse the runtime uses (parseTile) and checks it
// against index.json's totals and the container's own section table.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseTile } from './decode.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '.cache', 'vd-lod16');
const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));

const LEVEL_SIZE = { 4: 2048, 5: 4096, 6: 8192 };

test('every index entry decodes: sections whole, indices in range, bounds honouring', () => {
  for (const [lv, chunks] of Object.entries(index.chunks)) {
    const size = LEVEL_SIZE[lv];
    let n = 0, tris = 0, gtris = 0, bytes = 0;
    for (const [ck, e] of Object.entries(chunks)) {
      if (!e.f) continue;
      n++;
      const buf = readFileSync(join(OUT, e.f));
      const t = parseTile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const h = t.header;
      assert.equal(h.level, +lv, e.f);
      assert.equal(`${h.ci}_${h.cj}`, ck, e.f);
      assert.deepEqual(h.origin, [h.ci * size + size / 2, h.cj * size + size / 2], e.f);
      assert.equal(h.scale, 0.25, e.f);
      const S = t.S;
      const nv = S.pos.length / 3;
      assert.equal(S.col.length, nv * 4, `${e.f} col`);
      assert.equal(S.uv.length, nv * 2, `${e.f} uv`);
      assert.equal(S.bk.length, nv, `${e.f} bk`);
      assert.equal(S.ao.length, nv, `${e.f} ao`);
      let max = 0;
      for (const i of S.idx) if (i > max) max = i;
      assert.ok(max < nv, `${e.f} idx`);
      assert.equal(S.idx.length / 3, e.t, `${e.f} tris`);
      if (e.g) {
        assert.equal(S.gidx.length / 3, e.g, `${e.f} ground tris`);
        assert.equal(lv, '6', `${e.f} ground only on L6`);
        let gmax = 0;
        for (const i of S.gidx) if (i > gmax) gmax = i;
        assert.ok(gmax < S.gpos.length / 3, `${e.f} gidx`);
      }
      tris += e.t; gtris += e.g; bytes += statSync(join(OUT, e.f)).size;
    }
    assert.equal(n, index.totals[lv].chunks, `L${lv} chunk count`);
    assert.equal(tris, index.totals[lv].tris, `L${lv} triangles`);
    assert.equal(gtris, index.totals[lv].gtris, `L${lv} ground triangles`);
  }
});

test('a sample L4 chunk and an L6 chunk spot-check the vertex format', () => {
  const l4 = Object.entries(index.chunks['4']).sort((a, b) => b[1].t - a[1].t)[0];
  const t4 = parseTile(readFileSync(join(OUT, l4[1].f)).buffer);
  assert.ok(t4.S.pos instanceof Int16Array && t4.S.col instanceof Uint8Array && t4.S.uv instanceof Float32Array && t4.S.idx instanceof Uint32Array && t4.S.bk instanceof Uint32Array && t4.S.ao instanceof Uint8Array);
  const [cx, cz] = l4[0].split('_').map(Number);
  for (const v of [t4.S.pos[0], t4.S.pos[2]]) assert.ok(Math.abs(v) <= 2048 / 2 * 4 + 4, 'x/z stay inside the 2 km cell at 1/4 m');
  const l6 = Object.entries(index.chunks['6']).sort((a, b) => b[1].g - a[1].g)[0];
  if (l6[1].g) {
    const t6 = parseTile(readFileSync(join(OUT, l6[1].f)).buffer);
    assert.ok(t6.S.gpos instanceof Int16Array && t6.S.gidx instanceof Uint32Array);
    assert.ok(Math.max(...t6.S.gidx) < t6.S.gpos.length / 3);
  }
});

test('the landmark registry and its binary agree (when baked)', () => {
  const lmPath = join(OUT, 'landmarks.json');
  if (!existsSync(lmPath)) return;
  const doc = JSON.parse(readFileSync(lmPath, 'utf8'));
  const t = parseTile(readFileSync(join(OUT, doc.file)).buffer);
  assert.equal(t.header.scale, 0.125);
  assert.equal(t.header.count, doc.landmarks.length);
  for (const L of doc.landmarks) {
    if (!L.l6) continue;
    const it = L.l6;
    assert.ok((it.v0 + it.nv) * 3 <= t.S.pos.length, `${L.key} vertices`);
    assert.ok(it.i0 + it.ni <= t.S.idx.length, `${L.key} indices`);
    let max = 0;
    for (let i = it.i0; i < it.i0 + it.ni; i++) if (t.S.idx[i] > max) max = t.S.idx[i];
    assert.ok(max < it.nv, `${L.key} indices relative`);
  }
});
