/**
 * Conservative candidate detail for the already-merged Harlem material graph.
 * Zero extra geometry or draw calls. Disabled in production until paired native
 * performance + visual captures prove that the extra shader ALU is affordable.
 */
export const SURFACE_DETAIL = {
  mortar: {
    // Three masonry treatments, picked per building by the facade seed so a
    // wall is one material all over: a US modular brick (~57 mm face + ~10 mm
    // joint = ~67.5 mm course, ~194 mm stretcher + ~10 mm = ~204 mm bay),
    // rough-hewn brownstone ashlar with raked joints, and fine-jointed
    // limestone. Joint widths are fractions of a unit cell — about a
    // centimetre at each treatment's own unit size.
    treatments: {
      brick: {
        coursesPerMetre: 14.8,
        baysPerMetre: 4.9,
        horizontalJoint: 0.15,
        verticalJoint: 0.05,
        darkness: 0.11,
        tone: 1,
      },
      brownstone: {
        coursesPerMetre: 3.6,
        baysPerMetre: 1.8,
        horizontalJoint: 0.045,
        verticalJoint: 0.025,
        darkness: 0.16,
        tone: 0.97,
      },
      limestone: {
        coursesPerMetre: 2.2,
        baysPerMetre: 0.9,
        horizontalJoint: 0.02,
        verticalJoint: 0.012,
        darkness: 0.06,
        tone: 1.04,
      },
    },
    fadeNearMetres: 8,
    fadeFarMetres: 38,
  },
  asphalt: {
    grainDark: 0.96,
    grainLight: 1.04,
    cellMetres: 0.18,
    // Cell-hash constants, shared with the shader (materials.ts) so the test
    // samples the same grain values the GPU draws.
    hashDotX: 127.1,
    hashDotZ: 311.7,
    hashScale: 43758.5453,
    fadeNearMetres: 4,
    fadeFarMetres: 32,
  },
} as const;

export function parseSurfaceDetailFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1','true','on'].includes(value.trim().toLowerCase());
}

/**
 * CPU mirror of the distance fade used by the TSL graph, for a deterministic
 * level-of-detail contract (smoothstep near..far; 1 near, 0 far).
 */
export function surfaceDetailWeight(metres: number, near: number, far: number): number {
  if (!Number.isFinite(metres) || !Number.isFinite(near) || !Number.isFinite(far) ||
    near < 0 || far <= near) return 0;
  const t = Math.max(0, Math.min(1,(metres - near) / (far - near)));
  return 1 - t*t*(3-2*t);
}

/**
 * CPU mirror of the per-cell asphalt grain hash (integer cell indices in,
 * 0..1 out), so tests can check the spread of the values the shader draws.
 */
export function asphaltGrainHash(cellX: number, cellZ: number): number {
  const { hashDotX, hashDotZ, hashScale } = SURFACE_DETAIL.asphalt;
  const s = Math.sin(cellX * hashDotX + cellZ * hashDotZ) * hashScale;
  return s - Math.floor(s);
}

export const EXPERIMENTAL_SURFACE_DETAIL = parseSurfaceDetailFlag(
  process.env.EXPO_PUBLIC_WORLD_SURFACE_DETAIL,
);
