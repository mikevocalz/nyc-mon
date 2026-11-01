// Curb height, metres: how far the sidewalks, lots and the ground plane sit
// above the carriageway. Valdrada compiles a 0.135 m reveal (client/src/world/
// materials.js CURB_REVEAL; compile.mjs CURB = 0.14). Only the vd lane raises
// the ground; every other lane keeps the flat city it was tuned on.
import { parseDefaultOnFlag } from './sky-rig.ts';

/**
 * The vd lane (Valdrada's look) is on: world geometry that only that lane
 * draws keys off this. Default ON since Mike asked for the Valdrada city on
 * the iPad (2026-10-28); EXPO_PUBLIC_WORLD_VD=0 is the kill switch.
 */
export const VD_LANE = parseDefaultOnFlag(process.env.EXPO_PUBLIC_WORLD_VD);
export const CURB_HEIGHT = VD_LANE ? 0.14 : 0;
/**
 * Real sun shadows on the vd lane (EXPO_PUBLIC_WORLD_VD_SHADOWS, default on
 * with the lane; set it to 0 to drop them). The repo held shadow maps off
 * because rn-webgpu once rendered them black; this is the switch for the
 * device check.
 */
export const VD_SHADOWS = VD_LANE && process.env.EXPO_PUBLIC_WORLD_VD_SHADOWS?.trim() !== '0';
/**
 * Direct renderer tone mapping on the vd lane (EXPO_PUBLIC_WORLD_VD_TONEMAP=agx|aces|neutral),
 * default agx as Valdrada grades, 'none' to drop it; no post pipeline: the RenderPipeline path stalls world setup on the Duo
 * (WorldNotReadyError, 2026-10-18), the renderer's own output transform does not
 * add render targets.
 */
const tonemapEnv = process.env.EXPO_PUBLIC_WORLD_VD_TONEMAP?.trim().toLowerCase();
export const VD_TONEMAP = !VD_LANE || tonemapEnv === 'none' ? '' : (tonemapEnv || 'agx');
/** Half-size of the sun's shadow box around the Caller, metres; the map covers 2x this square. */
export const VD_SHADOW_HALF = 70;
