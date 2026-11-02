// Adapted from mrdoob/slop-newyork @ be65d0a, js/road-paint.js buildRoadPaint and js/tsl-materials.js createRoadPaintMaterial (MIT, © 2026 Mr.doob)
//
// Road markings generated from the living-city lane graph
// (living-city/topology.ts), so the paint sits where the sim's traffic
// drives and stops, the principle of Slop's road-paint.js:
// - dashed white between lanes that run the same way,
// - double yellow down the centre of two-way pieces,
// - a stop bar across the lanes arriving at each junction,
// - continental crosswalks on every crosswalk leg, kerb to kerb.
// Slop's green bike lanes are not drawn: the tile carries no bike-lane
// record, and painting them on a rule would invent them.
//
// The lane graph gives each road piece its lane counts per direction and
// its junction nodes; the lines themselves are laid on the road polyline
// (two-way pieces split at the centre line, one-way pieces kerb to kerb),
// which keeps every mark on the asphalt. topology.ts offsets one-way lanes
// by up to 1.5 lane widths past the kerb (lateral = -(span - w(i + 0.5))
// with span = the full width), so following its lane centrelines would put
// paint on the sidewalk.
//
// Junction geometry differs from Slop's grid. A road piece here ends at the
// junction mouth, where topology.ts centres the crosswalk, so the stop bar
// sits behind half a crosswalk plus Slop's 0.35 m, and lane lines stop
// Slop's 0.9 m short of the stop line. Dash phase restarts on each road
// piece; Slop also carries it around bends.
//
// buildRoadPaint is pure (typed arrays, no three); the mesh and material
// are separate so node tests can pin the markings.
import type { Three } from '@acme/ui/three';
import { physicalCityMaterials } from '@acme/theme';
import type { CityDatasetV3 } from '../../city-dataset.ts';
import type { LaneEdge, LaneTopology } from '../../living-city/topology.ts';
import { LAYER } from '../city-mesh.ts';
import { pairs, ribbon } from '../geometry.ts';
import { ROAD_PAINT } from '../physical-materials-constants.ts';
import { asColorNode, asNode, asTsl, type TslNode } from './loose-tsl.ts';
import { roadPuddleField, roadWetMasks, transparentEffectMrt } from './roads.ts';
import { physicalTsl, type PhysicalMaterialUniforms } from './tsl-common.ts';
import { worldPatternPosition } from '../render-space.ts';

type Point = [number, number];
type Rgb = readonly [number, number, number];

/** sRGB channel to linear, as three's Color does for a hex (ColorManagement SRGBToLinear). */
export function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

function linearRgb(hex: string): Rgb {
  const v = Number.parseInt(hex.slice(1, 7), 16);
  return [srgbToLinear(((v >> 16) & 255) / 255), srgbToLinear(((v >> 8) & 255) / 255), srgbToLinear((v & 255) / 255)];
}

const WHITE = linearRgb(physicalCityMaterials.roadPaint.white);
const YELLOW = linearRgb(physicalCityMaterials.roadPaint.yellow);

/** Indexed strips: position xyz, side (offset from the strip centre) xz, paint (metres along, period, duty), linear colour. */
export interface RoadPaintArrays {
  position: Float32Array;
  /** Double-precision source positions for cell-local packaging (Float32 `position` stays for legacy callers). */
  position64?: Float64Array;
  side: Float32Array;
  paint: Float32Array;
  color: Float32Array;
  index: Uint32Array;
  stats: { laneLines: number; centreLines: number; stopBars: number; crosswalks: number };
}

/** Distance from a junction mouth to the stop line: half a crosswalk (road-network.js CROSSWALK 3.3 m). */
const STOP_LINE = (ROAD_PAINT.crosswalkWidth + 0.3) / 2;

export function buildRoadPaint(dataset: CityDatasetV3, topology: LaneTopology, baseHeight: number = LAYER.crossings): RoadPaintArrays {
  const position: number[] = [];
  const side: number[] = [];
  const paint: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const y = baseHeight + ROAD_PAINT.height;
  const stats = { laneLines: 0, centreLines: 0, stopBars: 0, crosswalks: 0 };

  // Slop strip(): a flat strip `w` wide from a to b with a dash pattern running along it.
  const strip = (ax: number, az: number, bx: number, bz: number, w: number, col: Rgb, period = 1, duty = 1, phase = 0) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return phase;
    const sx = ((az - bz) / len) * w * 0.5;
    const sz = ((bx - ax) / len) * w * 0.5;
    const i = position.length / 3;
    const end = phase + len;
    for (const [x, z, s, u] of [[ax, az, -1, phase], [ax, az, 1, phase], [bx, bz, 1, end], [bx, bz, -1, end]] as const) {
      position.push(x + sx * s, y, z + sz * s);
      side.push(sx * s, sz * s);
      paint.push(u, period, duty);
      colors.push(col[0], col[1], col[2]);
    }
    index.push(i, i + 1, i + 2, i, i + 2, i + 3);
    return end;
  };
  const polyline = (points: readonly Point[], w: number, col: Rgb, period = 1, duty = 1) => {
    let phase = 0;
    for (let k = 1; k < points.length; k++) phase = strip(points[k - 1]![0], points[k - 1]![1], points[k]![0], points[k]![1], w, col, period, duty, phase);
  };

  const kind = (id: string) => topology.nodeById.get(id)?.kind;
  const trim = (id: string | undefined) => (id && (kind(id) === 'junction' || kind(id) === 'deadEnd') ? STOP_LINE + ROAD_PAINT.endGap : 0);

  // Lane counts per road from the graph, outside the junction boxes.
  const byRoad = new Map<string, { forward: LaneEdge[]; backward: LaneEdge[] }>();
  for (const lane of topology.lanes) {
    if (lane.internal) continue;
    let entry = byRoad.get(lane.roadId);
    if (!entry) byRoad.set(lane.roadId, (entry = { forward: [], backward: [] }));
    entry[lane.dir].push(lane);
  }
  const roads = new Map(dataset.roads.map((r) => [r.id, r]));

  for (const [roadId, { forward, backward }] of byRoad) {
    const road = roads.get(roadId);
    if (!road) continue;
    // The road polyline in forward travel; laterals are + to the left of it.
    const pts = pairs(road.points);
    const offset = (lateral: number): Point[] =>
      Math.abs(lateral) < 1e-6 ? pts : lateral > 0 ? ribbon(pts, lateral).left : ribbon(pts, -lateral).right;
    const nodeA = forward[0]?.from ?? backward[0]?.to;
    const nodeB = forward[0]?.to ?? backward[0]?.from;
    const along = (lateral: number) => trimEnds(offset(lateral), trim(nodeA), trim(nodeB));
    const half = road.widthMeters / 2;
    const twoWay = forward.length > 0 && backward.length > 0;

    // Dashed white between lanes that run the same way. A two-way piece
    // splits its carriageway at the centre line; a one-way piece spreads
    // its lanes kerb to kerb.
    if (twoWay) {
      for (let k = 1; k < forward.length; k++) {
        polyline(along((-half * k) / forward.length), ROAD_PAINT.laneLineWidth, WHITE, ROAD_PAINT.laneDashPeriod, ROAD_PAINT.laneDashDuty);
        stats.laneLines++;
      }
      for (let k = 1; k < backward.length; k++) {
        polyline(along((half * k) / backward.length), ROAD_PAINT.laneLineWidth, WHITE, ROAD_PAINT.laneDashPeriod, ROAD_PAINT.laneDashDuty);
        stats.laneLines++;
      }
      for (const lateral of [ROAD_PAINT.yellowOffset, -ROAD_PAINT.yellowOffset]) polyline(along(lateral), ROAD_PAINT.yellowWidth, YELLOW);
      stats.centreLines++;
    } else {
      const n = forward.length + backward.length;
      for (let k = 1; k < n; k++) {
        polyline(along(-half + (road.widthMeters * k) / n), ROAD_PAINT.laneLineWidth, WHITE, ROAD_PAINT.laneDashPeriod, ROAD_PAINT.laneDashDuty);
        stats.laneLines++;
      }
    }

    // A stop bar across the lanes arriving at a junction, from the centre
    // line (or the far kerb on a one-way piece) to the kerb, behind the crosswalk.
    const approaches: [Point[], string | undefined, boolean][] = [
      [pts, nodeB, forward.length > 0],
      [[...pts].reverse(), nodeA, backward.length > 0],
    ];
    for (const [travel, to, used] of approaches) {
      if (!used || !to || kind(to) !== 'junction') continue;
      const at = pointBack(travel, STOP_LINE + ROAD_PAINT.stopBarBack);
      if (!at) continue;
      const [px, pz, dx, dz] = at;
      // Left of travel is (dz, -dx); the bar runs from `inner` to the kerb on the right.
      const inner = twoWay ? -0.1 : half - 0.1;
      const outer = -half + 0.1;
      strip(px + dz * inner, pz - dx * inner, px + dz * outer, pz - dx * outer, ROAD_PAINT.stopBarWidth, WHITE);
      stats.stopBars++;
    }
  }

  // Continental crosswalks: bars along traffic, laid out kerb to kerb.
  for (const xwalk of topology.xwalks) {
    polyline(pairs(xwalk.points), ROAD_PAINT.crosswalkWidth, WHITE, ROAD_PAINT.crosswalkPeriod, ROAD_PAINT.crosswalkDuty);
    stats.crosswalks++;
  }

  return {
    position: new Float32Array(position),
    position64: Float64Array.from(position),
    side: new Float32Array(side),
    paint: new Float32Array(paint),
    color: new Float32Array(colors),
    index: new Uint32Array(index),
    stats,
  };
}

/** The polyline with `start` metres cut from its first end and `end` from its last; empty when nothing is left. */
export function trimEnds(points: readonly Point[], start: number, end: number): Point[] {
  let total = 0;
  for (let k = 1; k < points.length; k++) total += Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1]);
  if (total <= start + end + 0.05) return [];
  const a = start; const b = total - end;
  const out: Point[] = [];
  let run = 0;
  for (let k = 1; k < points.length; k++) {
    const p = points[k - 1]!; const q = points[k]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const lerp = (t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (len > 0) {
      if (out.length === 0 && run + len >= a) out.push(lerp((a - run) / len));
      if (out.length > 0 && run + len >= b) { out.push(lerp((b - run) / len)); break; }
      if (out.length > 0) out.push([q[0], q[1]]);
    }
    run += len;
  }
  return out;
}

/** The point `back` metres before the polyline's end and the unit travel direction there: [x, z, dx, dz]. */
function pointBack(points: readonly Point[], back: number): [number, number, number, number] | null {
  let remaining = back;
  for (let k = points.length - 1; k > 0; k--) {
    const q = points[k]!; const p = points[k - 1]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1e-6) continue;
    const dx = (q[0] - p[0]) / len; const dz = (q[1] - p[1]) / len;
    if (remaining <= len) return [q[0] - dx * remaining, q[1] - dz * remaining, dx, dz];
    remaining -= len;
  }
  return null;
}

/**
 * Slop createRoadPaintMaterial: strips thinner than ~1.5 px are widened on
 * screen and faded to match, dashes are box-filtered over the pixel
 * footprint, and the paint wears, darkens and turns glossy in the same
 * pools and film as the asphalt under it.
 */
export function createRoadPaintMaterial(THREE: Three, uniforms: PhysicalMaterialUniforms, opts: { effectMrt?: boolean } = {}): InstanceType<Three['MeshStandardNodeMaterial']> {
  const { T, noise2D } = physicalTsl(THREE);
  const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false, metalness: 0.0 });
  if (opts.effectMrt) mat.mrtNode = transparentEffectMrt(T);
  const paintAttr = T.attribute('paint', 'vec3');
  const sideAttr = T.attribute('side', 'vec2');
  const sideOffset = T.vec3(sideAttr.x, 0.0, sideAttr.y);

  // How much to widen the strip so it is at least 1.5 px wide on screen (1 when it already is). The strips are world-space (identity model matrix).
  const widen = T.Fn(() => {
    const viewProjection = T.cameraProjectionMatrix.mul(T.cameraViewMatrix);
    const edge = viewProjection.mul(T.vec4(T.positionGeometry, 1.0));
    const centre = viewProjection.mul(T.vec4(T.positionGeometry.sub(sideOffset), 1.0));
    const halfWidthPx = T.length(edge.xy.div(edge.w).sub(centre.xy.div(centre.w)).mul(T.screenSize).mul(0.5));
    const inFront = T.step(0.05, T.min(edge.w, centre.w));
    return T.clamp(T.float(0.75).div(T.max(halfWidthPx, 0.001)), 1.0, 16.0).mul(inFront).max(1.0);
  })();
  mat.positionNode = asNode(T.positionGeometry.add(sideOffset.mul(widen.sub(1.0))));

  // Exact box filter of the dashes (on for `duty` of each period) over the pixel footprint.
  const t = paintAttr.x.div(paintAttr.y);
  const footprint = T.max(T.fwidth(t), 0.0001);
  const duty = paintAttr.z;
  const onSoFar = (x: TslNode) => T.floor(x).mul(duty).add(T.clamp(T.fract(x).sub(T.float(1.0).sub(duty).mul(0.5)), 0.0, duty));
  const dashes = onSoFar(t.add(footprint.mul(0.5))).sub(onSoFar(t.sub(footprint.mul(0.5)))).div(footprint);

  const xz = asTsl(worldPatternPosition(THREE)).xz;
  const detail = T.smoothstep(70.0, 15.0, T.length(T.positionWorld.sub(T.cameraPosition)));
  const wear = T.mix(T.float(0.5), noise2D(xz.mul(0.8)).mul(0.6).add(noise2D(xz.mul(2.3)).mul(0.4)), detail);
  mat.opacityNode = asNode(dashes.mul(T.varying(T.float(1.0).div(widen))).mul(T.smoothstep(0.1, 0.6, wear).mul(0.4).add(0.55)));

  const wet = roadWetMasks(T, asTsl(uniforms.uRoadWetness), roadPuddleField(THREE, xz.x, xz.y));
  mat.colorNode = asColorNode(T.vec3(T.mix(T.float(1.0), T.float(0.72), wet.y).mul(T.mix(T.float(1.0), T.float(0.86), wet.z))));
  mat.roughnessNode = asNode(T.mix(T.mix(T.float(0.62), T.float(0.42), wet.z), T.float(0.2), wet.y));
  mat.name = 'physical:road-paint';
  return mat;
}

/** The paint as one mesh over the road layer (drawn after the asphalt, before other see-through ground effects). */
export function createRoadPaintMesh(THREE: Three, arrays: RoadPaintArrays, material: InstanceType<Three['Material']>): InstanceType<Three['Mesh']> {
  const geometry = new THREE.BufferGeometry();
  const normal = new Float32Array(arrays.position.length);
  for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
  geometry.setAttribute('position', new THREE.BufferAttribute(arrays.position, 3));
  if (arrays.position64) geometry.userData.position64 = arrays.position64;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(arrays.color, 3));
  geometry.setAttribute('side', new THREE.BufferAttribute(arrays.side, 2));
  geometry.setAttribute('paint', new THREE.BufferAttribute(arrays.paint, 3));
  geometry.setIndex(new THREE.BufferAttribute(arrays.index, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'physical:road-paint';
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
