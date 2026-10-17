// The small street things, as merged and instanced meshes:
//
// - city:street-props: hydrants and wire litter baskets, merged and written
//   in z bands, drawn only near the Caller (one draw range)
// - city:transit and city:transit-lights: subway entrances (iron railings,
//   the stair well, the green globe lamps) and bus shelters (posts, roof,
//   glass, a lit ad panel with no artwork) at their OSM positions
// - city:cars: parked cars and taxis, one InstancedMesh whose instance list
//   follows the Caller (preallocated, rebuilt after a 10 m move)
//
// Layout and the clearance rules are street-props-layout.ts.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV2 } from '../city-dataset.ts';
import { SHADOW_BAND_METRES } from './city-mesh.ts';
import { VertexBuffer } from './geometry.ts';
import { TONE_ATTRIBUTE, type CityMaterials } from './materials.ts';
import { CAR_TONES, CITY_COLORS, hexToRgb, type CityColor } from './palette.ts';
import { BandedBuffer, box, cone, cylinder, frame, type Frame } from './parts.ts';
import type { LightPlacement, SignPlacement } from './signage.ts';
import {
  CAR_LENGTH, CAR_WIDTH, placeAtKerb, placeBaskets, placeHydrants, placeParkedCars, type CarPlacement, type PropPlacement,
} from './street-props-layout.ts';
import { SURFACES, surfaceMid } from './surfaces.ts';
import { pickWithin, TREE_REFRESH_METRES } from './tree-lod.ts';
import type { StreetClearance } from './walkability.ts';

const rgb = (key: CityColor) => hexToRgb(CITY_COLORS[key]);
/** Body paint marker: vertices coloured below zero take the instance tone (materials.ts `cars`). */
const PAINT = [-1, -1, -1] as const;

export const CAR_RADIUS = 200;
export const CAR_CAP = 220;

/** Every street prop for a tile, after the clearance. Pure apart from the clearance. */
export function placeStreetProps(dataset: CityDatasetV2, clearance: StreetClearance, signs: readonly SignPlacement[], lights: readonly LightPlacement[]) {
  const hydrants = placeHydrants(dataset, clearance, lights);
  const baskets = placeBaskets(dataset, clearance, signs);
  const cars = placeParkedCars(dataset, clearance, hydrants);
  const subway = placeAtKerb(dataset.transit.subway, clearance);
  const shelters = placeAtKerb(dataset.transit.shelters, clearance);
  // A shelter needs its whole footprint on the sidewalk; one that cannot fit is left out.
  const fits = (p: PropPlacement, halfLength: number, depth: number) => {
    const f = frame(p.x, p.z, p.toRoad);
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
  return {
    hydrants, baskets, cars,
    subway: subwayFit, shelters: shelterFit,
    report: {
      subwayMoved: subway.moved, subwayDropped: subway.dropped + subway.placed.length - subwayFit.length,
      sheltersMoved: shelters.moved, sheltersDropped: shelters.dropped + shelters.placed.length - shelterFit.length,
    },
  };
}

function emitHydrant(buffer: VertexBuffer, p: PropPlacement): void {
  const f = frame(p.x, p.z, p.toRoad);
  buffer.surface(...SURFACES.iron);
  const body = rgb('hydrant');
  const cap = rgb('hydrantCap');
  cylinder(buffer, f, 0, 0, 0.13, 0, 0.62, 6, body);
  cone(buffer, f, 0, 0, 0.15, 0.62, 0.8, 6, cap);
  box(buffer, f, [-0.24, 0.38, -0.06], [0.24, 0.5, 0.06], body, { skip: ['bottom'] });
  box(buffer, f, [-0.06, 0.38, 0], [0.06, 0.5, 0.2], cap, { skip: ['back', 'bottom'] });
}

function emitBasket(buffer: VertexBuffer, p: PropPlacement): void {
  const f = frame(p.x, p.z, p.toRoad);
  buffer.surface(...SURFACES.iron);
  cylinder(buffer, f, 0, 0, 0.27, 0, 0.82, 8, rgb('basket'));
  cylinder(buffer, f, 0, 0, 0.3, 0.78, 0.86, 8, rgb('iron'));
}

/** Stairs down along the kerb, iron railings round three sides, green globe lamps on the open end. */
function emitSubwayEntrance(structure: VertexBuffer, lights: VertexBuffer, p: PropPlacement): void {
  const f: Frame = frame(p.x, p.z, p.toRoad);
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

/** A glass bus shelter with its back to the buildings, a bench and a lit ad panel at one end. */
function emitShelter(structure: VertexBuffer, lights: VertexBuffer, p: PropPlacement): void {
  const f: Frame = frame(p.x, p.z, p.toRoad);
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
  THREE: Three, dataset: CityDatasetV2, materials: Pick<CityMaterials, 'roofs' | 'neon' | 'cars'>,
  clearance: StreetClearance, signs: readonly SignPlacement[], lights: readonly LightPlacement[],
) {
  const placed = placeStreetProps(dataset, clearance, signs, lights);

  // Hydrants and baskets in z bands.
  const minZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);
  const bandOf = (z: number) => Math.max(0, Math.min(bandCount - 1, Math.floor((z - minZ) / SHADOW_BAND_METRES)));
  const kerb = [
    ...placed.hydrants.map((p) => ({ p, emit: emitHydrant })),
    ...placed.baskets.map((p) => ({ p, emit: emitBasket })),
  ].sort((a, b) => bandOf(a.p.z) - bandOf(b.p.z));
  const props = new BandedBuffer();
  for (const { p, emit } of kerb) { props.mark(bandOf(p.z)); emit(props.buffer, p); }
  const propStart = props.finish(bandCount);

  const structure = new VertexBuffer();
  const glow = new VertexBuffer();
  for (const p of placed.subway) emitSubwayEntrance(structure, glow, p);
  for (const p of placed.shelters) emitShelter(structure, glow, p);

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

  // Parked cars and taxis: source rows once, the near ones copied into the instance buffer as the Caller walks.
  const carGeo = carGeometry(THREE);
  const capacity = Math.max(1, Math.min(CAR_CAP, placed.cars.length));
  const cars = new THREE.InstancedMesh(carGeo, materials.cars, capacity);
  cars.name = 'city:cars';
  cars.count = 0;
  cars.frustumCulled = false;
  const tones = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  carGeo.setAttribute(TONE_ATTRIBUTE, tones);
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
  placed.cars.forEach((car: CarPlacement, i) => {
    q.setFromAxisAngle(up, Math.atan2(-car.dir[1], car.dir[0]));
    matrix.compose(pos.set(car.x, 0, car.z), q, one).toArray(sourceMatrices, i * 16);
    const tone = car.taxi ? rgb('taxi') : rgb(CAR_TONES[Math.floor(car.tone * CAR_TONES.length) % CAR_TONES.length]!);
    sourceTones.set(tone, i * 3);
    xs[i] = car.x;
    zs[i] = car.z;
  });
  const ids = new Int32Array(capacity);
  const scratch = new Float32Array(n);
  objects.push(cars);
  let lastX = Number.NaN;
  let lastZ = Number.NaN;
  let shown: [number, number] = [-1, -1];

  return {
    objects,
    stats: {
      hydrants: placed.hydrants.length, baskets: placed.baskets.length, cars: n, taxis: placed.cars.filter((c) => c.taxi).length,
      subwayEntrances: placed.subway.length, busShelters: placed.shelters.length, ...placed.report,
    },
    setFocus(x: number, z: number, first: number, last: number) {
      if (propMesh && (first !== shown[0] || last !== shown[1])) {
        shown = [first, last];
        propMesh.geometry.setDrawRange(propStart[first]!, propStart[last + 1]! - propStart[first]!);
      }
      if (n === 0 || Math.hypot(x - lastX, z - lastZ) <= TREE_REFRESH_METRES) return;
      lastX = x;
      lastZ = z;
      const count = pickWithin(xs, zs, x, z, CAR_RADIUS, ids, scratch);
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
    },
    setDistance(distance: number) {
      const close = distance < 320;
      cars.visible = close;
      if (propMesh) propMesh.visible = close;
    },
    dispose() {
      for (const o of objects) o.geometry.dispose();
      cars.dispose();
    },
  };
}
