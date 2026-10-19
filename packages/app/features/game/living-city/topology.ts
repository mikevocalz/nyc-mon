// Living City PR02 — the road & sidewalk topology sidecar. A directed lane
// graph plus sidewalk/crosswalk legs derived from the parsed tile at load
// time: nothing is baked into the dataset JSON, so the dataset format, its
// id/version and every saved world location are untouched. Pure data and
// pure functions — no three.js, no React — so `node --test` covers it and a
// simulation can consume it on any thread.
//
// Provenance discipline (spec §6, scout-D): the v3 CSCL record fields
// (`l` lanes, `ow` oneway, `sp` speed, `sid` physicalid) are consumed
// verbatim wherever the tile carries them. Every value the sidecar derives
// instead of reading from a record is flagged `inferred` with the rule that
// produced it, the same honesty bit the dataset's `e` field uses. NYC
// defaults: `ow` absent -> two-way; `l` absent -> 1 lane per direction on
// local streets, 2 on arterials; `sp` absent -> 25 mph citywide default.
//
// Stable ids: `node:` ids join the sorted CSCL sids (or road ids) of the
// endpoints clustered into each junction; `lane:`/`walk:`/`xwalk:`/`conn:`
// ids derive from those road ids and node ids, so two builds of the same
// tile produce byte-identical ids.
import { unprojectFromScene } from '@acme/core';
import type { CityDatasetV3, CityRoad, FlatPoints, GeoPoint, RoadClass } from '../city-dataset.ts';
import { ribbon } from '../world/geometry.ts';

/** Classes the lane graph motors on. Walkway classes and crossing strips stay out: crossings feed crosswalk legs instead. */
export const CARRIAGEWAY_CLASSES: ReadonlySet<RoadClass> = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living', 'service',
]);
/** Classes that infer two lanes per direction when `l` is absent; the rest infer one. */
const ARTERIAL_CLASSES: ReadonlySet<RoadClass> = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
/**
 * Endpoints of different road pieces closer than this share one junction
 * node. CSCL segments end at the junction-box edge, not at a shared point —
 * a divided avenue crosses 125th Street over a ~35 m box — so this has to
 * reach past a wide crossing without chaining whole blocks (Harlem blocks
 * are ~60 m). Measured on the v3 tile: 20 m joins every real junction.
 */
export const NODE_MERGE_METRES = 20;
/** Azimuth gap that splits two approach legs at one node. */
export const LEG_GAP_DEGREES = 55;
/** NYC citywide default speed when `sp` is absent (inferred, never silent). */
export const NYC_DEFAULT_SPEED_MPH = 25;
/** How far past a node's member endpoints a crossing way may sit and still belong to it. */
const XWALK_REACH_METRES = 18;
/** A crossing way's midpoint this far from a leg's mouth counts as that leg's crosswalk. */
const XWALK_LEG_MATCH_METRES = 20;
/** A synthetic crosswalk reaches this far into each sidewalk band. */
const XWALK_SIDEWALK_BITE = 0.5;
/** A crosswalk endpoint this close to a walk edge counts as landing on it. */
const XWALK_WALK_MATCH_METRES = 8;
/** Turn angle window (radians) that still counts as 'through'. */
const THROUGH_RADIANS = (35 * Math.PI) / 180;
/** Past this angle a connector is a U-turn. */
const UTURN_RADIANS = (145 * Math.PI) / 180;

export type InferenceRule =
  | 'oneway-two-way-default' // ow absent -> two-way, the NYC default
  | 'lanes-arterial-default' // l absent on an arterial class -> 2 per direction
  | 'lanes-local-default' // l absent on a local class -> 1 per direction
  | 'lanes-split-odd' // odd recorded lane count: the odd lane goes forward
  | 'speed-nyc-25' // sp absent -> 25 mph citywide default
  | 'xwalk-osm-crossing' // centreline adopted from a crossing way; the node binding is ours
  | 'xwalk-corner-fallback' // no crossing way: synthesised from road width + leg angle
  | 'connector-angle-legal' // in->out allowed except reversing onto the same way
  | 'connector-dead-end-uturn'; // the only same-way connector, at a terminus

export type NodeKind =
  /** Three or more road ends meet: a real intersection. */
  | 'junction'
  /** Two ends meet: a mid-street joint (segment chain or name change). */
  | 'link'
  /** One end, inside the tile: a genuine road terminus. */
  | 'deadEnd'
  /** One end at the clipped fringe: the tile cut the road. */
  | 'boundary';

export interface ApproachLeg {
  /** Direction the road leaves the node, radians in scene coords (atan2(dz, dx)). */
  azimuth: number;
  /** Mean of the member endpoints in this leg — where the carriageway meets the junction box. */
  mouth: readonly [number, number];
  /** Road piece ids whose endpoints group into this leg (a divided avenue lands two). */
  roadIds: readonly string[];
  /** A street name shared by the leg's roads, when any member carries one. */
  name?: string;
  /** Widest member carriageway + its sidewalk band. */
  widthMeters: number;
  sidewalkMeters: number;
}

export interface TopologyNode {
  /** `node:` + sorted member keys (`s<sid>` or `r<roadId>`), unique by construction. */
  id: string;
  kind: NodeKind;
  /** Centroid of the member endpoints, scene metres. */
  x: number;
  z: number;
  /** WGS84 of the centroid, unprojected through the dataset origin. */
  longitude: number;
  latitude: number;
  /** Distinct street names meeting here, sorted (empty when every member is unnamed). */
  names: readonly string[];
  legs: readonly ApproachLeg[];
  /** Sorted road piece ids with an endpoint here. */
  roads: readonly string[];
  /** 'roadId:0' | 'roadId:1' per member endpoint, sorted. */
  members: readonly string[];
}

export interface Segment {
  /** `seg:` + road key (`s<sid>` or `r<roadId>`) — the undirected piece the lane edges derive from. */
  id: string;
  roadId: string;
  /** v3 `sid` (CSCL physicalid) verbatim, when the record carries it. */
  segmentId?: number;
  class: RoadClass;
  name?: string;
  /** End nodes in stored-polyline order. */
  nodeA: string;
  nodeB: string;
  widthMeters: number;
  sidewalkMeters: number;
  /** Recorded `l`/`sp` verbatim, or the inferred totals/defaults. */
  lanesTotal: number;
  oneway: -1 | 0 | 1;
  speedMph: number;
  lengthMeters: number;
  /** Both ends in the same node: a junction-box interior piece. */
  internal: boolean;
}

export interface LaneEdge {
  /** `lane:` + roadId + `:f|b:` + lane index. */
  id: string;
  roadId: string;
  /** v3 `sid` (CSCL physicalid) verbatim, when the record carries it. */
  segmentId?: number;
  /** Node ids in travel direction. */
  from: string;
  to: string;
  /** 'forward' travels along the stored polyline, 'backward' against it. */
  dir: 'forward' | 'backward';
  /** 0 = rightmost lane in travel direction. */
  laneIndex: number;
  /** Lanes travelling this direction on this piece. */
  laneCount: number;
  /** Recorded `ow` verbatim, or the inferred 0. */
  oneway: -1 | 0 | 1;
  onewayInferred?: 'oneway-two-way-default';
  speedMph: number;
  speedInferred?: 'speed-nyc-25';
  lanesInferred?: 'lanes-arterial-default' | 'lanes-local-default' | 'lanes-split-odd';
  /** Lane centreline in travel direction, flat [x, z, ...], offset from the road centreline by `lateral`. */
  points: FlatPoints;
  /** Signed offset from the road centreline, metres: + = left of travel. */
  lateral: number;
  lengthMeters: number;
  /** Lane width, metres (its share of the carriageway). */
  widthMeters: number;
  /** Both ends sit in the same node: a junction-box interior piece. */
  internal: boolean;
  /** Ends at a tile-edge stub node. */
  boundary: boolean;
}

export interface WalkEdge {
  /** `walk:` + roadId + `:l|r` — the sidewalk band each side of a carriageway. */
  id: string;
  roadId: string;
  /** Sidewalks are walked both ways: node order follows the stored polyline, not travel. */
  nodeA: string;
  nodeB: string;
  side: 'left' | 'right';
  /** Band centreline, flat [x, z, ...], `widthMeters/2 + sidewalk/2` off the road centreline. */
  points: FlatPoints;
  /** Recorded `s` band width, verbatim. */
  widthMeters: number;
}

export interface XwalkLeg {
  /** `xwalk:` + node id + `:` + crossing way id or `leg<index>`. */
  id: string;
  node: string;
  /** Index into the node's legs this crossing spans, or -1 when no leg matched. */
  leg: number;
  /** The OSM crossing way that supplied the centreline (osm-crossing backing only). */
  crossingRoadId?: string;
  backing: 'osm-crossing' | 'corner-fallback';
  inferred: 'xwalk-osm-crossing' | 'xwalk-corner-fallback';
  /** Crosswalk centreline kerb-to-kerb, flat [x, z, ...]. */
  points: FlatPoints;
  lengthMeters: number;
  /** The two walk edges this leg lands on, where they could be matched (null when none within reach). */
  walks: readonly [string | null, string | null];
}

export interface LaneConnector {
  /** `conn:` + in-lane id + `>` + out-lane id. */
  id: string;
  node: string;
  in: string;
  out: string;
  turn: 'through' | 'left' | 'right' | 'uturn';
  inferred: 'connector-angle-legal' | 'connector-dead-end-uturn';
}

export interface TopologyStats {
  nodes: Record<NodeKind, number>;
  segments: number;
  laneEdges: number;
  walkEdges: number;
  connectors: number;
  /** Carriageway pieces by recorded/inferred direction. */
  roadsOneway: number;
  roadsTwoWay: number;
  /** Per-carriageway-piece counts: fields read from CSCL records vs filled by a rule. */
  recorded: { speed: number; lanes: number; oneway: number };
  inferred: { speed: number; lanes: number; oneway: number; xwalk: number; connector: number };
  xwalks: { osm: number; synthetic: number };
}

export interface LaneTopology {
  datasetId: string;
  datasetVersion: 3;
  /** All collections sorted by id: JSON.stringify is byte-stable across builds. */
  nodes: readonly TopologyNode[];
  segments: readonly Segment[];
  lanes: readonly LaneEdge[];
  walks: readonly WalkEdge[];
  xwalks: readonly XwalkLeg[];
  connectors: readonly LaneConnector[];
  nodeById: ReadonlyMap<string, TopologyNode>;
  laneById: ReadonlyMap<string, LaneEdge>;
  /** Lane edges leaving / entering each node, by node id. */
  lanesFrom: ReadonlyMap<string, readonly LaneEdge[]>;
  lanesTo: ReadonlyMap<string, readonly LaneEdge[]>;
  stats: TopologyStats;
}

interface Endpoint {
  x: number;
  z: number;
  road: CityRoad;
  end: 0 | 1;
  /** Direction leaving the junction along the road, radians. */
  azimuth: number;
}

function outwardAzimuth(road: CityRoad, end: 0 | 1): number {
  const p = road.points;
  const n = p.length;
  return end === 0 ? Math.atan2(p[3]! - p[1]!, p[2]! - p[0]!) : Math.atan2(p[n - 3]! - p[n - 1]!, p[n - 4]! - p[n - 2]!);
}

/** Stable key per road for ids: the CSCL sid when the record carries it. */
function roadKey(road: CityRoad): string {
  return road.segmentId !== undefined ? `s${road.segmentId}` : `r${road.id}`;
}

interface Cluster {
  members: Endpoint[];
  x: number;
  z: number;
}

/**
 * Cluster road endpoints into junction candidates: union-find over a
 * spatial hash. Endpoints that sit across a junction box (divided avenues,
 * skew crossings) merge at NODE_MERGE_METRES; same-street chains and
 * mid-block joints merge too, yielding 'link' nodes.
 */
function clusterEndpoints(roads: readonly CityRoad[]): Cluster[] {
  const endpoints: Endpoint[] = [];
  for (const road of roads) {
    const p = road.points;
    const n = p.length;
    endpoints.push({ x: p[0]!, z: p[1]!, road, end: 0, azimuth: outwardAzimuth(road, 0) });
    endpoints.push({ x: p[n - 2]!, z: p[n - 1]!, road, end: 1, azimuth: outwardAzimuth(road, 1) });
  }
  const parent = endpoints.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const cell = NODE_MERGE_METRES;
  const grid = new Map<number, number[]>();
  endpoints.forEach((e, i) => {
    const key = Math.floor(e.x / cell) * 100_003 + Math.floor(e.z / cell);
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  endpoints.forEach((e, i) => {
    const cx = Math.floor(e.x / cell);
    const cz = Math.floor(e.z / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const j of grid.get(gx * 100_003 + gz) ?? []) {
          const f = endpoints[j]!;
          if (Math.hypot(e.x - f.x, e.z - f.z) <= NODE_MERGE_METRES) {
            const pi = find(i);
            const pj = find(j);
            if (pi !== pj) parent[pi] = pj;
          }
        }
      }
    }
  });
  const clusters = new Map<number, Endpoint[]>();
  endpoints.forEach((e, i) => {
    const root = find(i);
    const list = clusters.get(root);
    if (list) list.push(e);
    else clusters.set(root, [e]);
  });
  return [...clusters.values()].map((members) => {
    members.sort((a, b) => (a.road.id < b.road.id ? -1 : a.road.id > b.road.id ? 1 : a.end - b.end));
    const x = members.reduce((s, e) => s + e.x, 0) / members.length;
    const z = members.reduce((s, e) => s + e.z, 0) / members.length;
    return { members, x, z };
  });
}

/** Group member endpoints into approach legs by outward azimuth: sorted angles, cut at gaps > LEG_GAP. */
function legsOf(members: readonly Endpoint[], internalRoads: ReadonlySet<string>): ApproachLeg[] {
  const items = members
    .filter((e) => !internalRoads.has(e.road.id))
    .map((e) => ({ az: e.azimuth < 0 ? e.azimuth + Math.PI * 2 : e.azimuth, e }));
  if (items.length === 0) return [];
  items.sort((a, b) => a.az - b.az);
  const gap = (LEG_GAP_DEGREES * Math.PI) / 180;
  // Cut at the widest gap so the wrap-around lands between two legs, then split the rest linearly.
  let cut = 0;
  let widest = -1;
  for (let i = 0; i < items.length; i++) {
    const g = items[(i + 1) % items.length]!.az - items[i]!.az + (i + 1 === items.length ? Math.PI * 2 : 0);
    if (g > widest) {
      widest = g;
      cut = i + 1;
    }
  }
  // Wrapped tail items need +2π or the gap test reads them as a ~360° rewind.
  const ordered = [...items.slice(cut), ...items.slice(0, cut).map((it) => ({ az: it.az + Math.PI * 2, e: it.e }))];
  const groups: Endpoint[][] = [[ordered[0]!.e]];
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]!.az - ordered[i - 1]!.az > gap) groups.push([ordered[i]!.e]);
    else groups[groups.length - 1]!.push(ordered[i]!.e);
  }
  return groups.map((group): ApproachLeg => {
    let sx = 0;
    let sz = 0;
    let mx = 0;
    let mz = 0;
    let width = 0;
    let sidewalk = 0;
    let name: string | undefined;
    const roadIds = new Set<string>();
    for (const e of group) {
      sx += Math.cos(e.azimuth);
      sz += Math.sin(e.azimuth);
      mx += e.x;
      mz += e.z;
      width = Math.max(width, e.road.widthMeters);
      sidewalk = Math.max(sidewalk, e.road.sidewalkMeters);
      name ??= e.road.name;
      roadIds.add(e.road.id);
    }
    const leg: ApproachLeg = {
      azimuth: Math.atan2(sz / group.length, sx / group.length),
      mouth: [mx / group.length, mz / group.length],
      roadIds: [...roadIds].sort(),
      widthMeters: width,
      sidewalkMeters: sidewalk,
    };
    if (name !== undefined) return { ...leg, name };
    return leg;
  });
}

function polylineLength(points: FlatPoints): number {
  let length = 0;
  for (let i = 2; i < points.length; i += 2) length += Math.hypot(points[i]! - points[i - 2]!, points[i + 1]! - points[i - 1]!);
  return length;
}

/** The road polyline travelled `dir`, offset `lateral` metres (+ = left of travel). */
function offsetTravelPolyline(road: CityRoad, dir: 'forward' | 'backward', lateral: number): FlatPoints {
  const p = road.points;
  const travel: [number, number][] = [];
  if (dir === 'forward') {
    for (let i = 0; i + 1 < p.length; i += 2) travel.push([p[i]!, p[i + 1]!]);
  } else {
    for (let i = p.length - 2; i >= 0; i -= 2) travel.push([p[i]!, p[i + 1]!]);
  }
  if (Math.abs(lateral) < 1e-6) return travel.flat();
  // ribbon()'s left side is +lateral of travel; its right side is -lateral.
  const band = ribbon(travel, Math.abs(lateral));
  return (lateral > 0 ? band.left : band.right).flat();
}

function lastSegmentDir(points: FlatPoints): [number, number] {
  const n = points.length;
  const dx = points[n - 2]! - points[n - 4]!;
  const dz = points[n - 1]! - points[n - 3]!;
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

function firstSegmentDir(points: FlatPoints): [number, number] {
  const dx = points[2]! - points[0]!;
  const dz = points[3]! - points[1]!;
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

/**
 * Build the sidecar over a parsed tile. Deterministic: every collection is
 * sorted by id and every id derives from record keys, so two runs emit the
 * same bytes.
 */
export function buildLaneTopology(dataset: CityDatasetV3): LaneTopology {
  const carriageways = dataset.roads.filter((r) => CARRIAGEWAY_CLASSES.has(r.class));
  const origin: GeoPoint = dataset.origin;

  // ---- Nodes ----------------------------------------------------------------
  const clusters = clusterEndpoints(carriageways);
  const nodes: TopologyNode[] = [];
  const nodeOfEnd = new Map<string, TopologyNode>(); // 'roadId:end' -> node
  for (const cluster of clusters) {
    const { members, x, z } = cluster;
    const roadIds = [...new Set(members.map((e) => e.road.id))].sort();
    // A piece whose both ends land in this same cluster is a junction-box
    // interior link; it carries traffic through the node but isn't a leg.
    const internalRoads = new Set(roadIds.filter((id) => members.reduce((n, e) => n + (e.road.id === id ? 1 : 0), 0) >= 2));
    const kind: NodeKind =
      members.length >= 3 ? 'junction'
      : members.length === 2 ? 'link'
      : Math.hypot(x, z) > dataset.extentMeters ? 'boundary'
      : 'deadEnd';
    const geo = unprojectFromScene({ x, z }, { crs: 'EPSG:4326', longitude: origin[0], latitude: origin[1] });
    const node: TopologyNode = {
      id: `node:${[...new Set(members.map((e) => roadKey(e.road)))].sort().join('.')}`,
      kind,
      x,
      z,
      longitude: geo.longitude,
      latitude: geo.latitude,
      names: [...new Set(members.map((e) => e.road.name).filter((n): n is string => n !== undefined))].sort(),
      legs: legsOf(members, internalRoads),
      roads: roadIds,
      members: members.map((e) => `${e.road.id}:${e.end}`),
    };
    nodes.push(node);
    for (const e of members) nodeOfEnd.set(`${e.road.id}:${e.end}`, node);
  }

  // ---- Segments + lane edges ---------------------------------------------------
  const segments: Segment[] = [];
  const lanes: LaneEdge[] = [];
  const stats: TopologyStats = {
    nodes: { junction: 0, link: 0, deadEnd: 0, boundary: 0 },
    segments: 0,
    laneEdges: 0,
    walkEdges: 0,
    connectors: 0,
    roadsOneway: 0,
    roadsTwoWay: 0,
    recorded: { speed: 0, lanes: 0, oneway: 0 },
    inferred: { speed: 0, lanes: 0, oneway: 0, xwalk: 0, connector: 0 },
    xwalks: { osm: 0, synthetic: 0 },
  };
  for (const node of nodes) stats.nodes[node.kind]++;

  for (const road of carriageways) {
    const nodeA = nodeOfEnd.get(`${road.id}:0`)!;
    const nodeB = nodeOfEnd.get(`${road.id}:1`)!;
    const internal = nodeA === nodeB;
    const boundary = nodeA.kind === 'boundary' || nodeB.kind === 'boundary';
    const oneway = (road.oneway ?? 0) as -1 | 0 | 1;
    const onewayInferred = road.oneway === undefined ? ('oneway-two-way-default' as const) : undefined;
    const speedMph = road.speedMph ?? NYC_DEFAULT_SPEED_MPH;
    const speedInferred = road.speedMph === undefined ? ('speed-nyc-25' as const) : undefined;
    const lanesInferredByClass =
      road.lanes === undefined ? (ARTERIAL_CLASSES.has(road.class) ? ('lanes-arterial-default' as const) : ('lanes-local-default' as const)) : undefined;
    // Total travel lanes on the piece: recorded `l`, else the class rule
    // (2/direction on arterials, 1/direction on local streets; on a one-way
    // piece every lane shares the single travel direction).
    const lanesTotal =
      road.lanes ?? (oneway === 0 ? (ARTERIAL_CLASSES.has(road.class) ? 4 : 2) : ARTERIAL_CLASSES.has(road.class) ? 2 : 1);
    if (onewayInferred) stats.inferred.oneway++;
    else stats.recorded.oneway++;
    if (speedInferred) stats.inferred.speed++;
    else stats.recorded.speed++;
    if (lanesInferredByClass) stats.inferred.lanes++;
    else stats.recorded.lanes++;
    if (oneway === 0) stats.roadsTwoWay++;
    else stats.roadsOneway++;

    const segment: Segment = {
      id: `seg:${roadKey(road)}`,
      roadId: road.id,
      class: road.class,
      nodeA: nodeA.id,
      nodeB: nodeB.id,
      widthMeters: road.widthMeters,
      sidewalkMeters: road.sidewalkMeters,
      lanesTotal,
      oneway,
      speedMph,
      lengthMeters: polylineLength(road.points),
      internal,
    };
    if (road.segmentId !== undefined) segment.segmentId = road.segmentId;
    if (road.name !== undefined) segment.name = road.name;
    segments.push(segment);

    // Direction split for two-way pieces: recorded odd counts give the odd
    // lane to 'forward' (flagged — CSCL has no lanes:forward breakdown).
    const directions: { dir: 'forward' | 'backward'; count: number; splitOdd: boolean }[] =
      oneway === 1
        ? [{ dir: 'forward', count: lanesTotal, splitOdd: false }]
        : oneway === -1
          ? [{ dir: 'backward', count: lanesTotal, splitOdd: false }]
          : [
              { dir: 'forward', count: lanesTotal - Math.floor(lanesTotal / 2), splitOdd: lanesTotal % 2 === 1 },
              { dir: 'backward', count: Math.floor(lanesTotal / 2), splitOdd: lanesTotal % 2 === 1 },
            ];
    for (const { dir, count, splitOdd } of directions) {
      // Lanes share their direction's half of the carriageway (the whole
      // width on one-way pieces); lane 0 rides the kerb.
      const span = oneway === 0 ? road.widthMeters / 2 : road.widthMeters;
      const laneWidth = span / count;
      for (let i = 0; i < count; i++) {
        const lateral = -(span - laneWidth * (i + 0.5));
        const points = offsetTravelPolyline(road, dir, lateral);
        const from = dir === 'forward' ? nodeA : nodeB;
        const to = dir === 'forward' ? nodeB : nodeA;
        const lanesInferred = lanesInferredByClass ?? (splitOdd ? ('lanes-split-odd' as const) : undefined);
        const edge: LaneEdge = {
          id: `lane:${road.id}:${dir === 'forward' ? 'f' : 'b'}:${i}`,
          roadId: road.id,
          from: from.id,
          to: to.id,
          dir,
          laneIndex: i,
          laneCount: count,
          oneway,
          speedMph,
          points,
          lateral,
          lengthMeters: polylineLength(points),
          widthMeters: laneWidth,
          internal,
          boundary,
        };
        if (road.segmentId !== undefined) edge.segmentId = road.segmentId;
        if (onewayInferred) edge.onewayInferred = onewayInferred;
        if (speedInferred) edge.speedInferred = speedInferred;
        if (lanesInferred) edge.lanesInferred = lanesInferred;
        lanes.push(edge);
      }
    }
  }
  lanes.sort((a, b) => (a.id < b.id ? -1 : 1));
  segments.sort((a, b) => (a.id < b.id ? -1 : 1));
  stats.laneEdges = lanes.length;
  stats.segments = segments.length;

  // ---- Sidewalk edges ----------------------------------------------------------
  const walks: WalkEdge[] = [];
  for (const road of carriageways) {
    if (road.sidewalkMeters <= 0) continue;
    const nodeA = nodeOfEnd.get(`${road.id}:0`)!;
    const nodeB = nodeOfEnd.get(`${road.id}:1`)!;
    const off = road.widthMeters / 2 + road.sidewalkMeters / 2;
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < road.points.length; i += 2) pts.push([road.points[i]!, road.points[i + 1]!]);
    const band = ribbon(pts, off);
    for (const side of ['left', 'right'] as const) {
      walks.push({
        id: `walk:${road.id}:${side === 'left' ? 'l' : 'r'}`,
        roadId: road.id,
        nodeA: nodeA.id,
        nodeB: nodeB.id,
        side,
        points: (side === 'left' ? band.left : band.right).flat(),
        widthMeters: road.sidewalkMeters,
      });
    }
  }
  walks.sort((a, b) => (a.id < b.id ? -1 : 1));
  stats.walkEdges = walks.length;

  // ---- Crosswalk legs -----------------------------------------------------------
  const crossings = dataset.roads.filter((r) => r.class === 'crossing').map((r) => {
    const p = r.points;
    let mx = 0;
    let mz = 0;
    const n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) {
      mx += p[i]! / n;
      mz += p[i + 1]! / n;
    }
    return { road: r, mx, mz };
  });
  const xwalks: XwalkLeg[] = [];
  for (const node of nodes) {
    if (node.kind !== 'junction' && node.kind !== 'link') continue;
    const reach = Math.max(...node.legs.map((l) => Math.hypot(l.mouth[0] - node.x, l.mouth[1] - node.z)), 8) + XWALK_REACH_METRES;
    // Crossing ways whose midpoint falls inside this junction belong to it;
    // nearest node wins when junctions crowd (a crossing sits at one corner).
    const claimed = crossings
      .filter((c) => Math.hypot(c.mx - node.x, c.mz - node.z) <= reach)
      .map((c) => ({ c, d: Math.hypot(c.mx - node.x, c.mz - node.z) }));
    const covered = new Set<number>();
    for (const { c } of claimed) {
      // The leg a crossing spans is the one whose mouth sits nearest its midpoint.
      let leg = -1;
      let best = XWALK_LEG_MATCH_METRES;
      node.legs.forEach((l, i) => {
        const d = Math.hypot(c.mx - l.mouth[0], c.mz - l.mouth[1]);
        if (d < best) {
          best = d;
          leg = i;
        }
      });
      if (leg >= 0) covered.add(leg);
      const points = c.road.points;
      const walks2 = matchXwalkWalks(points, walks, node);
      const xwalk: XwalkLeg = {
        id: `xwalk:${node.id}:${c.road.id}`,
        node: node.id,
        leg,
        backing: 'osm-crossing',
        inferred: 'xwalk-osm-crossing',
        points,
        lengthMeters: polylineLength(points),
        walks: walks2,
        crossingRoadId: c.road.id,
      };
      xwalks.push(xwalk);
      stats.xwalks.osm++;
      stats.inferred.xwalk++;
    }
    // Every approach with no crossing way still gets a corner-to-corner leg
    // across its mouth, synthesised from the carriageway width + leg angle.
    node.legs.forEach((leg, i) => {
      if (covered.has(i) || leg.widthMeters <= 0) return;
      const px = -Math.sin(leg.azimuth);
      const pz = Math.cos(leg.azimuth);
      const half = leg.widthMeters / 2 + Math.min(leg.sidewalkMeters, 4) * XWALK_SIDEWALK_BITE;
      const points = [
        leg.mouth[0] - px * half,
        leg.mouth[1] - pz * half,
        leg.mouth[0] + px * half,
        leg.mouth[1] + pz * half,
      ];
      xwalks.push({
        id: `xwalk:${node.id}:leg${i}`,
        node: node.id,
        leg: i,
        backing: 'corner-fallback',
        inferred: 'xwalk-corner-fallback',
        points,
        lengthMeters: polylineLength(points),
        walks: matchXwalkWalks(points, walks, node),
      });
      stats.xwalks.synthetic++;
      stats.inferred.xwalk++;
    });
  }
  xwalks.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ---- Lane connectors ----------------------------------------------------------
  const lanesFrom = new Map<string, LaneEdge[]>();
  const lanesTo = new Map<string, LaneEdge[]>();
  for (const lane of lanes) {
    (lanesFrom.get(lane.from) ?? lanesFrom.set(lane.from, []).get(lane.from)!).push(lane);
    (lanesTo.get(lane.to) ?? lanesTo.set(lane.to, []).get(lane.to)!).push(lane);
  }
  const connectors: LaneConnector[] = [];
  for (const node of nodes) {
    const ins = lanesTo.get(node.id) ?? [];
    const outs = lanesFrom.get(node.id) ?? [];
    for (const inLane of ins) {
      const dIn = lastSegmentDir(inLane.points);
      for (const outLane of outs) {
        // Reversing onto the same piece is a U-turn: legal at a terminus only.
        if (inLane.roadId === outLane.roadId && node.kind !== 'deadEnd') continue;
        const dOut = firstSegmentDir(outLane.points);
        const cross = dIn[0] * dOut[1] - dIn[1] * dOut[0];
        const dot = dIn[0] * dOut[0] + dIn[1] * dOut[1];
        const angle = Math.atan2(cross, dot);
        // Scene axes are x-east / z-south (left-handed map): a negative turn is a left.
        const turn =
          Math.abs(angle) > UTURN_RADIANS ? 'uturn'
          : Math.abs(angle) <= THROUGH_RADIANS ? 'through'
          : angle < 0 ? 'left'
          : 'right';
        const inferred = inLane.roadId === outLane.roadId ? ('connector-dead-end-uturn' as const) : ('connector-angle-legal' as const);
        connectors.push({ id: `conn:${inLane.id}>${outLane.id}`, node: node.id, in: inLane.id, out: outLane.id, turn, inferred });
        stats.inferred.connector++;
      }
    }
  }
  connectors.sort((a, b) => (a.id < b.id ? -1 : 1));
  stats.connectors = connectors.length;

  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const laneById = new Map(lanes.map((l) => [l.id, l]));
  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    nodes,
    segments,
    lanes,
    walks,
    xwalks,
    connectors,
    nodeById,
    laneById,
    lanesFrom,
    lanesTo,
    stats,
  };
}

/** The walk edges a crosswalk leg lands on, matched by endpoint distance to each band's polyline. */
function matchXwalkWalks(points: FlatPoints, walks: readonly WalkEdge[], node: TopologyNode): [string | null, string | null] {
  const near = new Set(node.roads);
  const match = (x: number, z: number): string | null => {
    let bestId: string | null = null;
    let best = XWALK_WALK_MATCH_METRES;
    for (const w of walks) {
      if (!near.has(w.roadId)) continue;
      for (let i = 2; i < w.points.length; i += 2) {
        const d = segDist(x, z, w.points[i - 2]!, w.points[i - 1]!, w.points[i]!, w.points[i + 1]!);
        if (d < best) {
          best = d;
          bestId = w.id;
        }
      }
    }
    return bestId;
  };
  const n = points.length;
  return [match(points[0]!, points[1]!), match(points[n - 2]!, points[n - 1]!)];
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
