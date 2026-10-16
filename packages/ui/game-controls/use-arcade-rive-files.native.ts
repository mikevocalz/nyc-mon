import { useRiveFile } from '@rive-app/react-native';
import { arcadeRiveFromFiles, type ArcadeControllerRive } from './ArcadeController.tsx';

// The three controller artboards, built from RML by scripts/rive (Rive CLI)
// and committed next to their sources. Metro bundles them as assets
// (apps/mobile/metro.config.js lists `riv` in assetExts).
const STICK = require('../rive/arcade-controls/left-stick/build/left-stick.riv');
const CLUSTER = require('../rive/arcade-controls/right-six/build/right-six.riv');
const PILL = require('../rive/arcade-controls/start-stop/build/start-stop.riv');

/**
 * Loads the controller's three `.riv` files and returns them as the
 * {@linkcode ArcadeController} `rive` prop. A file still loading or failed to
 * load is left out, so that control renders its accessible hit target with no
 * artwork rather than a stand-in drawing.
 */
export function useArcadeRiveFiles(): ArcadeControllerRive {
  const stick = useRiveFile(STICK).riveFile ?? undefined;
  const cluster = useRiveFile(CLUSTER).riveFile ?? undefined;
  const pill = useRiveFile(PILL).riveFile ?? undefined;
  return arcadeRiveFromFiles({ stick, cluster, pill });
}
