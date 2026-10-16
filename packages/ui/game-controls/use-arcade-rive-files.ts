import type { ArcadeControllerRive } from './ArcadeController.tsx';

/**
 * Web: the arcade Rive surface renders nothing on web (ArcadeRiveSurface.web),
 * so no file is loaded. The native fork loads the three `.riv` files.
 */
export function useArcadeRiveFiles(): ArcadeControllerRive {
  return {};
}
