// Adapted from mrdoob/slop-newyork @ be65d0a, js/fire-escapes.js createFireEscapes, floorGeometry, proxyGeometry, filteredBar (MIT, © 2026 Mr.doob)
//
// Wrought-iron fire escapes on D18's walk-ups as two instanced levels of
// detail. Near the focus every landing is a floor module (open grating,
// treads, pickets, drop ladder) whose ironwork is cut by an opacity mask
// filtered to its pixel coverage, so distant bars thin out rather than
// alias. Further out each escape is six masked planes scaled to its height,
// with the flights, rails and pickets drawn by the same filtered masks.
// Alpha-to-coverage turns the mask into MSAA coverage; the shadow pass
// keeps the solid half (maskShadowNode).
//
// Placements come from city-mesh.ts (`fireEscapes: true`), on the same
// building rule that bakes the D18 escapes when the option is off.
//
// three@0.186.1: MeshStandardNodeMaterial maskNode, maskShadowNode,
// alphaToCoverage (src/materials/nodes/NodeMaterial.js, src/materials/Material.js),
// InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage,
// BufferAttribute.clearUpdateRanges / addUpdateRange.
import type { Three } from '@acme/ui/three';
import { physicalCityMaterials } from '@acme/theme';
import { FIRE_ESCAPE } from '../physical-materials-constants.ts';
import { asNode, type TslNode } from './loose-tsl.ts';
import { physicalTsl } from './tsl-common.ts';

type Geometry = InstanceType<Three['BufferGeometry']>;
// InstancedMesh's geometry parameter is typed narrower than BufferGeometry.clone()'s result; same object at runtime.
type MeshGeometry = ConstructorParameters<Three['InstancedMesh']>[0];
type InstancedMesh = InstanceType<Three['InstancedMesh']>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;

/** One escape on a wall. Matches Slop's js/buildings.js `fireEscapes` rows. */
export interface FireEscapePlacement {
  /** Module origin, m: the deck centre, `wallOffset` out from the wall. */
  x: number;
  z: number;
  /** First landing height, m. */
  y: number;
  /** Rotation about +y taking local +z to the wall's outward normal, rad. */
  facing: number;
  /** Floor-to-floor height, m. */
  storey: number;
  landings: number;
  /** Nominal escape height for the far proxy, m: (landings − 1) storeys + 1. */
  h: number;
}

const STOREY = FIRE_ESCAPE.storey;

interface Arrays { positions: number[]; uvs: number[]; parts: number[]; indices: number[] }
type V3 = readonly [number, number, number];

/** Slop floorGeometry: parts 0/1 landing and guard, 2/3 flight and guard, 4 the raised drop ladder. */
export function floorArrays(): Arrays {
  const a: Arrays = { positions: [], uvs: [], parts: [], indices: [] };
  const quad = (p0: V3, p1: V3, p2: V3, p3: V3, part: number, width = 1) => {
    const first = a.positions.length / 3;
    for (const p of [p0, p1, p2, p3]) a.positions.push(...p);
    a.uvs.push(0, 0, width, 0, width, 1, 0, 1);
    a.parts.push(part, part, part, part);
    a.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const deck = (x0: number, x1: number, z0: number, z1: number, y: number, part: number) =>
    quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], part);
  const guard = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = 0, part = 1) => {
    const bays = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.17);
    quad([x0, y0, z0], [x1, y1, z1], [x1, y1 + 1, z1], [x0, y0 + 1, z0], part, bays);
  };
  deck(-1.7, 1.7, -0.55, -0.18, 0, 0);
  deck(-1.7, -1.2, -0.18, 0.55, 0, 0);
  deck(1.2, 1.7, -0.18, 0.55, 0, 0);
  guard(-1.7, 0.55, 1.7, 0.55);
  guard(-1.7, -0.55, -1.7, 0.55);
  guard(1.7, 0.55, 1.7, -0.55);
  const steps = 16;
  for (let i = 0; i < steps; i++) deck(-1.2 + (2.4 * i) / steps, -1.2 + (2.4 * (i + 1)) / steps, -0.15, 0.5, (STOREY * (i + 1)) / steps, 2);
  for (const z of [-0.17, 0.52]) {
    quad([-1.2, -0.08, z], [1.2, STOREY - 0.08, z], [1.2, STOREY + 0.03, z], [-1.2, 0.03, z], 2);
    guard(-1.2, z, 1.2, z, 0, STOREY, 3);
  }
  quad([-1.62, -2.2, 0.56], [-1.28, -2.2, 0.56], [-1.28, -0.05, 0.56], [-1.62, -0.05, 0.56], 4);
  return a;
}

/** Slop proxyGeometry: six masked planes at the detailed model's depths (width, x, z, rotation, part), merged by hand. */
export function proxyArrays(): Arrays & { normals: number[] } {
  const planes: readonly (readonly [number, number, number, number, number])[] = [
    [3.4, 0, 0.55, 0, 1],
    [1.1, -1.7, 0, -Math.PI / 2, 1],
    [1.1, 1.7, 0, Math.PI / 2, 1],
    [2.4, 0, -0.17, 0, 3],
    [2.4, 0, 0.52, 0, 3],
    [0.34, -1.45, 0.56, 0, 4],
  ];
  const a = { positions: [] as number[], uvs: [] as number[], parts: [] as number[], indices: [] as number[], normals: [] as number[] };
  for (const [width, x, z, rotation, part] of planes) {
    // PlaneGeometry(width, 1) translated up 0.5, rotated about y, then moved to (x, 0, z).
    const c = Math.cos(rotation); const s = Math.sin(rotation);
    const first = a.positions.length / 3;
    for (const [px, py, u, v] of [[-width / 2, 1, 0, 1], [width / 2, 1, 1, 1], [-width / 2, 0, 0, 0], [width / 2, 0, 1, 0]] as const) {
      a.positions.push(px * c + x, py, -px * s + z);
      a.normals.push(s, 0, c);
      a.uvs.push(u, v);
      a.parts.push(part);
    }
    a.indices.push(first, first + 2, first + 1, first + 2, first + 3, first + 1);
  }
  return a;
}

function toGeometry(THREE: Three, a: Arrays & { normals?: number[] }): Geometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uvs, 2));
  g.setAttribute('escapePart', new THREE.Float32BufferAttribute(a.parts, 1));
  g.setIndex(a.indices);
  if (a.normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(a.normals, 3));
  else g.computeVertexNormals();
  return g;
}

function steelMaterial(THREE: Three): StdMat {
  return new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(physicalCityMaterials.fireEscape.steel),
    roughness: FIRE_ESCAPE.roughness,
    metalness: FIRE_ESCAPE.metalness,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
  });
}

/** Slop's near (landing-by-landing) and far (whole-escape proxy) masks. */
export function createFireEscapeMaterials(THREE: Three): { near: StdMat; far: StdMat } {
  const { T, filteredPulse } = physicalTsl(THREE);
  // Pixel coverage rather than a minimum one-pixel bar width keeps distant ironwork open.
  const filteredBar = T.Fn(([distance, halfWidth, footprint]: [TslNode, TslNode, TslNode]) => {
    const w = T.max(footprint, 0.0001).toVar();
    return T.clamp(T.float(halfWidth).add(w.mul(0.5)).sub(T.abs(distance)).div(w), 0, T.min(1, T.float(halfWidth).mul(2).div(w)));
  });
  const bar = (d: TslNode, hw: TslNode | number, fp: TslNode) => filteredBar(d, hw, fp);
  const repeatingBar = (coord: TslNode, halfWidth: TslNode | number, footprint: TslNode = T.fwidth(coord)) =>
    filteredPulse(T.fract(coord.add(0.5)), T.float(0.5).sub(halfWidth), T.float(0.5).add(halfWidth), footprint);
  const union = (a: TslNode, b: TslNode) => a.add(b).sub(a.mul(b));

  const near = steelMaterial(THREE);
  const nearOpacity = T.Fn(() => {
    const part = T.attribute('escapePart', 'float');
    const flags = T.attribute('escapeFlags', 'vec2');
    const u = T.uv();
    const p = T.positionGeometry.xz;
    const grid = p.mul(10);
    const bars = union(repeatingBar(grid.x, 0.08), repeatingBar(grid.y, 0.08));
    // Frame the landing panels and their stair opening; grating settles to its mean coverage.
    const edge = T.min(T.abs(T.abs(p.x).sub(1.7)), T.abs(T.abs(p.x).sub(1.2)), T.abs(T.abs(p.y).sub(0.55)), T.abs(p.y.add(0.18)));
    const frame = bar(edge, 0.025, T.max(T.fwidth(p.x), T.fwidth(p.y)));
    const solid = T.mix(union(bars, frame), 1, T.step(0.5, part));
    const pickets = repeatingBar(u.x, 0.08);
    const rail = bar(u.y.sub(0.97), 0.03, T.fwidth(u.y));
    const middleRail = bar(u.y.sub(0.48), 0.018, T.fwidth(u.y));
    const guard = union(pickets, rail.add(middleRail));
    const ladderRails = bar(T.min(u.x, T.float(1).sub(u.x)), 0.065, T.fwidth(u.x));
    const rungs = repeatingBar(u.y.mul(8), 0.07);
    const ladder = T.step(3.5, part);
    const flight = T.step(1.5, part).mul(T.float(1).sub(ladder));
    const visible = T.mix(1, flags.x, flight).mul(T.mix(1, flags.y, ladder));
    return T.mix(T.mix(solid, guard, T.mod(part, 2)), union(ladderRails, rungs), ladder).mul(visible);
  })().toVar();
  near.opacityNode = asNode(nearOpacity);
  near.maskNode = asNode(nearOpacity.greaterThan(0));
  near.maskShadowNode = asNode(nearOpacity.greaterThan(0.5));
  near.name = 'physical:fire-escape-near';

  const far = steelMaterial(THREE);
  const farOpacity = T.Fn(() => {
    const part = T.attribute('escapePart', 'float');
    const size = T.attribute('escapeSize', 'vec2'); // storey and nominal escape height
    const scale = size.x.div(STOREY);
    const across = T.positionGeometry.x.add(1.7);
    // Include the raised ladder below the first landing and the scaled top guard.
    const height = T.positionGeometry.y.mul(size.y.sub(1).add(scale.mul(3.2))).sub(scale.mul(2.2));
    const level = height.div(size.x);
    const py = T.fwidth(height);
    const levelWidth = py.div(size.x);
    const front = T.abs(T.normalGeometry.z);
    const alongWall = T.mix(T.positionGeometry.z.add(0.55), across, front);
    const bay = alongWall.mul(T.mix(6 / 1.1, 20 / 3.4, front));
    const pickets = repeatingBar(bay, 0.08);
    const guardHeight = filteredPulse(T.fract(level), 0, 1 / STOREY, levelWidth);
    const rails = repeatingBar(level.sub(0.97 / STOREY), 0.03 / STOREY, levelWidth)
      .add(repeatingBar(level.sub(0.48 / STOREY), 0.018 / STOREY, levelWidth));
    const guards = union(pickets.mul(guardHeight), rails);
    const deck = repeatingBar(level.sub(T.float(0.04).div(size.x)), T.float(0.05).div(size.x), levelWidth);
    const flight = (index: TslNode) => {
      const parity = T.mod(index, 2);
      const x = T.mix(across, T.float(3.4).sub(across), parity).sub(0.5);
      const y = height.sub(index.mul(size.x));
      const railY = y.sub(x.mul(size.x.div(2.4))).div(scale);
      // Differentiate the flight before floor selection reverses its slope at the next landing.
      const slope = T.mix(T.float(1), T.float(-1), parity).mul(size.x.div(2.4));
      const footprint = T.abs(height.dFdx().sub(across.dFdx().mul(slope)))
        .add(T.abs(height.dFdy().sub(across.dFdy().mul(slope)))).div(scale);
      const flightBay = x.mul(14 / 2.4);
      const flightPickets = repeatingBar(flightBay, 0.08, T.fwidth(across).mul(14 / 2.4)).mul(bar(railY.sub(0.5), 0.5, footprint));
      const flightRails = bar(railY.add(0.025), 0.055, footprint)
        .add(bar(railY.sub(0.97), 0.03, footprint)).add(bar(railY.sub(0.48), 0.018, footprint));
      const stepHeight = size.x.div(16);
      // Tread bands clipped to the diagonal flight, so no discontinuous staircase is sampled.
      const treads = repeatingBar(y.div(stepHeight), T.float(0.01).div(stepHeight), py.div(stepHeight))
        .mul(bar(railY.sub(STOREY / 32), T.float(STOREY / 32).add(T.float(0.01).div(scale)), footprint));
      const visible = T.step(0, index).mul(T.step(index.add(1), T.floor(size.y.div(size.x))));
      return union(union(flightPickets, flightRails), treads).mul(visible);
    };
    // A flight's guard continues above the next landing, where the following flight turns back.
    const stairs = union(flight(T.floor(level)), flight(T.floor(level).sub(1)));
    const ladderX = across.sub(0.08).div(0.34);
    const ladderY = height.div(scale).add(2.2).div(2.15);
    const ladderRails = bar(T.min(ladderX, T.float(1).sub(ladderX)), 0.065, T.fwidth(ladderX));
    const rungs = repeatingBar(ladderY.mul(8), 0.07);
    const ladder = union(ladderRails, rungs).mul(bar(ladderY.sub(0.5), 0.5, T.fwidth(ladderY)));
    return T.mix(T.mix(union(deck, guards).mul(T.step(0, height)), stairs, T.step(1.5, part)), ladder, T.step(3.5, part));
  })().toVar();
  far.opacityNode = asNode(farOpacity);
  far.maskNode = asNode(farOpacity.greaterThan(0));
  far.maskShadowNode = asNode(farOpacity.greaterThan(0.5));
  far.name = 'physical:fire-escape-far';
  return { near, far };
}

export interface FireEscapes {
  /** The three instanced meshes: near (two mirrored modules) and far. */
  meshes: InstancedMesh[];
  /** Re-sort the placements around a focus; call when the focus moves a few metres, not every frame. */
  update(placements: readonly FireEscapePlacement[], focusX: number, focusZ: number): void;
  dispose(): void;
}

function flagRange(attribute: InstanceType<Three['BufferAttribute']>, count: number): void {
  if (!count) return;
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, count * attribute.itemSize);
  attribute.needsUpdate = true;
}

/** Slop createFireEscapes, with begin / add / end folded into one `update` over a placement list. */
export function createFireEscapes(THREE: Three, materials = createFireEscapeMaterials(THREE)): FireEscapes {
  const geometry = toGeometry(THREE, floorArrays());
  // The mirrored module carries alternate floors, so the flights zig-zag.
  const mirrored = geometry.clone();
  mirrored.scale(-1, 1, 1);
  const index = mirrored.index!.array;
  for (let i = 0; i < index.length; i += 3) {
    const t = index[i + 1]!;
    index[i + 1] = index[i + 2]!;
    index[i + 2] = t;
  }
  const near = [geometry, mirrored].map((g, i) => {
    g.setAttribute('escapeFlags', new THREE.InstancedBufferAttribute(new Float32Array(FIRE_ESCAPE.maxNearFloors * 2), 2));
    const mesh = new THREE.InstancedMesh(g as MeshGeometry, materials.near, FIRE_ESCAPE.maxNearFloors);
    mesh.name = `physical:fire-escapes-near-${i}`;
    return mesh;
  });
  const farGeometry = toGeometry(THREE, proxyArrays());
  const farData = new THREE.InstancedBufferAttribute(new Float32Array(FIRE_ESCAPE.maxEscapes * 2), 2);
  farGeometry.setAttribute('escapeSize', farData);
  const far = new THREE.InstancedMesh(farGeometry as MeshGeometry, materials.far, FIRE_ESCAPE.maxEscapes);
  far.name = 'physical:fire-escapes-far';
  const meshes = [...near, far];
  for (const mesh of meshes) {
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  const dummy = new THREE.Object3D();
  return {
    meshes,
    update(placements, focusX, focusZ) {
      const counts = [0, 0];
      let total = 0; let nearFloors = 0; let farCount = 0;
      const nearSq = FIRE_ESCAPE.nearDistance * FIRE_ESCAPE.nearDistance;
      for (const fe of placements) {
        if (total >= FIRE_ESCAPE.maxEscapes) break;
        total++;
        const dx = fe.x - focusX; const dz = fe.z - focusZ;
        dummy.rotation.set(0, fe.facing, 0);
        if (dx * dx + dz * dz < nearSq && nearFloors + fe.landings <= FIRE_ESCAPE.maxNearFloors) {
          dummy.scale.set(1, fe.storey / STOREY, 1);
          for (let i = 0; i < fe.landings; i++) {
            const parity = i % 2;
            const n = counts[parity]!++;
            dummy.position.set(fe.x, fe.y + i * fe.storey, fe.z);
            dummy.updateMatrix();
            near[parity]!.setMatrixAt(n, dummy.matrix);
            // Flight up from every landing but the top; drop ladder under the first only.
            (near[parity]!.geometry.getAttribute('escapeFlags') as InstanceType<Three['InstancedBufferAttribute']>)
              .setXY(n, i < fe.landings - 1 ? 1 : 0, i === 0 ? 1 : 0);
          }
          nearFloors += fe.landings;
        } else {
          const scale = fe.storey / STOREY;
          dummy.position.set(fe.x, fe.y - scale * 2.2, fe.z);
          dummy.scale.set(1, fe.h - 1 + scale * 3.2, 1);
          dummy.updateMatrix();
          far.setMatrixAt(farCount, dummy.matrix);
          farData.setXY(farCount++, fe.storey, fe.h);
        }
      }
      for (let i = 0; i < near.length; i++) {
        near[i]!.count = counts[i]!;
        flagRange(near[i]!.instanceMatrix, counts[i]!);
        flagRange(near[i]!.geometry.getAttribute('escapeFlags') as InstanceType<Three['BufferAttribute']>, counts[i]!);
      }
      far.count = farCount;
      flagRange(far.instanceMatrix, farCount);
      flagRange(farData, farCount);
    },
    dispose() {
      geometry.dispose(); mirrored.dispose(); farGeometry.dispose();
      materials.near.dispose(); materials.far.dispose();
    },
  };
}
