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
import { VD_MANIFEST, configureVdCellSource, vdCellSource, vdSystemFetch } from './index.ts';
import { createCellSource } from './cell-source.ts';
import { createMemoryStore } from './store.ts';
import type { CellIo } from './types.ts';
import { decodeColliderCell } from '../vd-port/systems/colliders.ts';

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

  it('the runtime default is the merged manifest: cell and system keys coexist, every pin carries sha256 + bytes', () => {
    // VD_MANIFEST is what configureVdCellSource installs when no manifest is handed in (index.ts).
    assert.equal(Object.keys(VD_MANIFEST.cells).length, Object.keys(VD_CELL_MANIFEST.cells).length + Object.keys(VD_SYSTEM_MANIFEST.cells).length);
    for (const k of Object.keys(VD_CELL_MANIFEST.cells)) assert.ok(k in VD_MANIFEST.cells, `geometry key ${k} survived the merge`);
    for (const k of Object.keys(VD_SYSTEM_MANIFEST.cells)) assert.ok(k in VD_MANIFEST.cells, `system key ${k} survived the merge`);
    // Both namespaces are present, not just counted.
    assert.ok('far/L4_-10_10.bin' in VD_MANIFEST.cells && 'colliders/-11_-2' in VD_MANIFEST.cells);
    for (const [k, e] of Object.entries(VD_MANIFEST.cells)) {
      assert.match(e.sha256, /^[0-9a-f]{64}$/, `${k} sha256 pin`);
      assert.ok(Number.isInteger(e.bytes) && e.bytes > 0, `${k} byte pin`);
      assert.ok(e.path.length > 0, `${k} host path`);
    }
  });

  it('the configured source serves a bundled system pack that decodes through the VGC1 reader', async () => {
    // The runtime path end to end: configureVdCellSource's default manifest + vdSystemFetch +
    // decodeColliderCell. A bundled `colliders` pack round-trips its pin and lands a real decode —
    // the first kind with a runtime reader (labels read in walk-street.ts; this exercises colliders).
    const key = 'colliders/-11_-2'; // 62 bytes, the smallest emitted pack
    const disk = new Uint8Array(readFileSync(new URL('./colliders/-11_-2.bin', DATA)));
    const src = configureVdCellSource({ io: io(new Map()), store: createMemoryStore() });
    assert.ok(src !== null && vdCellSource() === src, 'the shared source configured');
    const bytes = await vdSystemFetch('colliders', '-11_-2', () => Promise.resolve(disk));
    assert.ok(bytes instanceof Uint8Array, 'the bundled copy served through the merged manifest');
    const cell = decodeColliderCell(bytes as Uint8Array);
    assert.equal(`${cell.cx}_${cell.cz}`, '-11_-2');
    assert.equal(sha(bytes as Uint8Array), VD_SYSTEM_MANIFEST.cells[key]!.sha256);

    // The same key is now INSIDE the manifest: a torn bundled copy is refused by the pin instead of
    // falling through to the old unmanifested-bundled fallback (which would have served it unverified).
    const torn = disk.slice();
    torn[torn.length - 1]! ^= 0xff;
    assert.equal(await vdSystemFetch('colliders', '-11_-3', () => Promise.resolve(torn)), null, 'a torn bundled pack is refused by the pin');
    // An unmanifested key still gets the unverified bundled fallback — only manifested keys pin.
    const orphan = await vdSystemFetch('colliders', '999_999', () => Promise.resolve(new Uint8Array([1, 2, 3])));
    assert.ok(orphan instanceof Uint8Array && orphan.byteLength === 3, 'an unmanifested key serves its bundled copy unverified');
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
