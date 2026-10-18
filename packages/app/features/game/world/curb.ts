// Curb height, metres: how far the sidewalks, lots and the ground plane sit
// above the carriageway. Valdrada compiles a 0.135 m reveal (client/src/world/
// materials.js CURB_REVEAL; compile.mjs CURB = 0.14). Only the vd lane raises
// the ground; every other lane keeps the flat city it was tuned on.
import { parseSkyRigFlag } from './sky-rig.ts';

export const CURB_HEIGHT = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD) ? 0.14 : 0;
