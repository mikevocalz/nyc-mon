// Emits the per-cell pedestrian network: Valdrada's own procedural-walker spec (client/src/sim/peds.js,
// "instanced walkers on sidewalk offsets of the real street graph") cut onto the 128 m cell grid so a cell
// streams in its sidewalks, its junction crossings and its share of the PED_TARGET crowd budget.
//
// Ported rules (peds.js unless noted):
//   * walk streets: rclass <= 2 at grade (level 0), pedestrianised included (L243);
//   * the centreline is clipped back to the junction mouths before offsetting (L245, mouth + 1.5);
//   * each side gets a walk line at width/2 + 1.9 from centreline — 1.25 on narrow locals (L254-256);
//   * footfall weight: 5 pedestrianised, 4 avenues (rclass 2), 1 locals, 0.6 park paths (L249, L305);
//   * rclass-5 path runs are cut where they meet a carriageway (L262-303) and kept at >= ~6 m;
//   * crosswalks are kerb-to-kerb legs at each junction stub, centred mouth + RAMP_IN out from the node
//     (streetNYC.js XW11), reaching to the walk line each side.
//
//   pednet/<cx>_<cz>.bin, VGC1 kind 2:
//     u32 nEdges  × { u16 id | u16 nodeA u16 nodeB (strings, 0xffff) | u32 segId | u8 side kind busyDeci | u8 pad |
//                    f32 offset | u16 npts | npts × f32 x,y,z }
//     u32 nNodes  × { u16 id | f32 x z | u8 kind | u8 signal }
//     u32 nXwalks × { u16 id | u16 node (strings) | u32 segId | f32 ax az bx bz | f32 kerbHalf depth angle | u8 signal u8 pad }
//     u16 pedBudget | f32 walkWeight  (the cell's share of PED_TARGET, and the busy-weighted metres behind it)
//
//   node tooling/city/vd-port/write-pednet.mjs [--out <dir>]
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE, OUT, PACK_KINDS, PackWriter,
  PED_TARGET, buildNodeMap, cellKey, cellOfPoint, cellOfPolyline, cellSort,
  edgeBusy, isNarrowStreet, isWalkStreet, loadTiles,
  offsetPolyline, polylineLength, rampIn, trimPolyline, walkOffset, xwDepth,
} from './vd-game-cells.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const EDGE_KIND = { street: 0, narrow: 1, path: 2 };
const NODE_KIND = { junction: 0, link: 1, deadEnd: 2, boundary: 3 };

/** peds.js L262-303: rclass-5 footway runs, cut wherever a carriageway's half width (+0.4 m) reaches them. */
function streetMask(tiles) {
  const streets = [];
  for (const t of tiles) {
    for (const r of t.roads) {
      if (r.rclass > 4 || r.noTraffic || r.level > 0 || r.pts.length < 2) continue;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of r.pts) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[2]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[2]); }
      streets.push({ P: r.pts, hw: r.width / 2 + 0.4, x0: x0 - r.width / 2 - 0.4, z0: z0 - r.width / 2 - 0.4, x1: x1 + r.width / 2 + 0.4, z1: z1 + r.width / 2 + 0.4 });
    }
  }
  return (x, z) => {
    for (const st of streets) {
      if (x < st.x0 || x > st.x1 || z < st.z0 || z > st.z1) continue;
      const P = st.P;
      for (let i = 1; i < P.length; i++) {
        const ax = P[i - 1][0], az = P[i - 1][2], dx = P[i][0] - ax, dz = P[i][2] - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const ex = x - ax - dx * t, ez = z - az - dz * t;
        if (ex * ex + ez * ez < st.hw * st.hw) return true;
      }
    }
    return false;
  };
}

export function buildPedCells(tiles) {
  const { nodes, endNode, sites } = buildNodeMap(tiles);
  const onStreet = streetMask(tiles);
  const cells = new Map(); // key -> {cx,cz, edges:Map, xwalks:[], nodeIds:Set, weight}
  const cell = (cx, cz) => {
    const k = cellKey(cx, cz);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx, cz, edges: new Map(), xwalks: [], nodeIds: new Set(), weight: 0 }));
    return c;
  };

  // ---- walk edges: street sidewalk lines + footway runs ------------------------------------------
  for (const t of tiles) {
    t.roads.forEach((r, ri) => {
      if (isWalkStreet(r) && r.pts.length >= 2) {
        const trimmed = trimPolyline(r.pts, (r.mouthA || 0) + 1.5, (r.mouthB || 0) + 1.5);
        if (trimmed.length < 2) return;
        const narrow = isNarrowStreet(r);
        const off = walkOffset(r);
        const busy = edgeBusy(r);
        const kind = narrow ? EDGE_KIND.narrow : EDGE_KIND.street;
        const nodeA = endNode.get(`${t.key}:${ri}:0`)?.id;
        const nodeB = endNode.get(`${t.key}:${ri}:1`)?.id;
        for (const side of [-1, 1]) {
          // lat > 0 = left of the stored polyline (topology.ts WalkEdge 'l'), lat < 0 = right ('r')
          const pts = offsetPolyline(trimmed, 1, side * off);
          const id = `w:${t.key}:${ri}:${side < 0 ? 'r' : 'l'}`;
          const [cx, cz] = cellOfPolyline(pts);
          const c = cell(cx, cz);
          c.edges.set(id, { id, segId: r.segId, side, kind, busy, off, pts, nodeA, nodeB });
          c.weight += busy * polylineLength(pts);
        }
        return;
      }
      if (r.rclass === 5 && r.pts.length >= 2) {
        // resample ~1 m and split where the path crosses a carriageway (kerb-to-kerb logic owns crossings)
        const runs = [];
        let cur = [];
        for (let i = 1; i < r.pts.length; i++) {
          const A = r.pts[i - 1], B = r.pts[i], n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[2] - A[2])));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) {
            const t = k / n, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
            if (onStreet(p[0], p[2])) { if (cur.length >= 2) runs.push(cur); cur = []; } else cur.push(p);
          }
        }
        if (cur.length >= 2) runs.push(cur);
        runs.forEach((run, runIdx) => {
          if (run.length < 7) return; // a stub at a kerb, not a walk (peds.js L302)
          const id = `w:${t.key}:${ri}:p${runIdx}`;
          const [cx, cz] = cellOfPolyline(run);
          const c = cell(cx, cz);
          c.edges.set(id, { id, segId: r.segId, side: 0, kind: EDGE_KIND.path, busy: 0.6, off: 0, pts: run, nodeA: undefined, nodeB: undefined });
          c.weight += 0.6 * polylineLength(run);
        });
      }
    });
  }

  // ---- junction nodes + kerb-to-kerb crosswalk legs -----------------------------------------------
  for (const n of nodes.values()) {
    const [cx, cz] = cellOfPoint(n.x, n.z);
    cell(cx, cz).nodeIds.add(n.id);
  }
  // Crosswalks hang off streetNYC's NODE_R sites (its curb-ramp attach), not the merged graph node, so a
  // crossing stays at its own mouth; `node` names the graph node the walk edges reference.
  for (const site of sites) {
    const n = site.node;
    const ends = site.ends.filter((e) => {
      if (e.road.rclass > 2) return false; // streetNYC.js dresses rclass <= 2 stubs only
      const rl = polylineLength(e.road.pts);
      return !(rl < 20 && e.road.mouthA > 0 && e.road.mouthB > 0); // twin-node median link (streetNYC.js L54)
    });
    const [cx, cz] = cellOfPoint(site.x, site.z);
    const c = cell(cx, cz);
    if (ends.length < 2) continue;
    // one crosswalk per approach stub, sorted by azimuth for a stable index
    const stubs = [...ends].sort((a, b) => Math.atan2(a.dirz, a.dirx) - Math.atan2(b.dirz, b.dirx));
    stubs.forEach((e, i) => {
      if (e.road.width < 5) return;
      const r = e.road;
      const along = e.mouth + rampIn(r.rclass, r.width);
      const cxw = site.x + e.dirx * along, czw = site.z + e.dirz * along;
      const nx = -e.dirz, nz = e.dirx;
      const half = r.width / 2 + walkOffset(r);
      const angle = Math.atan2(nz, nx);
      c.xwalks.push({
        id: `x:${site.id}:${i}`,
        node: n.id,
        segId: r.segId,
        a: [cxw - nx * half, czw - nz * half],
        b: [cxw + nx * half, czw + nz * half],
        kerbHalf: r.width / 2,
        depth: xwDepth(r.rclass, r.width),
        angle,
        signal: site.signal | 0,
        roadEnd: { x: e.x, z: e.z, dirx: e.dirx, dirz: e.dirz, mouth: e.mouth },
      });
    });
  }

  // attach node positions to their cells' packs
  const nodeById = new Map([...nodes.values()].map((n) => [n.id, n]));

  // ---- per-cell budget: the cell's share of PED_TARGET by busy-weighted walk metres ------------------
  let total = 0;
  for (const c of cells.values()) total += c.weight;
  for (const c of cells.values()) c.budget = total > 0 && c.weight > 0 ? Math.max(1, Math.round((PED_TARGET * c.weight) / total)) : 0;

  return { cells, nodeById };
}

export function packPedCell(c, nodeById) {
  const w = new PackWriter(PACK_KINDS.pednet, c.cx, c.cz);
  const edges = [...c.edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  w.u32(edges.length);
  for (const e of edges) {
    w.u16(w.s(e.id));
    w.u16(w.s(e.nodeA ?? null));
    w.u16(w.s(e.nodeB ?? null));
    w.u32(e.segId >>> 0);
    w.u8(e.side < 0 ? 1 : e.side > 0 ? 2 : 0);
    w.u8(e.kind);
    w.u8(Math.round(e.busy * 10));
    w.u8(0);
    w.f32(e.off);
    w.u16(e.pts.length);
    for (const p of e.pts) { w.f32(p[0] - w.ox); w.f32(p[1]); w.f32(p[2] - w.oz); }
  }
  const nodeIds = [...c.nodeIds].sort();
  w.u32(nodeIds.length);
  for (const id of nodeIds) {
    const n = nodeById.get(id);
    w.u16(w.s(id));
    w.f32(n.x - w.ox); w.f32(n.z - w.oz);
    w.u8(NODE_KIND[n.kind] ?? 0);
    w.u8(n.signal | 0);
  }
  const xwalks = [...c.xwalks].sort((a, b) => (a.id < b.id ? -1 : 1));
  w.u32(xwalks.length);
  for (const x of xwalks) {
    w.u16(w.s(x.id));
    w.u16(w.s(x.node));
    w.u32(x.segId >>> 0);
    w.f32(x.a[0] - w.ox); w.f32(x.a[1] - w.oz);
    w.f32(x.b[0] - w.ox); w.f32(x.b[1] - w.oz);
    w.f32(x.kerbHalf); w.f32(x.depth); w.f32(x.angle);
    w.u8(x.signal); w.u8(0);
  }
  w.u16(c.budget);
  w.f32(c.weight);
  return w.finish();
}

export async function writePedCells({ out = OUT, tiles = null } = {}) {
  const all = tiles ?? loadTiles(CACHE);
  const { cells, nodeById } = buildPedCells(all);
  const dir = join(out, 'pednet');
  // A cell that no longer emits must not survive as a stale pack the manifest would still pin.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const entries = [];
  let edges = 0, xwalks = 0, nodesOut = 0;
  for (const key of [...cells.keys()].sort(cellSort)) {
    const c = cells.get(key);
    if (c.edges.size === 0 && c.xwalks.length === 0 && c.nodeIds.size === 0) continue;
    const buf = packPedCell(c, nodeById);
    await writeFile(join(dir, `${key}.bin`), buf);
    entries.push({ key: `pednet/${key}`, file: join(dir, `${key}.bin`) });
    edges += c.edges.size; xwalks += c.xwalks.length; nodesOut += c.nodeIds.size;
  }
  return { entries, counts: { cells: entries.length, edges, xwalks, nodes: nodesOut } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : OUT;
  const { counts } = await writePedCells({ out });
  console.log(`pednet: ${counts.cells} cells, ${counts.edges} walk edges, ${counts.xwalks} crosswalk legs, ${counts.nodes} junction nodes`);
}
