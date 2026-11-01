// The cell-source-backed near package: prefetch brings verified bytes in and ready() gates the build; a cell the
// source cannot produce stays unbuilt so the far shell keeps drawing.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configureVdCellSource } from '../../cell-source/index.ts';
import { createMemoryStore } from '../../cell-source/store.ts';
import type { CellIo } from '../../cell-source/types.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { sourceNearPackage } from './on-demand.ts';
import type { NearCellInfo } from './codec.ts';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const disk = (level: string, key: string) => new Uint8Array(readFileSync(new URL(`./data/${level}/${key}.bin`, import.meta.url)));

const ioOf = (fail = false): CellIo => ({
  fetchBytes: async (url: string) => {
    if (fail) throw new Error('host down');
    const m = url.match(/(near|lite|structures)\/(.+)\.bin$/)!;
    return disk(m[1]!, m[2]!);
  },
  sha256Hex: async (b: Uint8Array) => sha(b),
  now: () => Date.now(),
});

const info = (VD_BLOCKS.near as readonly NearCellInfo[])[0]!;

describe('sourceNearPackage', () => {
  it('stays unready until prefetch lands the bytes, then decodes', async () => {
    configureVdCellSource({ baseUrl: 'https://cells.example', io: ioOf(), store: createMemoryStore() });
    const pkg = sourceNearPackage(info, 'near');
    assert.equal(pkg.ready?.(), false);
    pkg.prefetch?.();
    for (let i = 0; i < 50 && !pkg.ready?.(); i++) await new Promise((r) => setTimeout(r, 2));
    assert.equal(pkg.ready?.(), true);
    assert.equal(pkg.attributes.position!.array.length, info.vertices * 3);
    assert.equal(pkg.index?.length, info.triangles * 3);
    pkg.release?.();
  });

  it('serves a home cell from the bundled loader without touching the network', async () => {
    configureVdCellSource({ baseUrl: 'https://cells.example', io: ioOf(true), store: createMemoryStore() });
    const pkg = sourceNearPackage(info, 'near', async () => disk('near', info.key).buffer as ArrayBuffer);
    pkg.prefetch?.();
    for (let i = 0; i < 50 && !pkg.ready?.(); i++) await new Promise((r) => setTimeout(r, 2));
    assert.equal(pkg.ready?.(), true);
    pkg.release?.();
  });

  it('a cell no source can produce stays unready (fail soft, far shell keeps drawing)', async () => {
    configureVdCellSource({ baseUrl: 'https://cells.example', io: ioOf(true), store: createMemoryStore() });
    const pkg = sourceNearPackage(info, 'near', async () => { throw new Error('no bundled copy'); });
    pkg.prefetch?.();
    for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 2));
    assert.equal(pkg.ready?.(), false);
  });
});
