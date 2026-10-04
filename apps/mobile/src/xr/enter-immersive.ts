import { enterImmersiveScene, getXrMode } from '@expo-pico/core';
import { isQuest } from '@reactvision/react-viro';

/**
 * Opens the district in PICO's immersive activity. Resolves false on phones,
 * on Quest (the Viro XR navigator owns that path) and if no immersive root is
 * registered, so the caller falls back to the inline view.
 */
export async function enterImmersive(): Promise<boolean> {
  if (isQuest || getXrMode() === 'mobile') return false;
  return enterImmersiveScene();
}
