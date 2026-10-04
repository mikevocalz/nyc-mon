/**
 * App entry.
 *
 * Two React roots, because PICO runs the app as a flat 2D panel and only hands
 * the display to an immersive activity on demand:
 *
 *   "main"          MainActivity, the 2D panel (expo-router). Always the launch target.
 *   "VRQuestScene"  VRActivity, entered through enterImmersiveScene().
 *
 * The immersive root is registered here at module scope. Entering XR starts
 * VRActivity immediately, so a root registered later from a route arrives too
 * late and the activity sits on a blank loading screen. Same pattern as
 * mikevocalz/expo-pico's example/index.js.
 *
 * Quest keeps Viro's XR navigator (SpatialViroExperience), which sets its own
 * intent before launching VRActivity; stock Viro takes that path only on Quest
 * branding, so this root is what PICO mounts.
 */
import 'expo-router/entry';
import { registerImmersiveScene } from '@expo-pico/core';

import { DistrictImmersiveRoot } from './src/xr/DistrictImmersiveRoot';

registerImmersiveScene(DistrictImmersiveRoot);
