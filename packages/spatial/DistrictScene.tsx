'use client';

import { palette } from '@acme/theme';
import type { District } from '@acme/ui';
import {
  ViroAmbientLight,
  ViroBox,
  ViroDirectionalLight,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroScene,
  isMetaHorizonXR,
  isPico,
} from './viro';
import { useDistrictStore } from './districtStore';
import { DistrictLandmark } from './DistrictLandmark';
import { CROSS_STREET_GAP, SIDEWALK_HALF, StreetDressing } from './StreetDressing';

/**
 * The immersive scene: one NYC-MON district built from solid boxes around the
 * viewer at street level. It is the same module on web (Viro Web Renderer),
 * phone previews, Quest (Viro XR navigator) and PICO (registerImmersiveScene).
 * Static geometry only; nothing here ticks per frame.
 */

ViroMaterials.createMaterials({
  // Lambert so the solid masses read through light and shade, not outlines.
  districtStreet: { diffuseColor: palette.ink[950], lightingModel: 'Constant' },
  districtAvenue: { diffuseColor: palette.orange[500], lightingModel: 'Constant' },
  districtOrange: { diffuseColor: palette.orange[700], lightingModel: 'Lambert' },
  districtBrick: { diffuseColor: palette.orange[900], lightingModel: 'Lambert' },
  districtRoyal: { diffuseColor: palette.royal[700], lightingModel: 'Lambert' },
  districtRoyalDeep: { diffuseColor: palette.royal[900], lightingModel: 'Lambert' },
  districtCarolina: { diffuseColor: palette.carolina[700], lightingModel: 'Lambert' },
  districtInk: { diffuseColor: palette.ink[800], lightingModel: 'Lambert' },
  districtCrown: { diffuseColor: palette.orange[400], lightingModel: 'Constant' },
  districtWindow: { diffuseColor: palette.orange[300], lightingModel: 'Constant' },
  districtSky: { diffuseColor: palette.carolina[300], lightingModel: 'Constant' },
  districtApple: { diffuseColor: palette.apple[500], lightingModel: 'Constant' },
  spatialDark: { diffuseColor: palette.ink[950], lightingModel: 'Constant' },
});

type Spec = {
  /** Height range in metres. */
  height: [number, number];
  /** Footprint range in metres. */
  width: [number, number];
  bodies: readonly string[];
  crown: string;
  /** Chance a building gets a stepped setback block on top. */
  setback: number;
};

const SPECS: Record<District, Spec> = {
  downtown: { height: [14, 34], width: [3, 5], bodies: ['districtRoyal', 'districtRoyalDeep', 'districtInk'], crown: 'districtSky', setback: 0.7 },
  midtown: { height: [9, 24], width: [4, 6], bodies: ['districtOrange', 'districtRoyal', 'districtInk'], crown: 'districtCrown', setback: 0.8 },
  harlem: { height: [3, 6], width: [2.4, 3.2], bodies: ['districtBrick', 'districtOrange', 'districtInk'], crown: 'districtApple', setback: 0.1 },
  megacity: { height: [24, 48], width: [6, 9], bodies: ['districtRoyalDeep', 'districtCarolina', 'districtInk'], crown: 'districtSky', setback: 0.9 },
};

type Building = {
  key: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  body: string;
  setback: number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Headsets track from the floor, so the street sits at y = 0. The web and
 * phone previews put the camera at the origin, so the street drops to a
 * standing eye height below it.
 */
const EYE_HEIGHT = 1.6;
const PREVIEW_GROUND_Y = isMetaHorizonXR || isPico ? 0 : -EYE_HEIGHT;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Two rows of buildings either side of a street, plus a back row, with a gap
 * for the cross street. The landmark closes the far end.
 */
function buildDistrict(district: District): Building[] {
  const spec = SPECS[district];
  const r = rng(district.length * 7919 + 17);
  const out: Building[] = [];
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      let z = 4;
      let i = 0;
      while (z > -60) {
        const w = lerp(spec.width[0], spec.width[1], r());
        const tall = row === 1 ? 1.4 : 1;
        // Leave the cross street open. The draw order is unchanged so every
        // district keeps its seeded skyline either side of the gap.
        const inCrossStreet = z > CROSS_STREET_GAP[0] && z - w < CROSS_STREET_GAP[1];
        const building: Building = {
          key: `${side}-${row}-${i}`,
          x: side * (SIDEWALK_HALF + row * 9 + w / 2),
          z: z - w / 2,
          w,
          d: lerp(spec.width[0], spec.width[1], r()),
          h: lerp(spec.height[0], spec.height[1], r()) * tall,
          body: spec.bodies[Math.floor(r() * spec.bodies.length)] ?? 'districtInk',
          setback: r() < spec.setback ? lerp(0.45, 0.7, r()) : 0,
        };
        if (!inCrossStreet) out.push(building);
        z -= w + (district === 'harlem' ? 0.15 : 1.2);
        i += 1;
      }
    }
  }
  return out;
}

const CACHE = new Map<District, Building[]>();
function districtBuildings(district: District) {
  let list = CACHE.get(district);
  if (!list) {
    list = buildDistrict(district);
    CACHE.set(district, list);
  }
  return list;
}

function BuildingMass({ b, crown }: { b: Building; crown: string }) {
  const topH = b.setback ? b.h * 0.22 : 0;
  const baseH = b.h - topH;
  return (
    <ViroNode position={[b.x, 0, b.z]}>
      <ViroBox position={[0, baseH / 2, 0]} scale={[b.w, baseH, b.d]} materials={[b.body]} />
      {/* Lit window band facing the street. */}
      <ViroBox
        position={[-Math.sign(b.x) * (b.w / 2 + 0.02), baseH * 0.55, 0]}
        scale={[0.02, Math.min(1.2, baseH * 0.06), b.d * 0.7]}
        materials={['districtWindow']}
      />
      {b.setback ? (
        <ViroBox
          position={[0, baseH + topH / 2, 0]}
          scale={[b.w * b.setback, topH, b.d * b.setback]}
          materials={[b.body]}
        />
      ) : null}
      <ViroBox
        position={[0, b.h + 0.15, 0]}
        scale={[b.w * (b.setback || 1) * 0.9, 0.3, b.d * (b.setback || 1) * 0.9]}
        materials={[crown]}
      />
    </ViroNode>
  );
}

function DistrictStreet({ groundY }: { groundY: number }) {
  const district = useDistrictStore((state) => state.district);
  const spec = SPECS[district];
  const buildings = districtBuildings(district);

  return (
    <ViroScene>
      <ViroAmbientLight color={palette.carolina[200]} intensity={220} />
      <ViroDirectionalLight color={palette.orange[200]} intensity={420} direction={[0.4, -1, -0.5]} />
      <ViroNode position={[0, groundY, 0]}>
        {/* Road surface at floor level, out past the landmark. */}
        <ViroQuad position={[0, 0, -40]} rotation={[-90, 0, 0]} width={100} height={110} materials={['districtStreet']} />
        <StreetDressing />
        <DistrictLandmark district={district} />
        {buildings.map((b) => (
          <BuildingMass key={`${district}-${b.key}`} b={b} crown={spec.crown} />
        ))}
      </ViroNode>
    </ViroScene>
  );
}

/** For navigators whose origin follows the runtime (web, phone preview, Quest XR navigator). */
export function DistrictScene() {
  return <DistrictStreet groundY={PREVIEW_GROUND_Y} />;
}

/**
 * For a session that already tracks from the floor: PICO's immersive
 * activity with expo-pico's viroRendererOverlay, which moves PICO's origin to
 * the floor. Stock Viro does not report PICO, so this cannot be detected from
 * the scene and the immersive root picks it explicitly.
 */
export function DistrictFloorScene() {
  return <DistrictStreet groundY={0} />;
}
