// The five Phase 4 cell packs decoded from the emitted files: roundtrip integrity, per-cell bounds, and
// the cross-cell invariants the rings rely on. Runs against packages/.../systems/data (the emitters' real
// output — tooling/city/vd-port/write-systems-manifest.mjs).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CELL } from './cell-pack.ts';
import { decodeColliderCell, pointInRing, prismAt } from './colliders.ts';
import { decodeLabelCell } from './labels.ts';
import { decodePedCell } from './pednet.ts';
import { decodeSpawnCell } from './spawns.ts';
import { decodeTrafficCell } from './traffic.ts';
import { readSystemCells } from './load-from-disk.test-support.ts';

const centroid = (pts: readonly (readonly number[])[]): [number, number] => {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]!; z += p[2]!; }
  return [x / pts.length, z / pts.length];
};
/** Loose cell membership: a record's representative point lies in or beside the pack's cell. */
const nearCell = (x: number, z: number, cx: number, cz: number, slack = CELL) =>
  x >= cx * CELL - slack && x < (cx + 1) * CELL + slack && z >= cz * CELL - slack && z < (cz + 1) * CELL + slack;

describe('colliders cells', () => {
  const cells = [...readSystemCells('colliders')].map(([k, b]) => decodeColliderCell(b));
  it('decodes every emitted pack, prisms extruded and registered in the cells their bounds touch', () => {
    assert.ok(cells.length > 300);
    for (const c of cells) {
      assert.ok(c.prisms.length + c.roads.length + c.furniture.length > 0);
      for (const p of c.prisms) {
        assert.ok(p.y1 > p.y0, 'a prism extrudes upward');
        assert.ok(p.ring.length >= 3);
        // bounds registration: the prism's AABB overlaps this cell's square
        assert.ok(p.maxX >= c.cx * CELL && p.minX < (c.cx + 1) * CELL && p.maxZ >= c.cz * CELL && p.minZ < (c.cz + 1) * CELL);
      }
      for (const r of c.roads) assert.ok(r.points.length >= 2 && r.widthMeters > 0);
    }
  });
  it('point queries honour ring and hole semantics', () => {
    const square = { srcId: 1, ring: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], holes: [[[4, 4], [6, 4], [6, 6], [4, 6]]] as [number, number][][], y0: 0, y1: 5, style: 0, landmarkId: 0, flags: 0, minX: 0, minZ: 0, maxX: 10, maxZ: 10 };
    assert.ok(pointInRing(5, 2, square.ring));
    const cell = { cx: 0, cz: 0, key: '0_0', positionFrame: { x: 64, z: 64 }, prisms: [square], roads: [], furniture: [] };
    assert.equal(prismAt(cell, 5, 2), square, 'inside the footprint');
    assert.equal(prismAt(cell, 5, 5), null, 'a courtyard hole is open ground');
    assert.equal(prismAt(cell, 20, 5), null);
  });
});

describe('pednet cells', () => {
  const cells = [...readSystemCells('pednet')].map(([k, b]) => decodePedCell(b));
  it('decodes walk edges inside their cells, with budgets and junction metadata', () => {
    assert.ok(cells.length > 300);
    let edges = 0, xwalks = 0, budget = 0;
    for (const c of cells) {
      budget += c.pedBudget;
      for (const e of c.edges) {
        edges++;
        const [x, z] = centroid(e.points);
        assert.ok(nearCell(x, z, c.cx, c.cz), `edge ${e.id} centroid near cell ${c.key}`);
        assert.ok(e.busy > 0 && e.points.length >= 2);
        if (e.kind !== 'path') assert.ok(e.nodeA || e.nodeB, 'street bands know their end nodes');
      }
      for (const x of c.xwalks) {
        xwalks++;
        assert.ok(x.lengthMeters >= x.kerbHalfMeters * 2, 'the leg reaches past the kerbs');
        assert.ok(Math.abs(x.depthMeters - 4.57) < 0.01 || Math.abs(x.depthMeters - 7.62) < 0.01, 'XW_DEPTH values');
        assert.ok(nearCell(x.a[0], x.a[1], c.cx, c.cz, CELL * 1.5));
      }
      for (const n of c.nodes) assert.ok(nearCell(n.x, n.z, c.cx, c.cz), `node ${n.id} in its cell`);
    }
    assert.ok(edges > 1500 && xwalks > 500 && budget >= 400, `totals: ${edges} edges, ${xwalks} xwalks, budget ${budget}`);
  });
});

describe('traffic cells', () => {
  const cells = [...readSystemCells('traffic')].map(([k, b]) => decodeTrafficCell(b));
  it('decodes lane edges inside their cells with Valdrada lane geometry', () => {
    assert.ok(cells.length > 300);
    const laneIds = new Set<string>();
    const nodeIds = new Set<string>();
    for (const c of cells) {
      for (const l of c.lanes) {
        laneIds.add(l.id);
        const [x, z] = centroid(l.points);
        assert.ok(nearCell(x, z, c.cx, c.cz), `lane ${l.id} centroid near cell ${c.key}`);
        assert.ok(l.laneWidthMeters <= 3.4 + 1e-6 && l.speedMps >= 6);
        assert.ok(l.laneIndex < l.laneCount);
        assert.ok(Math.abs(l.lateral) <= l.widthMeters / 2 + 1e-3, 'the lane rides inside the carriageway');
      }
      for (const n of c.nodes) {
        nodeIds.add(n.id);
        assert.ok(nearCell(n.x, n.z, c.cx, c.cz));
      }
    }
  });
  it('every connector joins real lanes at a node that exists', () => {
    const laneIds = new Set<string>(), nodeIds = new Set<string>();
    const conns: { in: string; out: string; node: string; turn: string }[] = [];
    for (const c of cells) {
      for (const l of c.lanes) laneIds.add(l.id);
      for (const n of c.nodes) nodeIds.add(n.id);
      conns.push(...c.connectors);
    }
    assert.ok(conns.length > 2000);
    for (const cn of conns) {
      assert.ok(laneIds.has(cn.in), `conn in-lane ${cn.in}`);
      assert.ok(laneIds.has(cn.out), `conn out-lane ${cn.out}`);
      assert.ok(nodeIds.has(cn.node), `conn node ${cn.node}`);
      assert.notEqual(cn.in, cn.out);
    }
    // lane endpoint node ids resolve too (they may live in a neighbouring cell's pack)
    let dangling = 0;
    for (const c of cells) for (const l of c.lanes) {
      for (const id of [l.from, l.to]) if (id && !nodeIds.has(id)) dangling++;
    }
    assert.equal(dangling, 0);
  });
});

describe('spawn cells', () => {
  const cells = [...readSystemCells('spawns')].map(([k, b]) => decodeSpawnCell(b));
  it('decodes the spawn table: atlas habitats only, weights per mille', () => {
    assert.ok(cells.length > 300);
    for (const c of cells) {
      assert.ok(c.habitats.length > 0);
      let sum = 0;
      for (const e of c.entries) {
        assert.match(e.bloodlineId, /^F\d+$/);
        assert.ok(e.weightPermille > 0);
        for (const h of e.habitats) assert.ok(c.habitats.includes(h), `entry habitat ${h} present in cell`);
        sum += e.weightPermille;
      }
      if (c.entries.length) assert.ok(sum >= 900 && sum <= 1010, `weights near 1000, got ${sum}`);
      for (const a of c.anchors) assert.ok(nearCell(a.x, a.z, c.cx, c.cz), 'an anchor sits in or beside its cell');
    }
  });
});

describe('label cells', () => {
  const cells = [...readSystemCells('labels')].map(([k, b]) => decodeLabelCell(b));
  it('decodes verbatim street names anchored near their cells', () => {
    assert.ok(cells.length > 300);
    let n = 0;
    for (const c of cells) {
      for (const l of c.labels) {
        n++;
        assert.ok(l.name.length > 0 && l.name === l.name.trim(), 'no invented or padded names');
        assert.ok(nearCell(l.x, l.z, c.cx, c.cz, CELL), `label ${l.name} near cell ${c.key}`);
        assert.ok(l.lengthMeters > 0);
      }
    }
    assert.ok(n > 2000);
  });
});
