// The gen lane's opt-in flag, kept in its own module so the pure consumers
// (places.ts, bundled-queries.ts) read it without pulling the layer's
// three.js chain. `EXPO_PUBLIC_WORLD_GEN=1` — default OFF.
import { parseSkyRigFlag } from '../sky-rig.ts';

/** Opt-in lane flag — default OFF, matching the other experimental world lanes. `EXPO_PUBLIC_WORLD_GEN=1`. */
export const EXPERIMENTAL_WORLD_GEN = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_GEN);
