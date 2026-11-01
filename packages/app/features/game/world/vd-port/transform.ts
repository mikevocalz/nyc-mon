// Valdrada world metres to scene metres, the transform tooling/city/valdrada/decode.mjs `toScene` uses for the bake
// (Valdrada shared/geo.js `unproject`, then packages/core/world/transform.ts projectToScene about the tile origin), left
// unrounded: the bake rounds positions to 0.1 m, the port keeps Valdrada's centimetres.
//
// Both frames are x east, z south, so there is no rotation; Valdrada's metres-per-degree differ from the scene's by
// 0.15 % in x (84,290 vs 84,161 m/deg lon) and 0.06 % in z (111,132 vs 111,195 m/deg lat), which the affine form below
// carries exactly.

// shared/geo.js L2-L6 @ 2724c79
const LAT0 = 40.7831;
const LON0 = -73.9712;
const M_PER_DEG_LAT = 111132.0;
const M_PER_DEG_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180);
// packages/core/world/transform.ts
const R_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** The tile origin as the dataset stores it: [longitude, latitude]. */
export type TileOrigin = readonly [longitude: number, latitude: number];

/** The affine map for one tile origin: scene = (vx * sx + ox, vz * sz + oz). */
export function valdradaToSceneAffine(origin: TileOrigin): { sx: number; sz: number; ox: number; oz: number } {
  const [lon0, lat0] = origin;
  const kx = DEG * R_M * Math.cos(lat0 * DEG);
  const kz = DEG * R_M;
  // x = (vx / M_PER_DEG_LON + LON0 - lon0) * kx ; z = -(-vz / M_PER_DEG_LAT + LAT0 - lat0) * kz
  return {
    sx: kx / M_PER_DEG_LON,
    ox: (LON0 - lon0) * kx,
    sz: kz / M_PER_DEG_LAT,
    oz: -(LAT0 - lat0) * kz,
  };
}

export function valdradaToScene(origin: TileOrigin): (vx: number, vz: number) => [number, number] {
  const a = valdradaToSceneAffine(origin);
  return (vx, vz) => [vx * a.sx + a.ox, vz * a.sz + a.oz];
}
