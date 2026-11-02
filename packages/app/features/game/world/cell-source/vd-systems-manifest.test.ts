// The generated systems manifest pinned against the emitted bytes — the write-cells-manifest.mjs
// conventions: sha256 + byteLength per pack, `<kind>/<cx>_<cz>` keys, CellManifest shape. And the merge
// contract: VD_SYSTEM_MANIFEST spreads over VD_CELL_MANIFEST with no key collisions, and a bundled pack
// verifies through createCellSource exactly like a geometry cell.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { VD_SYSTEM_MANIFEST } from './data/vd-systems-manifest.ts';
import { VD_CELL_MANIFEST } from './data/vd-cells-manifest.ts';
import { createCellSource } from './cell-source.ts';
import { createMemoryStore } from './store.ts';
import type { CellIo } from './types.ts';

const DATA = new URL('../vd-port/systems/data/', import.meta.url);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const io = (data: Map<string, Uint8Array>): CellIo => ({
  fetchBytes: async (url: string) => {
    const name = url.slice(url.lastIndexOf('/') + 1);
    const hit = data.get(name);
    if (!hit) throw new Error(`GET ${url} -> 404`);
    return hit;
  },
  sha256Hex: async (b: Uint8Array) => sha(b),
  now: () => Date.now(),
});

describe('VD_SYSTEM_MANIFEST', () => {
  it('pins every emitted pack: sha256 and byte length match the bytes on disk', () => {
    const kinds = ['colliders', 'pednet', 'traffic', 'spawns', 'labels'];
    let checked = 0;
    for (const kind of kinds) {
      for (const f of readdirSync(new URL(`./${kind}/`, DATA)).filter((n) => n.endsWith('.bin'))) {
        const key = `${kind}/${f.slice(0, -4)}`;
        const entry = VD_SYSTEM_MANIFEST.cells[key];
        assert.ok(entry, `manifest carries ${key}`);
        const bytes = new Uint8Array(readFileSync(new URL(`./${kind}/${f}`, DATA)));
        assert.equal(entry.bytes, bytes.byteLength, `${key} byte pin`);
        assert.equal(entry.sha256, sha(bytes), `${key} sha pin`);
        assert.equal(entry.path, `${key}.bin`);
        assert.equal(entry.bundled, true);
        checked++;
      }
    }
    assert.equal(checked, Object.keys(VD_SYSTEM_MANIFEST.cells).length, 'no stray manifest entries');
    assert.ok(checked > 1500);
  });

  it('merges with the geometry manifest without key collisions and serves a bundled pack through the source', async () => {
    const merged = { version: 1, cells: { ...VD_CELL_MANIFEST.cells, ...VD_SYSTEM_MANIFEST.cells } };
    for (const k of Object.keys(VD_SYSTEM_MANIFEST.cells)) assert.ok(!(k in VD_CELL_MANIFEST.cells), `${k} does not collide`);

    const anyKey = Object.keys(VD_SYSTEM_MANIFEST.cells)[0]!;
    const [kind, file] = anyKey.split('/');
    const disk = new Uint8Array(readFileSync(new URL(`./${kind}/${file}.bin`, DATA)));
    const src = createCellSource({ manifest: merged, io: io(new Map()), store: createMemoryStore() });
    await src.ready;
    const got = await src.fetch(anyKey, () => Promise.resolve(disk));
    assert.ok(got, 'the bundled copy serves offline');
    assert.equal(sha(got!), VD_SYSTEM_MANIFEST.cells[anyKey]!.sha256, 'served bytes verify against the pin');
    src.dispose();
  });

  it('a corrupt or missing system pack resolves to null instead of throwing, so the caller can skip the cell', async () => {
    const anyKey = Object.keys(VD_SYSTEM_MANIFEST.cells)[0]!;
    const [kind, file] = anyKey.split('/');
    const disk = new Uint8Array(readFileSync(new URL(`./${kind}/${file}.bin`, DATA)));
    const torn = disk.slice();
    torn[torn.length - 1]! ^= 0xff;
    const src = createCellSource({ manifest: VD_SYSTEM_MANIFEST, io: io(new Map()), store: createMemoryStore() });
    await src.ready;
    assert.equal(await src.fetch(anyKey, () => Promise.resolve(torn)), null, 'a bundled copy that fails its pin is refused');
    assert.equal(await src.fetch(anyKey, () => Promise.reject(new Error('asset missing'))), null, 'a missing bundled copy with no host is null');
    assert.equal(await src.fetch(anyKey, () => Promise.resolve(disk.slice(0, 12))), null, 'a truncated copy is refused');
    src.dispose();
  });
});
