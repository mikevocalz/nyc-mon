// Which Valdrada wall photo a building wears, and at what tile size. Pure, so
// city-mesh.ts can stamp it without loading the baked pixels.
//
// Layers follow VD_WALL_LAYERS (tooling/city/bake-textures.mjs). The STYLE
// table and tile sizes are Valdrada v0.4.0 client/src/world/materials.js,
// makeFacadeMaterial masonry block: red brick t_wA at wuv/2.6 for styles 0, 7,
// 12, 13; brown t_wB at /2.4 for 1; white/tan t_wC at /2.4 for 2; cut stone
// t_wS at /3.4 for 4, 5, 8, 9; plaster t_wP at /3.0 for 6, 10. Styles 3 and 11
// are curtain wall and take no photo.
import type { CityBuilding } from '../city-dataset.ts';

export const VD_LAYER = { brownBrick: 0, redBrick: 1, whiteBrick: 2, stone: 3, plaster: 4 } as const;
type Layer = (typeof VD_LAYER)[keyof typeof VD_LAYER];

const TILE_METRES: Record<Layer, number> = { 0: 2.4, 1: 2.6, 2: 2.4, 3: 3.4, 4: 3.0 };

const BY_STYLE: Partial<Record<number, Layer>> = {
  0: 1, 7: 1, 12: 1, 13: 1,
  1: 0,
  2: 2,
  4: 3, 5: 3, 8: 3, 9: 3,
  6: 4, 10: 4,
};

// v2 tiles and unmatched buildings carry no STYLE id; the class picks instead.
// Brownstone is sandstone, so it takes the cut-stone photo.
const BY_CLASS: Record<CityBuilding['class'], Layer | -1> = {
  brownstone: 3, brick: 1, nycha: 0, church: 3, civic: 2, plain: 4, glass: -1,
};

/** [layer, 1 / tile metres] for VertexBuffer.facade; layer -1 draws no photo. */
export function facadePhoto(building: Pick<CityBuilding, 'class' | 'styleId'>): [number, number] {
  const layer = building.styleId !== undefined ? BY_STYLE[building.styleId] ?? -1 : BY_CLASS[building.class];
  return layer < 0 ? [-1, 0] : [layer, 1 / TILE_METRES[layer as Layer]];
}
