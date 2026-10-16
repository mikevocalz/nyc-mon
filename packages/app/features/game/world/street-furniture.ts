// Street furniture: NYC street-name signs at named intersections and LED
// streetlights along the carriageways. Layout is signage.ts (pure); this
// file turns it into a few instanced meshes and one merged lettering mesh:
//
// - poles: one InstancedMesh for sign and light poles (an open 6-sided tube)
// - blades: one InstancedMesh of green boxes, two per sign
// - lettering: glyph quads on both faces of every blade, sampling the pixel
//   font atlas (pixel-font.ts); sorted into z bands and drawn only near the
//   Caller through one draw range, as the contact shadows are
// - lamp heads: one InstancedMesh, unlit
// - light pools: additive discs under the nearest lamps, refreshed as the
//   Caller walks (preallocated, no allocation per refresh)
import type { Three } from '@acme/ui/three';
import type { CityDatasetV2 } from '../city-dataset.ts';
import { shadowBands, SHADOW_BAND_METRES } from './city-mesh.ts';
import { emitText, type TextFace } from './lettering.ts';
import type { CityMaterials } from './materials.ts';
import { CITY_COLORS, hexToRgb, type CityColor } from './palette.ts';
import { BandedBuffer } from './parts.ts';
import { layoutText } from './pixel-font.ts';
import {
  BLADE_HEIGHT, findIntersections, LETTER_HEIGHT, LIGHT_POLE_HEIGHT, MAX_SIGNS, placeSigns, placeStreetlights,
  SIGN_POLE_HEIGHT, type SignBlade,
} from './signage.ts';
import { pickWithin, TREE_REFRESH_METRES } from './tree-lod.ts';
import { createStreetClearance, type StreetClearance } from './walkability.ts';

export const MAX_STREETLIGHTS = 420;
/** Light pools only under the nearest lamps. */
export const POOL_RADIUS = 110;
export const POOL_CAP = 48;
const BLADE_THICKNESS = 0.03;
const PIXEL = LETTER_HEIGHT / 7;
/** Vertex colours carry display values straight through (materials.ts). */
const linearRgb = (key: CityColor) => hexToRgb(CITY_COLORS[key]);

/** Metres of lettering for a blade's text at square pixels. */
export const measureText = (text: string) => layoutText(text).width * PIXEL;

/** Signs and streetlights for a tile, every base outside the carriageways (walkability.ts clearance). Pure apart from the clearance. */
export function placeStreetFurniture(dataset: CityDatasetV2, clearance: StreetClearance) {
  const apollo = dataset.landmarks.find((l) => l.key === 'apollo-theater');
  const centre: [number, number] = apollo ? [apollo.x, apollo.z] : [0, 0];
  const crosses = findIntersections(dataset.roads);
  const signs = placeSigns(crosses, centre, measureText, MAX_SIGNS, clearance.standable);
  const lights = placeStreetlights(dataset.roads, centre, MAX_STREETLIGHTS, clearance.standable);
  return { signs, lights, intersections: crosses.length };
}

export function buildStreetFurniture(
  THREE: Three, dataset: CityDatasetV2, materials: Pick<CityMaterials, 'poles' | 'signBlades' | 'lampHeads' | 'lampPools' | 'lettering'>,
  clearance: StreetClearance = createStreetClearance(dataset),
  extraTexts: readonly (TextFace & { text: string })[] = [],
) {
  const { signs, lights, intersections } = placeStreetFurniture(dataset, clearance);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx); // local +x onto (dx, dz)

  // Poles: unit open tube, base at y = 0, scaled per instance.
  const poleGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  const poleCount = Math.max(1, signs.length + lights.length);
  const poles = new THREE.InstancedMesh(poleGeometry, materials.poles, poleCount);
  poles.name = 'city:poles';
  let p = 0;
  for (const sign of signs) {
    matrix.compose(position.set(sign.x, 0, sign.z), rotation.identity(), scale.set(0.05, SIGN_POLE_HEIGHT, 0.05));
    poles.setMatrixAt(p++, matrix);
  }
  for (const light of lights) {
    matrix.compose(position.set(light.x, 0, light.z), rotation.identity(), scale.set(0.09, LIGHT_POLE_HEIGHT, 0.09));
    poles.setMatrixAt(p++, matrix);
  }
  poles.count = p;

  // Blades: unit box, centred on the pole top, running along the street they name.
  const bladeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const blades = new THREE.InstancedMesh(bladeGeometry, materials.signBlades, Math.max(1, signs.length * 2));
  blades.name = 'city:sign-blades';
  let b = 0;
  for (const sign of signs) {
    for (const blade of sign.blades) {
      rotation.setFromAxisAngle(up, yawOf(blade.dir[0], blade.dir[1]));
      matrix.compose(position.set(sign.x, blade.y, sign.z), rotation, scale.set(blade.length, BLADE_HEIGHT, BLADE_THICKNESS));
      blades.setMatrixAt(b++, matrix);
    }
  }
  blades.count = b;

  // Lettering (street-name blades, plus the shop signs city-mesh.ts collected), in z bands so a draw range can follow the Caller.
  const minZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);
  const bandOf = (z: number) => Math.max(0, Math.min(bandCount - 1, Math.floor((z - minZ) / SHADOW_BAND_METRES)));
  const faces: (TextFace & { text: string })[] = [...extraTexts];
  const white = linearRgb('signText');
  for (const sign of signs) for (const blade of sign.blades) faces.push(...bladeFaces(sign.x, sign.z, blade, white));
  faces.sort((p, q) => bandOf(p.z) - bandOf(q.z));
  const letteringBands = new BandedBuffer();
  for (const face of faces) {
    letteringBands.mark(bandOf(face.z));
    emitText(letteringBands.buffer, face.text, face);
  }
  const bandStart = letteringBands.finish(bandCount);
  const lettering = letteringBands.buffer;
  const letterGeometry = lettering.vertexCount > 0 ? lettering.toGeometry(THREE) : null;
  const letters = letterGeometry ? new THREE.Mesh(letterGeometry, materials.lettering) : null;
  if (letters) {
    letters.name = 'city:sign-lettering';
    letters.frustumCulled = false;
    letters.matrixAutoUpdate = false;
  }

  // Lamp heads: a flat LED fixture over the carriageway.
  const headGeometry = new THREE.BoxGeometry(1.3, 0.14, 0.42);
  const heads = new THREE.InstancedMesh(headGeometry, materials.lampHeads, Math.max(1, lights.length));
  heads.name = 'city:lamp-heads';
  const poolX = new Float32Array(lights.length);
  const poolZ = new Float32Array(lights.length);
  lights.forEach((light, i) => {
    rotation.setFromAxisAngle(up, yawOf(light.face[0], light.face[1]));
    matrix.compose(position.set(light.x + light.face[0] * 0.6, LIGHT_POLE_HEIGHT - 0.05, light.z + light.face[1] * 0.6), rotation, scale.set(1, 1, 1));
    heads.setMatrixAt(i, matrix);
    poolX[i] = light.x + light.face[0] * 1.8;
    poolZ[i] = light.z + light.face[1] * 1.8;
  });
  heads.count = lights.length;

  const poolGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeometry, materials.lampPools, POOL_CAP);
  pools.name = 'city:lamp-pools';
  pools.renderOrder = 3;
  pools.count = 0;
  const poolIds = new Int32Array(POOL_CAP);
  const poolScratch = new Float32Array(lights.length);
  const poolMatrix = new THREE.Matrix4();

  for (const mesh of [poles, blades, heads, pools]) {
    mesh.instanceMatrix.needsUpdate = true;
    // Spread over the tile: one bounding volume would never cull.
    mesh.frustumCulled = false;
  }

  let lastX = Number.NaN;
  let lastZ = Number.NaN;
  let shownBands: [number, number] = [-1, -1];
  const objects = [poles, blades, heads, pools, ...(letters ? [letters] : [])];
  return {
    objects,
    signs,
    lights,
    stats: { signs: signs.length, unsignedIntersections: intersections - signs.length, streetlights: lights.length, letterTriangles: lettering.vertexCount / 3 },
    /** Lettering bands and light pools follow the Caller. Allocation-free. */
    setFocus(x: number, z: number) {
      if (letterGeometry) {
        const [first, last] = shadowBands(z, minZ, bandCount);
        if (first !== shownBands[0] || last !== shownBands[1]) {
          shownBands = [first, last];
          letterGeometry.setDrawRange(bandStart[first]!, bandStart[last + 1]! - bandStart[first]!);
        }
      }
      if (Math.hypot(x - lastX, z - lastZ) <= TREE_REFRESH_METRES) return;
      lastX = x;
      lastZ = z;
      const n = pickWithin(poolX, poolZ, x, z, POOL_RADIUS, poolIds, poolScratch);
      for (let k = 0; k < n; k++) {
        const i = poolIds[k]!;
        poolMatrix.makeScale(5.5, 1, 5.5).setPosition(poolX[i]!, 0.09, poolZ[i]!);
        pools.setMatrixAt(k, poolMatrix);
      }
      pools.count = n;
      pools.instanceMatrix.needsUpdate = true;
    },
    /** Hide the pedestrian-scale pieces from overview range. */
    setDistance(distance: number) {
      const close = distance < 320;
      blades.visible = close;
      pools.visible = close;
      if (letters) letters.visible = close;
      poles.visible = distance < 900;
      heads.visible = distance < 1400;
    },
    dispose() {
      for (const g of [poleGeometry, bladeGeometry, headGeometry, poolGeometry]) g.dispose();
      letterGeometry?.dispose();
      for (const mesh of [poles, blades, heads, pools]) mesh.dispose();
    },
  };
}

/** Both faces of one blade, each reading left to right for a viewer in front of it. */
function bladeFaces(x: number, z: number, blade: SignBlade, color: readonly number[]): (TextFace & { text: string })[] {
  const [dx, dz] = blade.dir;
  const off = BLADE_THICKNESS / 2 + 0.003;
  return [1, -1].map((side) => {
    // Face normal (-dz, dx) * side; reading along dir * side keeps the text the right way round.
    const nx = -dz * side; const nz = dx * side;
    return {
      text: blade.text, x: x + nx * off, y: blade.y, z: z + nz * off,
      right: [dx * side, dz * side] as const, height: LETTER_HEIGHT, condense: blade.condense, color,
    };
  });
}
