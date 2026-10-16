// Bakes the tile into a handful of meshes, one per material: facades
// (masonry and glass), roofs, contact shadows, land-use areas, sidewalks,
// roads and landmark accents. Every building, road and area lands in a
// shared vertex buffer, so draw calls stay flat as the feature count grows
// (metro-live's mergeByMaterial, applied while building).
import type { Three } from '@acme/ui/three';
import type { BuildingClass, CityBuilding, CityDatasetV2, CityLandmark, CityRoad, RoadClass } from '../city-dataset.ts';
import { counterClockwise, hashUnit, mapArea, pairs, ribbon, VertexBuffer } from './geometry.ts';
import type { CityMaterials } from './materials.ts';
import { CITY_COLORS, hexToRgb, type CityColor } from './palette.ts';

type Point = [number, number];
type Mesh = InstanceType<Three['Mesh']>;

/** Ground-plane layers, metres. Small enough to vanish next to a 1.8 m Caller; polygon offset does the rest. */
export const LAYER = { areas: 0.02, sidewalks: 0.04, roads: 0.06, shadows: 0.08 } as const;

const rgb = (key: CityColor) => hexToRgb(CITY_COLORS[key]);
const tint = (color: readonly number[], amount: number) => color.map((v) => Math.max(0, Math.min(1, v * amount)));

const WALL_COLOR: Record<BuildingClass, CityColor> = {
  brownstone: 'brownstone', brick: 'brick', glass: 'glass', nycha: 'nycha', church: 'church', civic: 'civic', plain: 'plain',
};
const WALKWAY_CLASSES: ReadonlySet<RoadClass> = new Set(['footway', 'sidewalk', 'cycleway', 'pedestrian']);
const CENTRE_LINE_MIN_WIDTH = 9;

/** Triangulate a ring (with holes) and emit it facing up at height y, counter-clockwise on the map. */
function emitFlat(THREE: Three, buffer: VertexBuffer, ring: Point[], holes: Point[][], y: number, color: readonly number[]): void {
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  const holeVectors = holes.map((hole) => hole.map(([x, z]) => new THREE.Vector2(x, z)));
  const all = [...ring, ...holes.flat()];
  const faces = THREE.ShapeUtils.triangulateShape(contour, holeVectors);
  for (const face of faces) {
    let [a, b, c] = face.map((i) => all[i]!) as [Point, Point, Point];
    if (!a || !b || !c) continue;
    if (mapArea([a, b, c]) < 0) [b, c] = [c, b];
    for (const [x, z] of [a, b, c]) buffer.vertex(x, y, z, 0, 1, 0, color, x, z);
  }
}

/** Walls around a ring. Outer rings counter-clockwise on the map, holes clockwise, so normals face out of the solid. */
function emitWalls(buffer: VertexBuffer, ring: Point[], bottom: number, top: number, color: readonly number[], outward = 0): void {
  let along = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-6) continue;
    // Right of travel on a north-up map, in scene axes (x east, z south).
    const nx = -(bz - az) / length;
    const nz = (bx - ax) / length;
    const ox = nx * outward;
    const oz = nz * outward;
    buffer.quad(
      [ax + ox, bottom, az + oz], [bx + ox, bottom, bz + oz], [bx + ox, top, bz + oz], [ax + ox, top, az + oz],
      [nx, 0, nz], color,
      [[along, bottom], [along + length, bottom], [along + length, top], [along, top]],
    );
    along += length;
  }
}

/** A soft contact-shadow strip from the wall out to `reach` metres, nudged away from the sun. */
function emitShadow(buffer: VertexBuffer, ring: Point[], reach: number, sunAway: Point, color: readonly number[]): void {
  const n = ring.length;
  const outer: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [px, pz] = ring[(i + n - 1) % n]!;
    const [x, z] = ring[i]!;
    const [qx, qz] = ring[(i + 1) % n]!;
    const n1 = normalOf(px, pz, x, z);
    const n2 = normalOf(x, z, qx, qz);
    let mx = n1[0] + n2[0];
    let mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const scale = reach / Math.max(0.45, mx * n1[0] + mz * n1[1]);
    // Push the outer edge further on the side facing away from the sun.
    const lean = Math.max(0, mx * sunAway[0] + mz * sunAway[1]) * reach * 0.8;
    outer.push([x + mx * scale + sunAway[0] * lean, z + mz * scale + sunAway[1] * lean]);
  }
  const y = LAYER.shadows;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    const [cx, cz] = outer[j]!;
    const [dx, dz] = outer[i]!;
    buffer.quad([ax, y, az], [bx, y, bz], [cx, y, cz], [dx, y, dz], [0, 1, 0], color, [[0, 0], [0, 0], [0, 1], [0, 1]]);
  }
}

function normalOf(ax: number, az: number, bx: number, bz: number): Point {
  const length = Math.hypot(bx - ax, bz - az) || 1;
  return [-(bz - az) / length, (bx - ax) / length];
}

/** A box from its centre, facing direction (unit, scene x/z), width, depth and vertical span. */
function emitBox(buffer: VertexBuffer, cx: number, cz: number, dir: Point, width: number, depth: number, bottom: number, top: number, color: readonly number[]): void {
  const [fx, fz] = dir;
  const rx = -fz; const rz = fx; // across the facade
  const hw = width / 2; const hd = depth / 2;
  const corner = (s: number, t: number): Point => [cx + rx * hw * s + fx * hd * t, cz + rz * hw * s + fz * hd * t];
  const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  const ccw = counterClockwise(ring);
  emitWalls(buffer, ccw, bottom, top, color);
  for (const y of [top, bottom]) {
    const [a, b, c, d] = ccw as [Point, Point, Point, Point];
    const face = y === top ? [a, b, c, d] : [a, d, c, b];
    buffer.quad(
      [face[0]![0], y, face[0]![1]], [face[1]![0], y, face[1]![1]], [face[2]![0], y, face[2]![1]], [face[3]![0], y, face[3]![1]],
      [0, y === top ? 1 : -1, 0], color,
    );
  }
}

/** The footprint edge facing the nearest road, as midpoint, outward direction and length. */
function streetFace(ring: Point[], roads: readonly CityRoad[]): { mid: Point; out: Point; length: number } | null {
  let best: { mid: Point; out: Point; length: number } | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 4) continue;
    const mid: Point = [(ax + bx) / 2, (az + bz) / 2];
    const out = normalOf(ax, az, bx, bz);
    const probe: Point = [mid[0] + out[0] * 8, mid[1] + out[1] * 8];
    let near = Infinity;
    for (const road of roads) {
      if (WALKWAY_CLASSES.has(road.class) || road.class === 'service' || road.class === 'crossing') continue;
      const p = road.points;
      for (let k = 2; k < p.length; k += 2) {
        const d = segmentDistance(probe[0], probe[1], p[k - 2]!, p[k - 1]!, p[k]!, p[k + 1]!);
        if (d < near) near = d;
      }
    }
    // Prefer close, long edges: the frontage, not a side wall.
    const score = near - length * 0.3;
    if (score < bestScore) { bestScore = score; best = { mid, out, length }; }
  }
  return best;
}

function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax; const dz = bz - az;
  const len = dx * dx + dz * dz;
  const t = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len)) : 0;
  return Math.hypot(ax + dx * t - x, az + dz * t - z);
}

function landmarkAccents(buffer: VertexBuffer, landmark: CityLandmark, building: CityBuilding, ring: Point[], roads: readonly CityRoad[]): void {
  const face = streetFace(ring, roads);
  const h = building.heightMeters;
  switch (landmark.key) {
    case 'apollo-theater': {
      if (!face) return;
      // Marquee band over the entrance and the tall blade sign beside it (no lettering).
      const width = Math.min(face.length * 0.8, 16);
      const [mx, mz] = face.mid;
      const [ox, oz] = face.out;
      emitBox(buffer, mx + ox * 0.9, mz + oz * 0.9, face.out, width, 1.8, 4.2, 5.6, rgb('marquee'));
      emitBox(buffer, mx + ox * 1.85, mz + oz * 1.85, face.out, width + 0.2, 0.12, 4.35, 5.45, rgb('marqueeLights'));
      const across: Point = [-oz, ox];
      const side = width * 0.32;
      emitBox(buffer, mx + across[0] * side + ox * 1.5, mz + across[1] * side + oz * 1.5, across, 0.5, 2.6, 6, Math.min(h + 2, 17), rgb('marquee'));
      return;
    }
    case 'hotel-theresa':
      // A pale crown band at the cornice; the walls already take the terracotta colour.
      emitWalls(buffer, ring, h - 1.6, h - 0.4, rgb('marqueeLights'), 0.08);
      return;
    case 'acp-state-office':
      emitWalls(buffer, ring, h - 1.2, h - 0.5, rgb('beacon'), 0.08);
      return;
  }
}

export interface CityMeshStats { buildings: number; roads: number; areas: number; triangles: number; drawCalls: number }

export function buildCityMeshes(THREE: Three, dataset: CityDatasetV2, materials: CityMaterials, sunAway: Point) {
  const masonry = new VertexBuffer();
  const glass = new VertexBuffer();
  const roofs = new VertexBuffer();
  const shadows = new VertexBuffer();
  const areas = new VertexBuffer();
  const sidewalks = new VertexBuffer();
  const roads = new VertexBuffer();
  const accents = new VertexBuffer();
  const landmarkByBuilding = new Map(dataset.landmarks.map((l) => [l.buildingId, l]));
  const shadowColor = rgb('shadow');

  for (const building of dataset.buildings) {
    const ring = counterClockwise(pairs(building.ring));
    const holes = building.holes.map((hole) => counterClockwise(pairs(hole)).reverse());
    const landmark = landmarkByBuilding.get(building.id);
    const variation = 0.92 + hashUnit(building.id) * 0.16;
    const wallKey: CityColor = landmark?.key === 'hotel-theresa' ? 'terracotta' : WALL_COLOR[building.class];
    const wall = tint(rgb(wallKey), variation);
    const target = building.class === 'glass' ? glass : masonry;
    const h = building.heightMeters;
    emitWalls(target, ring, 0, h, wall);
    for (const hole of holes) emitWalls(target, hole, 0, h, wall);
    const roofColor = tint(rgb('roof').map((v, i) => v * 0.8 + wall[i]! * 0.2), variation);
    emitFlat(THREE, roofs, ring, holes, h, roofColor);
    emitShadow(shadows, ring, Math.max(1.2, Math.min(5, h * 0.12)), sunAway, shadowColor);
    if (landmark) landmarkAccents(accents, landmark, building, ring, dataset.roads);
  }

  const areaColor: Record<string, CityColor> = {
    park: 'park', garden: 'garden', grass: 'grass', pitch: 'pitch', playground: 'playground',
    plaza: 'plaza', parking: 'parking', water: 'water', school: 'school',
  };
  // Draw order inside one mesh follows array order at equal depth; put big lawns first so pitches sit on them.
  const order = ['school', 'parking', 'park', 'garden', 'grass', 'plaza', 'pitch', 'playground', 'water'];
  const sortedAreas = [...dataset.areas].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  sortedAreas.forEach((area, index) => {
    const ring = counterClockwise(pairs(area.ring));
    const holes = area.holes.map((hole) => pairs(hole));
    emitFlat(THREE, areas, ring, holes, LAYER.areas + index * 1e-5, rgb(areaColor[area.kind] ?? 'grass'));
  });

  for (const road of dataset.roads) {
    const points = pairs(road.points);
    if (WALKWAY_CLASSES.has(road.class)) {
      const color = road.class === 'pedestrian' ? rgb('plaza') : rgb('sidewalk');
      strip(sidewalks, points, road.widthMeters / 2, LAYER.sidewalks, color);
      continue;
    }
    if (road.sidewalkMeters > 0) strip(sidewalks, points, road.widthMeters / 2 + road.sidewalkMeters, LAYER.sidewalks, rgb('sidewalk'));
    const zebra = road.class === 'crossing' ? 1 : 0;
    const centre = !zebra && road.widthMeters >= CENTRE_LINE_MIN_WIDTH ? 1 : 0;
    // Crossings sit a hair above the street they cross.
    const y = LAYER.roads + (zebra ? 0.005 : 0);
    strip(roads, points, road.widthMeters / 2, y, [centre, zebra, road.widthMeters / 100]);
  }

  const meshes: Mesh[] = [];
  const add = (name: string, buffer: VertexBuffer, material: InstanceType<Three['Material']>, renderOrder = 0) => {
    if (buffer.vertexCount === 0) return;
    const mesh = new THREE.Mesh(buffer.toGeometry(THREE), material);
    mesh.name = name;
    mesh.renderOrder = renderOrder;
    mesh.matrixAutoUpdate = false;
    meshes.push(mesh);
  };
  add('city:areas', areas, materials.areas);
  add('city:sidewalks', sidewalks, materials.sidewalks);
  add('city:roads', roads, materials.roads);
  add('city:walls-masonry', masonry, materials.masonry);
  add('city:walls-glass', glass, materials.glass);
  add('city:roofs', roofs, materials.roofs);
  add('city:landmarks', accents, materials.accents);
  // Transparent, after the opaque city.
  add('city:contact-shadows', shadows, materials.shadows, 2);

  const triangles = meshes.reduce((sum, m) => sum + m.geometry.getAttribute('position').count / 3, 0);
  const stats: CityMeshStats = {
    buildings: dataset.buildings.length, roads: dataset.roads.length, areas: dataset.areas.length,
    triangles, drawCalls: meshes.length,
  };
  return {
    meshes,
    stats,
    dispose: () => { for (const mesh of meshes) mesh.geometry.dispose(); },
  };
}

/** A flat ribbon along a polyline; u runs across (0..1), v along in metres. */
function strip(buffer: VertexBuffer, points: Point[], half: number, y: number, color: readonly number[]): void {
  if (points.length < 2) return;
  const { left, right, v } = ribbon(points, half);
  for (let i = 1; i < points.length; i++) {
    const a = left[i - 1]!; const b = left[i]!; const c = right[i]!; const d = right[i - 1]!;
    // Ordered so the face is counter-clockwise on the map (front side up).
    const quad: [Point, Point, Point, Point] = [d, c, b, a];
    const uvs = [[1, v[i - 1]!], [1, v[i]!], [0, v[i]!], [0, v[i - 1]!]];
    const area = mapArea(quad);
    const ordered = area >= 0 ? quad : ([a, b, c, d] as [Point, Point, Point, Point]);
    const orderedUv = area >= 0 ? uvs : [[0, v[i - 1]!], [0, v[i]!], [1, v[i]!], [1, v[i - 1]!]];
    buffer.quad(
      [ordered[0][0], y, ordered[0][1]], [ordered[1][0], y, ordered[1][1]], [ordered[2][0], y, ordered[2][1]], [ordered[3][0], y, ordered[3][1]],
      [0, 1, 0], color, orderedUv,
    );
  }
}
