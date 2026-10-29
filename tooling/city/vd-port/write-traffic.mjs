// Emits the per-cell traffic graph: lane-level edges out of Valdrada's street records, cut onto the 128 m
// cell grid in the same shape living-city's LaneEdge/TopologyNode/LaneConnector use (topology.ts), so a
// cell streams in the lanes a vehicle-sim-style follower needs plus the junction connectors across them.
//
// Ported rules (client/src/sim/traffic.js unless noted):
//   * carriageways: rclass <= 4 minus pedestrianised streets (L670 `rclass >= 5 || noTraffic` skip);
//   * lanes per direction: all lanes on a one-way piece, floor(lanes/2) each way on two-way (min 1);
//   * lane lateral: _laneOffsetAt — lanes share `max(3, width - parking - 0.6)` at <= 3.4 m each, lane 0 on
//     the right kerb; a single-side parking piece shifts the driving band 1.15 m (segId parity side);
//   * speed: mph verbatim plus the sim's m/s (max(6, mph*0.44704), L956);
//   * connectors: every lane ending at a node to every lane leaving it, angle-split like topology.ts
//     (through <= 35 deg, uturn > 145 deg, and a negative turn is a LEFT on the left-handed map) — a lane
//     may only reverse onto its own piece at a dead end.
//
//   traffic/<cx>_<cz>.bin, VGC1 kind 3:
//     u32 nLanes × { u16 id | u16 from to (node strings, 0xffff) | u32 segId | u16 nameIdx |
//                    u8 dir rclass | i8 oneway | u8 laneIndex laneCount speedMph park flags |
//                    f32 lateral laneWidth width mouthA mouthB | u16 npts | npts × f32 x,y,z }
//     u32 nNodes × { u16 id | f32 x z | u8 kind | u8 signal }
//       flags: bit 0 boundary (an end on the square's edge), bit 1 internal (both ends on one junction:
//       a junction-box interior piece, topology.ts `internal`; no connectors touch it)
//     u32 nConns × { u16 in out node (strings) | u8 turn | u8 pad }  (homed in the in-lane's cell)
//     u16 carBudget | f32 laneWeight  (the cell's share of CAR_TARGET by lane metres)
//
//   node tooling/city/vd-port/write-traffic.mjs [--out <dir>]
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE, OUT, PACK_KINDS, PackWriter,
  CAR_TARGET, buildNodeMap, cellKey, cellOfPolyline, cellSort,
  laneLateral, lanesInDir, loadTiles, offsetPolyline, polylineLength,
} from './vd-game-cells.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const NODE_KIND = { junction: 0, link: 1, deadEnd: 2, boundary: 3 };
const TURN = { through: 0, left: 1, right: 2, uturn: 3 };
const THROUGH_RADIANS = (35 * Math.PI) / 180;
const UTURN_RADIANS = (145 * Math.PI) / 180;

const isCarRoad = (r) => r.rclass <= 4 && !r.noTraffic && r.pts.length >= 2;

/** First/last segment unit direction of a polyline in its stored direction. */
const firstDir = (pts) => {
  const dx = pts[1][0] - pts[0][0], dz = pts[1][2] - pts[0][2], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
};
const lastDir = (pts) => {
  const n = pts.length;
  const dx = pts[n - 1][0] - pts[n - 2][0], dz = pts[n - 1][2] - pts[n - 2][2], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
};

export function buildTrafficCells(tiles) {
  const { nodes, endNode } = buildNodeMap(tiles);
  const cells = new Map(); // key -> {cx,cz, lanes:Map, nodeIds:Set, conns:[], weight}
  const cell = (cx, cz) => {
    const k = cellKey(cx, cz);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx, cz, lanes: new Map(), nodeIds: new Set(), conns: [], weight: 0 }));
    return c;
  };

  // ---- lane edges ----------------------------------------------------------------------------------
  const lanes = []; // global, for the connector pass
  for (const t of tiles) {
    t.roads.forEach((r, ri) => {
      if (!isCarRoad(r)) return;
      const piece = `${t.key}:${ri}`;
      const nodeA = endNode.get(`${t.key}:${ri}:0`) ?? null;
      const nodeB = endNode.get(`${t.key}:${ri}:1`) ?? null;
      const count = lanesInDir(r);
      for (const dir of [1, -1]) {
        if ((dir === 1 && r.oneway === -1) || (dir === -1 && r.oneway === 1)) continue;
        for (let i = 0; i < count; i++) {
          const { lateral, laneW } = laneLateral(r, dir, i, count);
          const pts = offsetPolyline(r.pts, dir, lateral);
          const id = `l:${piece}:${dir > 0 ? 'f' : 'b'}:${i}`;
          const from = dir > 0 ? nodeA : nodeB;
          const to = dir > 0 ? nodeB : nodeA;
          const lane = {
            id, segId: r.segId, name: r.name || null, road: r, dir,
            laneIndex: i, laneCount: count, oneway: r.oneway,
            rclass: r.rclass, speedMph: r.speed, speedMps: Math.max(6, (r.speed || 25) * 0.44704),
            lateral, laneWidth: laneW, widthMeters: r.width, park: r.park,
            mouthFrom: dir > 0 ? r.mouthA : r.mouthB, mouthTo: dir > 0 ? r.mouthB : r.mouthA,
            pts, fromId: from?.id, toId: to?.id,
            boundary: (from?.kind ?? 'boundary') === 'boundary' || (to?.kind ?? 'boundary') === 'boundary',
            internal: !!from && from === to,
          };
          lanes.push(lane);
          const [cx, cz] = cellOfPolyline(pts);
          const c = cell(cx, cz);
          c.lanes.set(id, lane);
          c.weight += polylineLength(pts);
          if (from) c.nodeIds.add(from.id);
          if (to) c.nodeIds.add(to.id);
        }
      }
    });
  }

  // ---- connectors: lanesTo(node) x lanesFrom(node), topology.ts's angle split -------------------------
  const lanesFrom = new Map(), lanesTo = new Map();
  for (const l of lanes) {
    if (l.internal) continue;
    if (l.fromId) (lanesFrom.get(l.fromId) ?? lanesFrom.set(l.fromId, []).get(l.fromId)).push(l);
    if (l.toId) (lanesTo.get(l.toId) ?? lanesTo.set(l.toId, []).get(l.toId)).push(l);
  }
  const laneCell = new Map(); // laneId -> cell key (for conn ids, deterministic)
  for (const [key, c] of cells) for (const id of c.lanes.keys()) laneCell.set(id, key);
  for (const n of nodes.values()) {
    const ins = lanesTo.get(n.id) ?? [];
    const outs = lanesFrom.get(n.id) ?? [];
    for (const inLane of ins) {
      // A node's cell may hold no lane centroid; the in-lane's cell always exists, so the connector lives there.
      const c = cells.get(laneCell.get(inLane.id));
      const dIn = lastDir(inLane.pts);
      for (const outLane of outs) {
        // Reversing onto the same piece is a U-turn: legal at a terminus only (topology.ts).
        if (inLane.road === outLane.road && n.kind !== 'deadEnd') continue;
        const dOut = firstDir(outLane.pts);
        const cross = dIn[0] * dOut[1] - dIn[1] * dOut[0];
        const dot = dIn[0] * dOut[0] + dIn[1] * dOut[1];
        const angle = Math.atan2(cross, dot);
        const turn =
          Math.abs(angle) > UTURN_RADIANS ? 'uturn'
          : Math.abs(angle) <= THROUGH_RADIANS ? 'through'
          : angle < 0 ? 'left'
          : 'right';
        c.conns.push({ in: inLane.id, out: outLane.id, node: n.id, turn });
      }
    }
  }

  // ---- per-cell budget: the cell's share of CAR_TARGET by lane metres --------------------------------
  let total = 0;
  for (const c of cells.values()) total += c.weight;
  for (const c of cells.values()) c.budget = total > 0 && c.weight > 0 ? Math.max(1, Math.round((CAR_TARGET * c.weight) / total)) : 0;

  const nodeById = new Map([...nodes.values()].map((n) => [n.id, n]));
  return { cells, nodeById };
}

export function packTrafficCell(c, nodeById) {
  const w = new PackWriter(PACK_KINDS.traffic, c.cx, c.cz);
  const lanes = [...c.lanes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  w.u32(lanes.length);
  for (const l of lanes) {
    w.u16(w.s(l.id));
    w.u16(w.s(l.fromId ?? null));
    w.u16(w.s(l.toId ?? null));
    w.u32(l.segId >>> 0);
    w.u16(w.s(l.name));
    w.u8(l.dir > 0 ? 0 : 1);
    w.u8(l.rclass);
    w.i8(l.oneway);
    w.u8(l.laneIndex);
    w.u8(l.laneCount);
    w.u8(l.speedMph);
    w.u8(l.park);
    w.u8((l.boundary ? 1 : 0) | (l.internal ? 2 : 0));
    w.f32(l.lateral); w.f32(l.laneWidth); w.f32(l.widthMeters); w.f32(l.mouthFrom); w.f32(l.mouthTo);
    w.u16(l.pts.length);
    for (const p of l.pts) { w.f32(p[0] - w.ox); w.f32(p[1]); w.f32(p[2] - w.oz); }
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
  const conns = [...c.conns].sort((a, b) => (a.in + a.out < b.in + b.out ? -1 : 1));
  w.u32(conns.length);
  for (const cn of conns) {
    w.u16(w.s(cn.in));
    w.u16(w.s(cn.out));
    w.u16(w.s(cn.node));
    w.u8(TURN[cn.turn]);
    w.u8(0);
  }
  w.u16(c.budget);
  w.f32(c.weight);
  return w.finish();
}

export async function writeTrafficCells({ out = OUT, tiles = null } = {}) {
  const all = tiles ?? loadTiles(CACHE);
  const { cells, nodeById } = buildTrafficCells(all);
  const dir = join(out, 'traffic');
  // A cell that no longer emits must not survive as a stale pack the manifest would still pin.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const entries = [];
  let lanes = 0, nodesOut = 0, conns = 0;
  for (const key of [...cells.keys()].sort(cellSort)) {
    const c = cells.get(key);
    if (c.lanes.size === 0 && c.nodeIds.size === 0) continue;
    const buf = packTrafficCell(c, nodeById);
    await writeFile(join(dir, `${key}.bin`), buf);
    entries.push({ key: `traffic/${key}`, file: join(dir, `${key}.bin`) });
    lanes += c.lanes.size; nodesOut += c.nodeIds.size; conns += c.conns.length;
  }
  return { entries, counts: { cells: entries.length, lanes, nodes: nodesOut, conns } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : OUT;
  const { counts } = await writeTrafficCells({ out });
  console.log(`traffic: ${counts.cells} cells, ${counts.lanes} lane edges, ${counts.nodes} nodes, ${counts.conns} connectors`);
}
