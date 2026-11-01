// The small street things, as merged and instanced meshes:
//
// - city:street-props: hydrants, wire litter baskets and bike racks, merged
//   and written in z bands, drawn only near the Caller (one draw range)
// - city:transit and city:transit-lights: subway entrances (iron railings,
//   the stair well, the green globe lamps), bus shelters (posts, roof,
//   glass, a lit ad panel with no artwork) and LinkNYC kiosks (a slim
//   monolith with two lit faces) at their record positions
// - city:cars (vd lane off): parked cars and taxis, one InstancedMesh of box
//   cars whose instance list follows the Caller (preallocated, rebuilt after
//   a 10 m move)
// - city:cars-vd-<car>[-mid|-far] (vd lane, the default): every parked car
//   in CAR_RADIUS is a Valdrada baked body (vd-car-mesh.ts), one
//   InstancedMesh per body and detail level. The nearest VD_PARKED_CAP inside
//   VD_PARKED_RADIUS draw the full body; the rest out to VD_PARKED_MID_RADIUS draw the
//   `mid` decimation, and out to CAR_RADIUS the `far` one. No box car is
//   built. Same material, same instance tone. Each is a Mesh over an
//   InstancedBufferGeometry with the transform in `vdXform`
//   (vd-instanced.ts), so the eighteen share one node build and pipeline.
//
// Layout and the clearance rules are street-props-layout.ts. Where the v3
// tile carries record furniture (`dataset.furniture`), the records place
// the props: the rule-spaced hydrants below are the fallback for tiles
// without records — the same record-or-hash rule city-mesh.ts follows.
// The pedestrian sim already avoids these points as obstacles
// (living-city/bundled-host.ts bundledObstacles), so drawing them also
// makes the crowd's detours legible.
import type { Three } from '@acme/ui/three';
import { CURB_HEIGHT, VD_LANE } from './curb.ts';
import type { CityDatasetV3 } from '../city-dataset.ts';
import { SHADOW_BAND_METRES } from './city-mesh.ts';
import { VertexBuffer } from './geometry.ts';
import { TONE_ATTRIBUTE, type CityMaterials } from './materials.ts';
import { CAR_TONES, CITY_COLORS, hexToRgb, type CityColor } from './palette.ts';
import { BandedBuffer, box, cone, cylinder, frame, type Frame } from './parts.ts';
import type { LightPlacement, SignPlacement } from './signage.ts';
import {
  CAR_LENGTH, CAR_WIDTH, placeAtKerb, placeBaskets, placeHydrants, placeParkedCars, placeRecordProps, type CarPlacement,
  type PropPlacement,
} from './street-props-layout.ts';
import { SURFACES, surfaceMid } from './surfaces.ts';
import { pickWithin, TREE_REFRESH_METRES } from './tree-lod.ts';
import type { StreetClearance } from './walkability.ts';
import { VD_LODS, vdCarHash, vdParkedCarLodGeometries, type VdCarId, type VdLod } from './vd-car-mesh.ts';
import { VD_XFORM_ATTRIBUTE, vdInstancedGeometry, vdXformPositionNode, writeVdXform } from './vd-instanced.ts';

const rgb = (key: CityColor) => hexToRgb(CITY_COLORS[key]);
/** Body paint marker: vertices coloured below zero take the instance tone (materials.ts `cars`). */
const PAINT = [-1, -1, -1] as const;

export const CAR_RADIUS = 200;
export const CAR_CAP = 220;
/** vd lane: parked cars this close to the Caller may draw the full baked body. */
export const VD_PARKED_RADIUS = 40;
/**
 * At most this many full bodies, about 4.5k triangles each. budget.test.ts at the Apollo spawn put 13 bodies (cap 40) at 48.6k
 * triangles against a 320k frame budget the vd trees already exceed (2026-10-28), so the cap is the fleet's high-tier
 * near count. Cars past the cap draw the same body's `mid` decimation (~600 triangles), never a box.
 */
export const VD_PARKED_CAP = 12;
/** vd lane: out to here the `mid` decimation, past it (to CAR_RADIUS) the `far` one (~150 triangles). */
export const VD_PARKED_MID_RADIUS = 90;
/** Parked bodies, with the share each takes of the non-taxi slots. Taxis are the TLC cab, a quarter of them a yellow sedan. */
const VD_PARKED_SHARE: readonly (readonly [VdCarId, number])[] = [['lincoln', 0.3], ['suv', 0.25], ['mercedes', 0.2], ['charger', 0.15], ['van', 0.1]];
export const VD_PARKED_CARS: readonly VdCarId[] = ['lincoln', 'suv', 'mercedes', 'charger', 'van', 'taxinv200'];

/** Which baked body parked car `i` wears: deterministic per slot. */
export function vdParkedCar(i: number, taxi: boolean): VdCarId {
  const h = vdCarHash(i);
  if (taxi) return h < 0.75 ? 'taxinv200' : 'lincoln';
  let acc = 0;
  for (const [id, share] of VD_PARKED_SHARE) { acc += share; if (h < acc) return id; }
  return 'lincoln';
}

/**
 * Makes the parked-car material the vd bodies' (it is only theirs under vd): the transform comes from vdXform, and it
 * draws double-sided, as the fleet's does (living-city/vd-car-material.ts), so a gap the clustered `mid` and `far`
 * levels leave in a panel shows the panel behind it instead of the street (vd-car-draw.test.ts).
 */
export function vdParkedCarMaterial(THREE: Three, material: CityMaterials['cars']): void {
  (material as unknown as { positionNode: unknown }).positionNode = vdXformPositionNode(THREE);
  material.side = THREE.DoubleSide;
}

/** Every street prop for a tile, after the clearance. Pure apart from the clearance. */
export function placeStreetProps(dataset: CityDatasetV3, clearance: StreetClearance, signs: readonly SignPlacement[], lights: readonly LightPlacement[]) {
  // Hydrants: the DOT records where the tile carries them, the kerb-spacing
  // rule where it does not. Records still clear the streetlight poles.
  const recordHydrants = dataset.furniture.hydrant.length >= 3 ? placeRecordProps(dataset.furniture.hydrant, clearance, 2.5) : null;
  const hydrants = recordHydrants
    ? recordHydrants.placed.filter((p) => !lights.some((l) => Math.abs(l.x - p.x) < 2 && Math.abs(l.z - p.z) < 2))
    : placeHydrants(dataset, clearance, lights);
  const hydrantLampDrops = recordHydrants ? recordHydrants.placed.length - hydrants.length : 0;
  const baskets = placeBaskets(dataset, clearance, signs);
  const cars = placeParkedCars(dataset, clearance, hydrants);
  const subway = placeAtKerb(dataset.transit.subway, clearance);
  const shelters = placeAtKerb(dataset.transit.shelters, clearance);
  const linknyc = placeRecordProps(dataset.furniture.linknyc, clearance, 3);
  const bikeRacks = placeRecordProps(dataset.furniture.bikeRack, clearance, 2.5);
  // A shelter needs its whole footprint on the sidewalk; one that cannot fit is left out.
  const fits = (p: PropPlacement, halfLength: number, depth: number) => {
    const f = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
    for (const [lx, lz] of [[-halfLength, -depth], [halfLength, -depth], [-halfLength, depth], [halfLength, depth]] as const) {
      const x = f.x + f.oz * lx + f.ox * lz; const z = f.z - f.ox * lx + f.oz * lz;
      if (!clearance.standable(x, z)) return false;
    }
    return true;
  };
  // Nudge across the sidewalk (toward the buildings first) before giving up on a spot.
  const settle = (list: readonly PropPlacement[], halfLength: number, depth: number) => {
    const out: PropPlacement[] = [];
    for (const p of list) {
      for (const shift of [0, -0.5, -1, 0.5]) {
        const moved = { ...p, x: p.x + p.toRoad[0] * shift, z: p.z + p.toRoad[1] * shift };
        if (fits(moved, halfLength, depth)) { out.push(moved); break; }
      }
    }
    return out;
  };
  const subwayFit = settle(subway.placed, 2.1, 0.9);
  const shelterFit = settle(shelters.placed, 1.95, 0.85);
  const linknycFit = settle(linknyc.placed, 0.65, 0.3);
  const rackFit = settle(bikeRacks.placed, 0.45, 0.2);
  return {
    hydrants, baskets, cars,
    subway: subwayFit, shelters: shelterFit, linknyc: linknycFit, bikeRacks: rackFit,
    report: {
      subwayMoved: subway.moved, subwayDropped: subway.dropped + subway.placed.length - subwayFit.length,
      sheltersMoved: shelters.moved, sheltersDropped: shelters.dropped + shelters.placed.length - shelterFit.length,
      linknycMoved: linknyc.moved, linknycDropped: linknyc.dropped + linknyc.placed.length - linknycFit.length,
      bikeRacksMoved: bikeRacks.moved, bikeRacksDropped: bikeRacks.dropped + bikeRacks.placed.length - rackFit.length,
      hydrantsFromRecords: recordHydrants !== null,
      recordHydrantsMoved: recordHydrants?.moved ?? 0,
      recordHydrantsDropped: (recordHydrants?.dropped ?? 0) + hydrantLampDrops,
    },
  };
}

function emitHydrant(buffer: VertexBuffer, p: PropPlacement): void {
  const f = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  buffer.surface(...SURFACES.iron);
  const body = rgb('hydrant');
  const cap = rgb('hydrantCap');
  cylinder(buffer, f, 0, 0, 0.13, 0, 0.62, 6, body);
  cone(buffer, f, 0, 0, 0.15, 0.62, 0.8, 6, cap);
  box(buffer, f, [-0.24, 0.38, -0.06], [0.24, 0.5, 0.06], body, { skip: ['bottom'] });
  box(buffer, f, [-0.06, 0.38, 0], [0.06, 0.5, 0.2], cap, { skip: ['back', 'bottom'] });
}

function emitBasket(buffer: VertexBuffer, p: PropPlacement): void {
  const f = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  buffer.surface(...SURFACES.iron);
  cylinder(buffer, f, 0, 0, 0.27, 0, 0.82, 8, rgb('basket'));
  cylinder(buffer, f, 0, 0, 0.3, 0.78, 0.86, 8, rgb('iron'));
}

/** Stairs down along the kerb, iron railings round three sides, green globe lamps on the open end. */
function emitSubwayEntrance(structure: VertexBuffer, lights: VertexBuffer, p: PropPlacement): void {
  const f: Frame = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  const rail = rgb('subwayRail');
  structure.surface(...SURFACES.stone);
  box(structure, f, [-2.0, 0, -0.8], [2.0, 0.03, 0.8], rgb('shadow'), { skip: ['bottom'] });
  structure.surface(...SURFACES.iron);
  for (const z of [-0.85, 0.85]) box(structure, f, [-2.0, 0, z - 0.04], [1.9, 1.0, z + 0.04], rail, { skip: ['bottom'] });
  box(structure, f, [-2.05, 0, -0.85], [-1.97, 1.0, 0.85], rail, { skip: ['bottom'] });
  for (const z of [-0.85, 0.85]) {
    box(structure, f, [1.86, 0, z - 0.05], [1.96, 2.5, z + 0.05], rail, { skip: ['bottom'] });
    cylinder(lights, f, 1.91, z, 0.17, 2.5, 2.82, 8, rgb('subwayGlobe'));
    cone(lights, f, 1.91, z, 0.17, 2.82, 2.96, 8, rgb('subwayGlobe'));
  }
}

/**
 * A LinkNYC kiosk at its record spot: the slim steel monolith (~3.1 m, a
 * metre wide along the kerb) with its two lit display faces — one toward
 * the carriageway, one toward the sidewalk. Structure lands in the transit
 * mesh, the lit faces in the shared neon-lit buffer (no new draw calls).
 */
function emitLinkNyc(structure: VertexBuffer, glow: VertexBuffer, p: PropPlacement): void {
  const f: Frame = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  const steel = rgb('shelterFrame');
  structure.surface(...SURFACES.iron);
  box(structure, f, [-0.6, 0, -0.14], [0.6, 2.92, 0.14], steel, { skip: ['bottom'] });
  box(structure, f, [-0.63, 2.92, -0.17], [0.63, 3.08, 0.17], steel, { skip: ['bottom'] });
  box(structure, f, [-0.44, 0, -0.09], [0.44, 0.09, 0.09], rgb('iron'), { skip: ['top'] });
  // The two display panels sit proud of the slab, lit like the shelter's ad face.
  box(glow, f, [-0.5, 0.95, -0.175], [0.5, 2.6, -0.14], rgb('neonCarolina'), { skip: ['front', 'left', 'right', 'top', 'bottom'] });
  box(glow, f, [-0.5, 0.95, 0.14], [0.5, 2.6, 0.175], rgb('neonCarolina'), { skip: ['back', 'left', 'right', 'top', 'bottom'] });
}

/** A DOT bike rack — the standard inverted-U hoop — standing along the kerb. */
function emitBikeRack(buffer: VertexBuffer, p: PropPlacement): void {
  const f = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  const steel = rgb('shelterFrame');
  buffer.surface(...SURFACES.iron);
  for (const x of [-0.35, 0.35]) box(buffer, f, [x - 0.03, 0, -0.03], [x + 0.03, 0.78, 0.03], steel, { skip: ['bottom'] });
  box(buffer, f, [-0.38, 0.78, -0.03], [0.38, 0.86, 0.03], steel, { skip: ['bottom'] });
}

/** A glass bus shelter with its back to the buildings, a bench and a lit ad panel at one end. */
function emitShelter(structure: VertexBuffer, lights: VertexBuffer, p: PropPlacement): void {
  const f: Frame = frame(p.x, p.z, p.toRoad, CURB_HEIGHT);
  const steel = rgb('shelterFrame');
  const glassTone = rgb('shelterGlass');
  structure.surface(...SURFACES.iron);
  for (const x of [-1.85, 1.85]) for (const z of [-0.72, 0.62]) box(structure, f, [x - 0.04, 0, z - 0.04], [x + 0.04, 2.4, z + 0.04], steel, { skip: ['bottom', 'top'] });
  box(structure, f, [-1.95, 2.4, -0.82], [1.95, 2.52, 0.8], steel, {});
  structure.surface(...surfaceMid('storefront'));
  box(structure, f, [-1.8, 0.15, -0.73], [1.8, 2.3, -0.69], glassTone, { skip: ['bottom', 'top'] });
  box(structure, f, [-1.87, 0.15, -0.68], [-1.83, 2.3, 0.45], glassTone, { skip: ['bottom', 'top'] });
  structure.surface(...SURFACES.iron);
  box(structure, f, [-1.4, 0.42, -0.65], [1.0, 0.48, -0.3], steel, { skip: ['bottom'] });
  box(lights, f, [1.8, 0.25, -0.68], [1.9, 2.15, 0.45], rgb('neonCarolina'), { skip: ['bottom', 'top'] });
}

/** One car, length along local x: body (paint), glasshouse, four tyres, a roof lamp that takes the paint too. */
function carGeometry(THREE: Three) {
  const buffer = new VertexBuffer();
  const f = frame(0, 0, [0, 1]);
  const hl = CAR_LENGTH / 2; const hw = CAR_WIDTH / 2;
  // Paint, glasshouse and tyres are different surfaces — the PBR lane reads
  // them off the aRoughMetal attribute the boxes are stamped with.
  buffer.surface(...SURFACES.carPaint);
  box(buffer, f, [-hl, 0.32, -hw], [hl, 0.95, hw], PAINT, { skip: ['bottom'] });
  buffer.surface(...SURFACES.carGlass);
  box(buffer, f, [-1.15, 0.95, -hw + 0.12], [1.05, 1.45, hw - 0.12], rgb('carGlass'), { skip: ['bottom'] });
  buffer.surface(...SURFACES.carPaint);
  box(buffer, f, [-0.25, 1.45, -0.2], [0.25, 1.6, 0.2], PAINT, { skip: ['bottom'] });
  buffer.surface(...SURFACES.tyre);
  for (const x of [-1.45, 1.45]) for (const s of [-1, 1]) {
    box(buffer, f, [x - 0.33, 0, s > 0 ? hw - 0.24 : -hw - 0.02], [x + 0.33, 0.64, s > 0 ? hw + 0.02 : -hw + 0.24], rgb('tyre'), { skip: ['bottom', 'top'] });
  }
  return buffer.toGeometry(THREE);
}

export function buildStreetProps(
  THREE: Three, dataset: CityDatasetV3, materials: Pick<CityMaterials, 'roofs' | 'neon' | 'cars'>,
  clearance: StreetClearance, signs: readonly SignPlacement[], lights: readonly LightPlacement[],
  vd: boolean = VD_LANE,
) {
  const placed = placeStreetProps(dataset, clearance, signs, lights);

  // Hydrants and baskets in z bands.
  const minZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);
  const bandOf = (z: number) => Math.max(0, Math.min(bandCount - 1, Math.floor((z - minZ) / SHADOW_BAND_METRES)));
  const kerb = [
    ...placed.hydrants.map((p) => ({ p, emit: emitHydrant })),
    ...placed.baskets.map((p) => ({ p, emit: emitBasket })),
    ...placed.bikeRacks.map((p) => ({ p, emit: emitBikeRack })),
  ].sort((a, b) => bandOf(a.p.z) - bandOf(b.p.z));
  const props = new BandedBuffer();
  for (const { p, emit } of kerb) { props.mark(bandOf(p.z)); emit(props.buffer, p); }
  const propStart = props.finish(bandCount);

  const structure = new VertexBuffer();
  const glow = new VertexBuffer();
  for (const p of placed.subway) emitSubwayEntrance(structure, glow, p);
  for (const p of placed.shelters) emitShelter(structure, glow, p);
  for (const p of placed.linknyc) emitLinkNyc(structure, glow, p);

  const objects: InstanceType<Three['Mesh']>[] = [];
  const mesh = (name: string, buffer: VertexBuffer, material: InstanceType<Three['Material']>) => {
    if (buffer.vertexCount === 0) return null;
    const m = new THREE.Mesh(buffer.toGeometry(THREE), material);
    m.name = name;
    m.matrixAutoUpdate = false;
    objects.push(m);
    return m;
  };
  const propMesh = mesh('city:street-props', props.buffer, materials.roofs);
  if (propMesh) propMesh.frustumCulled = false;
  mesh('city:transit', structure, materials.roofs);
  mesh('city:transit-lights', glow, materials.neon);

  // Parked cars and taxis: source rows once, the near ones copied into the instance buffers as the Caller walks.
  const n = placed.cars.length;
  const sourceMatrices = new Float32Array(Math.max(1, n) * 16);
  const sourceTones = new Float32Array(Math.max(1, n) * 3);
  const xs = new Float32Array(n);
  const zs = new Float32Array(n);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const sourceYaw = new Float32Array(n);
  placed.cars.forEach((car: CarPlacement, i) => {
    sourceYaw[i] = Math.atan2(-car.dir[1], car.dir[0]);
    q.setFromAxisAngle(up, sourceYaw[i]!);
    matrix.compose(pos.set(car.x, 0, car.z), q, one).toArray(sourceMatrices, i * 16);
    const tone = car.taxi ? rgb('taxi') : rgb(CAR_TONES[Math.floor(car.tone * CAR_TONES.length) % CAR_TONES.length]!);
    sourceTones.set(tone, i * 3);
    xs[i] = car.x;
    zs[i] = car.z;
  });
  const capacity = Math.max(1, Math.min(CAR_CAP, n));
  const ids = new Int32Array(capacity);
  const scratch = new Float32Array(n);

  // vd off: the box cars. vd on: none.
  let cars: InstanceType<Three['InstancedMesh']> | null = null;
  let tones: InstanceType<Three['InstancedBufferAttribute']> | null = null;
  if (!vd) {
    const carGeo = carGeometry(THREE);
    cars = new THREE.InstancedMesh(carGeo, materials.cars, capacity);
    cars.name = 'city:cars';
    cars.count = 0;
    cars.frustumCulled = false;
    tones = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    carGeo.setAttribute(TONE_ATTRIBUTE, tones);
    objects.push(cars);
  }

  // vd on: one instanced Mesh per baked body and detail level (vd-instanced.ts); a car's body is fixed per slot at build.
  type Mesh = InstanceType<Three['Mesh']>;
  type InstancedGeometry = InstanceType<Three['InstancedBufferGeometry']>;
  interface VdParked {
    readonly mesh: Mesh;
    readonly geometry: InstancedGeometry;
    readonly buffer: InstanceType<Three['InstancedInterleavedBuffer']>;
    readonly stride: number;
    readonly toneAt: number;
    readonly xformAt: number;
    readonly cap: number;
    count: number;
  }
  const vdMeshes: VdParked[] = [];
  /** vdSlots[body][lod] -> index into vdMeshes. */
  const vdSlots: Record<VdLod, number>[] = [];
  const vdKindOf = new Uint8Array(n);
  if (vd && n > 0) {
    vdParkedCarMaterial(THREE, materials.cars);
    const used = new Set<VdCarId>();
    placed.cars.forEach((car, i) => used.add(vdParkedCar(i, car.taxi)));
    const slotOf = new Map<VdCarId, number>();
    for (const id of VD_PARKED_CARS) {
      if (!used.has(id)) continue;
      const geometries = vdParkedCarLodGeometries(THREE, id);
      const slots = {} as Record<VdLod, number>;
      for (const lod of VD_LODS) {
        // The near level stops at VD_PARKED_CAP in setFocus.
        const cap = capacity;
        const made = vdInstancedGeometry(THREE, geometries[lod], cap, [[VD_XFORM_ATTRIBUTE, 4], [TONE_ATTRIBUTE, 3]]);
        const mesh = new THREE.Mesh(made.geometry, materials.cars);
        mesh.name = lod === 'near' ? `city:cars-vd-${id}` : `city:cars-vd-${id}-${lod}`;
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        // Past VD_PARKED_MID_RADIUS a car's sun shadow is a few pixels: the far level skips the caster pass.
        if (lod === 'far') mesh.userData.noSunShadow = true;
        slots[lod] = vdMeshes.length;
        vdMeshes.push({
          mesh, geometry: made.geometry, buffer: made.buffer, stride: made.stride,
          toneAt: made.offsets[TONE_ATTRIBUTE]!, xformAt: made.offsets[VD_XFORM_ATTRIBUTE]!, cap, count: 0,
        });
        objects.push(mesh);
      }
      slotOf.set(id, vdSlots.length);
      vdSlots.push(slots);
    }
    placed.cars.forEach((car, i) => { vdKindOf[i] = slotOf.get(vdParkedCar(i, car.taxi))!; });
  }
  const vdR2 = VD_PARKED_RADIUS * VD_PARKED_RADIUS;
  const midR2 = VD_PARKED_MID_RADIUS * VD_PARKED_MID_RADIUS;
  let near = true; // meshes start visible; setDistance keeps them in step
  let lastX = Number.NaN;
  let lastZ = Number.NaN;
  const shown: [number, number] = [-1, -1];

  return {
    objects,
    stats: {
      hydrants: placed.hydrants.length, baskets: placed.baskets.length, cars: n, taxis: placed.cars.filter((c) => c.taxi).length,
      subwayEntrances: placed.subway.length, busShelters: placed.shelters.length,
      linknyc: placed.linknyc.length, bikeRacks: placed.bikeRacks.length, ...placed.report,
    },
    setFocus(x: number, z: number, first: number, last: number) {
      if (propMesh && (first !== shown[0] || last !== shown[1])) {
        shown[0] = first;
        shown[1] = last;
        propMesh.geometry.setDrawRange(propStart[first]!, propStart[last + 1]! - propStart[first]!);
      }
      if (n === 0 || Math.hypot(x - lastX, z - lastZ) <= TREE_REFRESH_METRES) return;
      lastX = x;
      lastZ = z;
      const count = pickWithin(xs, zs, x, z, CAR_RADIUS, ids, scratch);
      if (vdMeshes.length > 0) {
        // pickWithin returns the nearest first: the full body for the first VD_PARKED_CAP inside the near radius, then by distance.
        for (const m of vdMeshes) m.count = 0;
        for (let k = 0; k < count; k++) {
          const i = ids[k]!;
          const d2 = scratch[i]!;
          const lod: VdLod = k < VD_PARKED_CAP && d2 <= vdR2 ? 'near' : d2 <= midR2 ? 'mid' : 'far';
          const m = vdMeshes[vdSlots[vdKindOf[i]!]![lod]]!;
          if (m.count >= m.cap) continue;
          const slot = m.count++;
          const array = m.buffer.array as Float32Array;
          writeVdXform(array, slot, m.stride, m.xformAt, xs[i]!, zs[i]!, sourceYaw[i]!);
          array.set(sourceTones.subarray(i * 3, i * 3 + 3), slot * m.stride + m.toneAt);
        }
        for (const m of vdMeshes) {
          m.geometry.instanceCount = m.count;
          m.mesh.visible = near && m.count > 0;
          if (m.count > 0) m.buffer.needsUpdate = true;
        }
      }
      if (cars && tones) {
        const target = cars.instanceMatrix.array as Float32Array;
        const toneArray = tones.array as Float32Array;
        for (let k = 0; k < count; k++) {
          const i = ids[k]!;
          target.set(sourceMatrices.subarray(i * 16, i * 16 + 16), k * 16);
          toneArray[k * 3] = sourceTones[i * 3]!; toneArray[k * 3 + 1] = sourceTones[i * 3 + 1]!; toneArray[k * 3 + 2] = sourceTones[i * 3 + 2]!;
        }
        cars.count = count;
        cars.instanceMatrix.needsUpdate = true;
        tones.needsUpdate = true;
      }
    },
    setDistance(distance: number) {
      const close = distance < 320;
      near = close;
      if (cars) cars.visible = close;
      for (const m of vdMeshes) m.mesh.visible = close && m.count > 0;
      if (propMesh) propMesh.visible = close;
    },
    dispose() {
      for (const o of objects) o.geometry.dispose();
      cars?.dispose();
    },
  };
}
