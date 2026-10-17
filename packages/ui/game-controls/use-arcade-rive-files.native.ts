import { useRiveFile } from '@rive-app/react-native';
import { arcadeRiveFromFile, arcadeRiveFromFiles, type ArcadeControllerRive } from './ArcadeController.tsx';

// The three controller artboards, built from RML by scripts/rive (Rive CLI)
// and committed next to their sources. Metro bundles them as assets
// (apps/mobile/metro.config.js lists `riv` in assetExts).
const STICK = require('../rive/arcade-controls/left-stick/build/left-stick.riv');
const CLUSTER = require('../rive/arcade-controls/right-six/build/right-six.riv');
const PILL = require('../rive/arcade-controls/start-stop/build/start-stop.riv');
// Same artboards merged into one document by
// rive/arcade-controls/arcade/merge.mjs (GENERATED inputs; the .riv is
// verified byte-identical per artboard to the three files above).
const MERGED = require('../rive/arcade-controls/arcade/build/arcade.riv');

const TRUTHY_FLAG = new Set(['1', 'true', 'on', 'yes']);
/**
 * Opt-in merged controller file — one `useRiveFile` parse (~155 kB) instead
 * of three (~292 kB) and one shared font. Default OFF per the parseSkyRigFlag
 * pattern: `docs/performance/ui-thread-attribution-2026-10-17.md` explains
 * why the win is load-time only and must be confirmed on the Duo before the
 * flag can become the default (lane U1).
 */
const ARCADE_MERGED_RIVE = TRUTHY_FLAG.has(
  String(process.env.EXPO_PUBLIC_ARCADE_MERGED_RIVE ?? '').trim().toLowerCase(),
);

/**
 * Loads the controller's `.riv` assets and returns them as the
 * {@linkcode ArcadeController} `rive` prop. A file still loading or failed to
 * load is left out, so that control renders its accessible hit target with no
 * artwork rather than a stand-in drawing.
 */
export function useArcadeRiveFiles(): ArcadeControllerRive {
  const merged = useRiveFile(ARCADE_MERGED_RIVE ? MERGED : undefined).riveFile ?? undefined;
  const stick = useRiveFile(ARCADE_MERGED_RIVE ? undefined : STICK).riveFile ?? undefined;
  const cluster = useRiveFile(ARCADE_MERGED_RIVE ? undefined : CLUSTER).riveFile ?? undefined;
  const pill = useRiveFile(ARCADE_MERGED_RIVE ? undefined : PILL).riveFile ?? undefined;
  return ARCADE_MERGED_RIVE ? arcadeRiveFromFile(merged) : arcadeRiveFromFiles({ stick, cluster, pill });
}
