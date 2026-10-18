// Curb height, metres: how far the sidewalks, lots and the ground plane sit
// above the carriageway. Valdrada compiles a 0.135 m reveal (client/src/world/
// materials.js CURB_REVEAL; compile.mjs CURB = 0.14). Only the vd lane raises
// the ground; every other lane keeps the flat city it was tuned on.
import { parseSkyRigFlag } from './sky-rig.ts';

/** The vd lane is on (EXPO_PUBLIC_WORLD_VD): world geometry that only that lane draws keys off this. */
export const VD_LANE = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD);
export const CURB_HEIGHT = VD_LANE ? 0.14 : 0;
