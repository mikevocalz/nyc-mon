// Curb height, metres: how far the sidewalks, lots and the ground plane sit
// above the carriageway. Valdrada compiles a 0.135 m reveal (client/src/world/
// materials.js CURB_REVEAL; compile.mjs CURB = 0.14). Only the vd lane raises
// the ground; every other lane keeps the flat city it was tuned on.
import { parseSkyRigFlag } from './sky-rig.ts';

/** The vd lane is on (EXPO_PUBLIC_WORLD_VD): world geometry that only that lane draws keys off this. */
export const VD_LANE = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD);
export const CURB_HEIGHT = VD_LANE ? 0.14 : 0;
/**
 * Real sun shadows on the vd lane (EXPO_PUBLIC_WORLD_VD_SHADOWS, default on
 * with the lane; set it to 0 to drop them). The repo held shadow maps off
 * because rn-webgpu once rendered them black; this is the switch for the
 * device check.
 */
export const VD_SHADOWS = VD_LANE && process.env.EXPO_PUBLIC_WORLD_VD_SHADOWS?.trim() !== '0';
/** Half-size of the sun's shadow box around the Caller, metres; the map covers 2x this square. */
export const VD_SHADOW_HALF = 70;
