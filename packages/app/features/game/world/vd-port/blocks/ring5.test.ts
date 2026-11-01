// Ring 5's port contract, as ring4.test.ts does for ring 4: the ring structure's built geometry (decoded through
// the runtime codec, as the streamer builds it) against the box of Valdrada's own output for it, plus the
// streamed-cell contract: every ring cell not marked bundled is out of the home square. Ring 5 (Midtown — Times
// Square, Grand Central, Herald Square and the Fifth Avenue corridor, ~59th to ~23rd St) holds 27 lane-A
// structures — the Midtown landmark row (the Empire State, the Chrysler, Grand Central, the Flatiron, One Times
// Square, 30 Hudson Yards, the UN) and four hpt fronts on the east shore.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeNearCell, decodeShellCell, type NearCellInfo, type ShellCellInfo } from './codec.ts';
import { CELL } from '../../cells/cell-rules.ts';
import { VD_BLOCKS_RING5 } from './data-ring5/manifest.ts';

const DATA = new URL('./data-ring5/', import.meta.url);
const shellBytes = new Uint8Array(readFileSync(new URL('shell.bin', DATA)));
const nearBytes = new Map(VD_BLOCKS_RING5.near.map((c) => [c.key, new Uint8Array(readFileSync(new URL(`near/${c.key}.bin`, DATA)))]));
const A = VD_BLOCKS_RING5.affine;
const toScene = (x: number, z: number): [number, number] => [x * A.sx + A.ox, z * A.sz + A.oz];

/** Every vertex the structure's index ranges reach, over all its cells, decoded as the streamer decodes them. */
function structureVertices(id: string): number[][] {
  const out: number[][] = [];
  for (const cell of VD_BLOCKS_RING5.near) {
    const ranges = (cell.ranges as readonly (readonly [string, number, number])[]).filter((r) => r[0] === id);
    if (!ranges.length) continue;
    const a = decodeNearCell(nearBytes.get(cell.key)!, cell.cx, cell.cz);
    for (const [, start, count] of ranges) {
      for (let i = start; i < start + count; i++) {
        const v = a.index[i]!;
        out.push([a.position[v * 3]!, a.position[v * 3 + 1]!, a.position[v * 3 + 2]!]);
      }
    }
  }
  return out;
}

test("every ring-5 structure matches the box of Valdrada's own output within 5 cm", () => {
  let worst = 0, worstId = '';
  for (const s of VD_BLOCKS_RING5.structures) {
    const vs = structureVertices(s.id);
    assert.ok(vs.length > 0, `${s.id}: no geometry`);
    const got = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of vs) { got[0] = Math.min(got[0]!, x!); got[1] = Math.min(got[1]!, y!); got[2] = Math.min(got[2]!, z!); got[3] = Math.max(got[3]!, x!); got[4] = Math.max(got[4]!, y!); got[5] = Math.max(got[5]!, z!); }
    const [x0, z0] = toScene(s.vbox[0], s.vbox[2]), [x1, z1] = toScene(s.vbox[3], s.vbox[5]);
    const dy = VD_BLOCKS_RING5.curb - s.base;
    const want = [x0, s.vbox[1] + dy, z0, x1, s.vbox[4] + dy, z1];
    for (let k = 0; k < 6; k++) {
      const d = Math.abs(got[k]! - want[k]!);
      if (d > worst) { worst = d; worstId = `${s.id}[${k}]`; }
    }
  }
  assert.ok(worst <= 0.05, `worst box edge ${worst.toFixed(3)} m at ${worstId}`);
});

test('no ring-5 structure is already in the home or rings 1-4 packs', async () => {
  const { VD_BLOCKS } = await import('./data/manifest.ts');
  const { VD_BLOCKS_RING1 } = await import('./data-ring1/manifest.ts');
  const { VD_BLOCKS_RING2 } = await import('./data-ring2/manifest.ts');
  const { VD_BLOCKS_RING3 } = await import('./data-ring3/manifest.ts');
  const { VD_BLOCKS_RING4 } = await import('./data-ring4/manifest.ts');
  const baked = new Set<string>([...VD_BLOCKS.structures, ...VD_BLOCKS_RING1.structures, ...VD_BLOCKS_RING2.structures, ...VD_BLOCKS_RING3.structures, ...VD_BLOCKS_RING4.structures].map((s) => s.id as string));
  for (const s of VD_BLOCKS_RING5.structures) assert.ok(!baked.has(s.id), `${s.id} baked twice`);
  // Midtown holds lane-A structures: 23 landmarks, 4 hpt fronts on the east shore
  assert.equal(VD_BLOCKS_RING5.structures.length, 27);
});

test('the ring-5 shell cells decode to Valdrada\'s persistent-tier triangles, at most 2000 a structure', () => {
  let tris = 0;
  for (const info of VD_BLOCKS_RING5.shell as readonly ShellCellInfo[]) {
    const a = decodeShellCell(shellBytes, info);
    assert.equal(a.position.length, info.vertices * 3);
    assert.equal(info.vertices, info.triangles * 3, 'per-face vertices');
    tris += info.triangles;
  }
  assert.equal(tris, VD_BLOCKS_RING5.totals.trisShell);
  for (const s of VD_BLOCKS_RING5.structures) assert.ok(s.trisShell <= 2000, `${s.id}: ${s.trisShell}`);
});

test('only the home-overlap cells are bundled; the rest stream through the cell source', () => {
  for (const level of ['near', 'lite'] as const) for (const c of VD_BLOCKS_RING5[level] as readonly NearCellInfo[]) {
    const overlap = c.cx * CELL < 850 && c.cx * CELL + CELL > -850 && c.cz * CELL < 850 && c.cz * CELL + CELL > -850;
    assert.equal(c.bundled !== false, overlap, `${level}/${c.key} bundled flag`);
    if (c.bundled === false) assert.ok(!(c.bounds[0]! < 850 && c.bounds[3]! > -850 && c.bounds[2]! < 850 && c.bounds[5]! > -850), `${level}/${c.key} inside the home square`);
  }
});

test('the ring-5 cells hold cell-local frames that reconstruct their absolute positions', () => {
  for (const cell of VD_BLOCKS_RING5.near) {
    const file = nearBytes.get(cell.key)!;
    const absolute = decodeNearCell(file, cell.cx, cell.cz);
    const local = decodeNearCell(file, cell.cx, cell.cz, 'cell-local');
    assert.deepEqual(local.positionFrame, { kind: 'cell-local', origin: [cell.cx * CELL + CELL / 2, 0, cell.cz * CELL + CELL / 2] });
    for (let i = 0; i < local.position.length; i++) assert.ok(Math.abs(local.position[i]! + local.positionFrame!.origin[i % 3]! - absolute.position[i]!) <= 0.05);
  }
});
