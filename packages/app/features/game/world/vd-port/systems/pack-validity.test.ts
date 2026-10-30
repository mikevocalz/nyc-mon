// Whole-set invariants over the emitted Phase 4 packs (tooling/city/vd-port/write-systems-manifest.mjs run
// first): finite numbers, closed non-degenerate collider footprints, pednet and traffic graphs that stay
// connected across cell seams, spawn anchors and labels inside the cell that stores them, and decoders that
// refuse a torn pack with an Error instead of returning garbage or hanging.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CELL } from './cell-pack.ts';
import { decodeColliderCell, prismAt, type ColliderCellPackage } from './colliders.ts';
import { decodeLabelCell } from './labels.ts';
import { readSystemCells, type SystemKind } from './load-from-disk.test-support.ts';
import { decodePedCell } from './pednet.ts';
import { decodeSpawnCell } from './spawns.ts';
import { decodeTrafficCell } from './traffic.ts';

const DECODERS = {
  colliders: decodeColliderCell,
  pednet: decodePedCell,
  traffic: decodeTrafficCell,
  spawns: decodeSpawnCell,
  labels: decodeLabelCell,
} as const;

const decodeAll = <K extends SystemKind>(kind: K) =>
  [...readSystemCells(kind).values()].map((b) => DECODERS[kind](b) as ReturnType<(typeof DECODERS)[K]>);

const colliders = decodeAll('colliders');
const pednet = decodeAll('pednet');
const traffic = decodeAll('traffic');
const spawns = decodeAll('spawns');
const labels = decodeAll('labels');

const inCell = (x: number, z: number, cx: number, cz: number) =>
  x >= cx * CELL && x <= (cx + 1) * CELL && z >= cz * CELL && z <= (cz + 1) * CELL;

/** Paths of every non-finite number inside a decoded package. */
function nonFinite(v: unknown, path: string, out: string[]): string[] {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(path); }
  else if (Array.isArray(v)) v.forEach((x, i) => nonFinite(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) nonFinite(x, `${path}.${k}`, out);
  return out;
}

/** Union-find over string ids; returns component sizes, largest first. */
function components(ids: Iterable<string>, links: Iterable<readonly [string, string]>): number[] {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  for (const id of ids) parent.set(id, id);
  for (const [a, b] of links) {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  }
  const sizes = new Map<string, number>();
  for (const k of parent.keys()) sizes.set(find(k), (sizes.get(find(k)) ?? 0) + 1);
  return [...sizes.values()].sort((a, b) => b - a);
}

describe('emitted pack set', () => {
  it('is present for every kind', () => {
    for (const [kind, cells] of Object.entries({ colliders, pednet, traffic, spawns, labels })) {
      assert.ok(cells.length > 300, `${kind}: ${cells.length} cells`);
    }
  });

  it('decodes to finite numbers only', () => {
    for (const cells of [colliders, pednet, traffic, spawns, labels]) {
      for (const c of cells) assert.deepEqual(nonFinite(c, c.key, []), [], `${c.key}: NaN/Infinity`);
    }
  });
});

describe('collider footprints', () => {
  it('are non-degenerate closed rings inside their own bounds, with height', () => {
    let rings = 0;
    for (const c of colliders) {
      for (const p of c.prisms) {
        rings++;
        const r = p.ring;
        assert.ok(r.length >= 3, `${c.key} prism ${p.srcId}: ${r.length} vertices`);
        // rings are stored open (pointInRing closes them); twice the signed area must not vanish
        let area2 = 0;
        for (let i = 0; i < r.length; i++) {
          const a = r[i]!, b = r[(i + 1) % r.length]!;
          area2 += a[0] * b[1] - b[0] * a[1];
        }
        assert.ok(Math.abs(area2) > 1e-3, `${c.key} prism ${p.srcId}: zero-area footprint`);
        for (const [x, z] of r) {
          assert.ok(x >= p.minX - 1e-3 && x <= p.maxX + 1e-3 && z >= p.minZ - 1e-3 && z <= p.maxZ + 1e-3, `${c.key} prism ${p.srcId}: vertex outside bounds`);
        }
        assert.ok(p.y1 > p.y0, `${c.key} prism ${p.srcId}: y1 ${p.y1} <= y0 ${p.y0}`);
      }
    }
    assert.ok(rings > 5000, `${rings} footprints checked`);
  });
});

describe('pednet across cell seams', () => {
  const nodes = new Map(pednet.flatMap((c) => c.nodes.map((n) => [n.id, { n, cell: c }] as const)));

  it('lists each node once, in the cell that contains it', () => {
    const seen = new Set<string>();
    for (const c of pednet) {
      for (const n of c.nodes) {
        assert.ok(!seen.has(n.id), `${n.id} listed by two cells`);
        seen.add(n.id);
        assert.ok(inCell(n.x, n.z, c.cx, c.cz), `${n.id} outside ${c.key}`);
      }
    }
  });

  it('resolves every edge end and crosswalk to a node some cell lists', () => {
    let crossCell = 0;
    for (const c of pednet) {
      for (const e of c.edges) {
        for (const id of [e.nodeA, e.nodeB]) {
          if (id === undefined) continue;
          const hit = nodes.get(id);
          assert.ok(hit, `${c.key} ${e.id}: dangling node ${id}`);
          if (hit.cell !== c) crossCell++;
        }
      }
      for (const x of c.xwalks) assert.ok(nodes.has(x.node), `${c.key} ${x.id}: dangling node ${x.node}`);
    }
    assert.ok(crossCell > 500, `${crossCell} edge ends resolve in a neighbouring cell`);
  });

  it('forms one walk network over the junction-attached edges', () => {
    const links = pednet.flatMap((c) => c.edges.filter((e) => e.nodeA && e.nodeB).map((e) => [e.nodeA!, e.nodeB!] as const));
    const attached = new Set(links.flat());
    const sizes = components(attached, links);
    assert.equal(sizes.length, 1, `walk graph splits into ${sizes.length} components (largest ${sizes[0]})`);
  });

  it('gives no crowd budget to a cell with no walk edges', () => {
    for (const c of pednet) if (c.edges.length === 0) assert.equal(c.pedBudget, 0, `${c.key}: budget ${c.pedBudget} with no edges`);
  });
});

describe('traffic across cell seams', () => {
  const nodes = new Map(traffic.flatMap((c) => c.nodes.map((n) => [n.id, n] as const)));
  const lanes = new Map(traffic.flatMap((c) => c.lanes.map((l) => [l.id, l] as const)));

  it('resolves every lane end and connector to nodes and lanes that exist', () => {
    for (const c of traffic) {
      for (const l of c.lanes) for (const id of [l.from, l.to]) if (id) assert.ok(nodes.has(id), `${l.id}: dangling node ${id}`);
      for (const x of c.connectors) {
        assert.ok(lanes.has(x.in) && lanes.has(x.out), `${c.key}: connector ${x.in} -> ${x.out} names a missing lane`);
        assert.ok(nodes.has(x.node), `${c.key}: connector at missing node ${x.node}`);
        assert.equal(lanes.get(x.in)!.to, x.node, `${x.in} does not end at ${x.node}`);
        assert.equal(lanes.get(x.out)!.from, x.node, `${x.out} does not start at ${x.node}`);
      }
    }
  });

  it('flags boundary lanes from their node kinds and keeps junction-interior lanes off the connectors', () => {
    let boundary = 0;
    const used = new Set(traffic.flatMap((c) => c.connectors.flatMap((x) => [x.in, x.out])));
    for (const l of lanes.values()) {
      const atEdge = [l.from, l.to].some((id) => id !== undefined && nodes.get(id)?.kind === 'boundary');
      assert.equal(l.boundary, atEdge, `${l.id}: boundary flag ${l.boundary}, node kinds say ${atEdge}`);
      if (l.boundary) boundary++;
      assert.equal(l.internal, l.from !== undefined && l.from === l.to, `${l.id}: internal flag`);
      if (l.internal) assert.ok(!used.has(l.id), `${l.id}: internal lane on a connector`);
    }
    assert.ok(boundary > 50, `${boundary} lanes enter or leave at the square's edge`);
  });

  it('routes every lane that touches a real junction through one network', () => {
    const routable = [...lanes.values()].filter((l) => !l.internal && !(l.from && l.to && nodes.get(l.from)!.kind === 'boundary' && nodes.get(l.to)!.kind === 'boundary'));
    const links = traffic.flatMap((c) => c.connectors.map((x) => [x.in, x.out] as const));
    const sizes = components(routable.map((l) => l.id), links);
    assert.equal(sizes.length, 1, `lane graph splits into ${sizes.length} components (largest ${sizes[0]} of ${routable.length})`);
  });
});

describe('spawns', () => {
  const byKey = new Map<string, ColliderCellPackage>(colliders.map((c) => [c.key, c]));

  it('anchors every spawn inside the cell that stores it', () => {
    for (const c of spawns) for (const a of c.anchors) assert.ok(inCell(a.x, a.z, c.cx, c.cz), `${c.key} ${a.habitat} anchor (${a.x}, ${a.z}) outside the cell`);
  });

  it('stands rooftop anchors on a roof and keeps ground anchors out of buildings', () => {
    let roofs = 0, onRoof = 0, ground = 0, inside = 0;
    for (const c of spawns) {
      const col = byKey.get(c.key);
      for (const a of c.anchors) {
        const hit = col ? prismAt(col, a.x, a.z) : null;
        if (a.habitat === 'rooftop') { roofs++; if (hit) onRoof++; }
        else if (a.habitat !== 'community_hub') { ground++; if (hit) inside++; }
      }
    }
    // a roof anchor off every prism is a footprint hole or a part the colliders split; a ground anchor in a
    // prism is a sidewalk band under an overhang. Both stay rare.
    assert.ok(onRoof / roofs > 0.97, `${onRoof}/${roofs} rooftop anchors on a footprint`);
    assert.ok(inside / ground < 0.01, `${inside}/${ground} ground anchors inside a building`);
  });
});

describe('labels', () => {
  it('sit inside the cell that stores them', () => {
    for (const c of labels) for (const l of c.labels) assert.ok(inCell(l.x, l.z, c.cx, c.cz), `${c.key} '${l.name}' at (${l.x}, ${l.z}) outside the cell`);
  });
});

describe('torn packs', () => {
  /** Small deterministic PRNG (mulberry32) so a failure reproduces. */
  const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (const kind of Object.keys(DECODERS) as SystemKind[]) {
    it(`${kind}: every truncation throws an Error and random byte damage never escapes as a non-Error`, () => {
      const decode = DECODERS[kind] as (b: Uint8Array) => unknown;
      const samples = [...readSystemCells(kind).values()].sort((a, b) => b.byteLength - a.byteLength).slice(0, 3);
      const rand = rng(kind.length * 7919);
      for (const good of samples) {
        for (let n = 0; n < good.byteLength; n += Math.max(1, Math.floor(good.byteLength / 400))) {
          assert.throws(() => decode(good.subarray(0, n)), Error, `${kind}: a ${n}/${good.byteLength}-byte prefix decoded`);
        }
        for (let trial = 0; trial < 200; trial++) {
          const bad = good.slice();
          for (let k = 0; k < 4; k++) bad[Math.floor(rand() * bad.length)] = Math.floor(rand() * 256);
          const t0 = Date.now();
          try {
            decode(bad);
          } catch (err) {
            assert.ok(err instanceof Error, `${kind}: threw a non-Error ${String(err)}`);
          }
          assert.ok(Date.now() - t0 < 250, `${kind}: a damaged pack took ${Date.now() - t0} ms`);
        }
      }
    });
  }
});
