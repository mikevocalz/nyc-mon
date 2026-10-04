'use client';

import { palette } from '@acme/theme';
import { ViroBox, ViroMaterials } from './viro';

/**
 * Shared building block for the street scene: a solid box placed by its base,
 * so tiers, setbacks and props stack by adding heights instead of halving them.
 * Everything built from it is static data; nothing ticks per frame.
 */

ViroMaterials.createMaterials({
  // Street surface and furniture. Constant reads as paint and light; Lambert
  // gives the raised kerbs, cabs and poles a lit side and a shade side.
  streetSidewalk: { diffuseColor: palette.ink[700], lightingModel: 'Lambert' },
  streetCurb: { diffuseColor: palette.ink[400], lightingModel: 'Lambert' },
  streetPaint: { diffuseColor: palette.ink[200], lightingModel: 'Constant' },
  streetLane: { diffuseColor: palette.ink[500], lightingModel: 'Constant' },
  streetPole: { diffuseColor: palette.ink[600], lightingModel: 'Lambert' },
  streetLamp: { diffuseColor: palette.orange[200], lightingModel: 'Constant' },
  streetCab: { diffuseColor: palette.orange[500], lightingModel: 'Lambert' },
  streetCabTrim: { diffuseColor: palette.ink[900], lightingModel: 'Lambert' },
  streetHydrant: { diffuseColor: palette.apple[500], lightingModel: 'Lambert' },
  // Landmarks.
  landmarkGlass: { diffuseColor: palette.carolina[700], lightingModel: 'Lambert' },
  landmarkGlassDeep: { diffuseColor: palette.carolina[900], lightingModel: 'Lambert' },
  landmarkSpire: { diffuseColor: palette.carolina[200], lightingModel: 'Constant' },
  landmarkStone: { diffuseColor: palette.silver[700], lightingModel: 'Lambert' },
  landmarkStoneDeep: { diffuseColor: palette.silver[900], lightingModel: 'Lambert' },
  landmarkBand: { diffuseColor: palette.orange[400], lightingModel: 'Constant' },
  landmarkMarquee: { diffuseColor: palette.orange[300], lightingModel: 'Constant' },
  landmarkSign: { diffuseColor: palette.apple[500], lightingModel: 'Constant' },
  landmarkBulb: { diffuseColor: palette.white, lightingModel: 'Constant' },
  landmarkBrick: { diffuseColor: palette.orange[900], lightingModel: 'Lambert' },
  landmarkBrownstone: { diffuseColor: palette.orange[950], lightingModel: 'Lambert' },
  landmarkMega: { diffuseColor: palette.royal[800], lightingModel: 'Lambert' },
  landmarkMegaDeep: { diffuseColor: palette.royal[950], lightingModel: 'Lambert' },
  landmarkSkyLight: { diffuseColor: palette.carolina[300], lightingModel: 'Constant' },
});

export type Vec3 = readonly [number, number, number];

export type BlockSpec = {
  /** x, base y, z in metres. */
  p: Vec3;
  /** width (x), height (y), depth (z) in metres. */
  s: Vec3;
  m: string;
  /** Rotation about the vertical axis, degrees. */
  ry?: number;
};

export function Block({ p, s, m, ry }: BlockSpec) {
  return (
    <ViroBox
      position={[p[0], p[1] + s[1] / 2, p[2]]}
      rotation={ry ? [0, ry, 0] : undefined}
      scale={[s[0], s[1], s[2]]}
      materials={[m]}
    />
  );
}

export function Blocks({ list, prefix }: { list: readonly BlockSpec[]; prefix: string }) {
  return (
    <>
      {list.map((b, i) => (
        <Block key={`${prefix}-${i}`} {...b} />
      ))}
    </>
  );
}
