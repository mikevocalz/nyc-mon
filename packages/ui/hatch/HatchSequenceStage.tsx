'use client';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { ThreeCanvas } from '../three/ThreeCanvas';
import { loadHatchSequence, preloadEggHatch } from '../three/hatch/load-hatch';
import type { HatchBabySource, HatchSequenceSceneParams } from '../three/hatch/hatch-sequence-scene';
import type { SequencePhase } from '../three/hatch/hatch-sequence-time';
import type { EggHatchSource } from '../three/hatch/egg-hatch-rig';
import type { EggHatchAssetError } from '../three/hatch/hatch-manifest';
import type { ThreeBackend } from '../three/types';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';

export interface HatchSequenceStageProps {
  /** The egg's manifest `eggId`; also the rig cache key. */
  eggId: string;
  /** Manifest JSON and bundled GLB, from `@acme/assets/eggs`. */
  source: EggHatchSource;
  /** The Baby to hand over to, or null when the host draws the Baby (the app's creature layer). */
  baby?: HatchBabySource | null;
  /** M12's phase; null shows the egg idling before the hatch. */
  phase: SequencePhase | null;
  /** The screen's length for `phase`, ms. */
  phaseMs: number;
  /** Date.now() when the screen entered `phase`. */
  phaseStartedAt: number;
  /** The timeline's reduced path: no shakes, cracks or white-out; one cross-fade. */
  reducedMotion: boolean;
  /** Drawn when the GLB fails or no renderer runs here. */
  fallback: ReactNode;
  onReady?: () => void;
  onError?: (error: EggHatchAssetError) => void;
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Unset means decorative: the screen around it names the egg. */
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

/**
 * The hatch moment from the Alexa view (HatchSequence3D) on the shared
 * ThreeCanvas, so it runs on native (react-native-webgpu) and on web with no
 * DOM: dim, three shakes and cracks, light through the cracks, sparkles and
 * orbits, the white-out and shards, then the Baby's silhouette resolving
 * into colour (hatch-sequence-scene.ts). M12 drives it phase by phase.
 */
export function HatchSequenceStage({
  eggId, source, baby = null, phase, phaseMs, phaseStartedAt, reducedMotion, fallback, onReady, onError, onBackendChange,
  accessibilityLabel, className, testID,
}: HatchSequenceStageProps) {
  const status = useInstanceStore(() => ({ failedEggId: null as string | null }));
  const failedEggId = useStore(status, (s) => s.failedEggId);

  // Callbacks go through a ref so a new handler identity doesn't rebuild the params.
  const handlers = useRef({ onError, onReady });
  useEffect(() => {
    handlers.current = { onError, onReady };
  });
  const stable = useMemo(
    () => ({
      onError: (error: EggHatchAssetError) => {
        console.warn(`[HatchSequenceStage] ${eggId} ${error.code}: ${error.message}`);
        status.setState({ failedEggId: eggId });
        handlers.current.onError?.(error);
      },
      onReady: () => handlers.current.onReady?.(),
    }),
    [eggId, status],
  );

  useEffect(() => {
    preloadEggHatch(eggId, source);
  }, [eggId, source]);

  const params = useMemo<HatchSequenceSceneParams>(
    () => ({
      eggId, egg: source, baby, phase, phaseMs, phaseStartedAt, reducedMotion, onError: stable.onError, onReady: stable.onReady,
    }),
    [eggId, source, baby, phase, phaseMs, phaseStartedAt, reducedMotion, stable],
  );

  if (failedEggId === eggId) return <>{fallback}</>;
  return (
    <View testID={testID} className={twMerge('flex-1', className)}>
      <ThreeCanvas
        load={loadHatchSequence}
        params={params}
        fallback={fallback}
        tracksPointer={false}
        accessibilityLabel={accessibilityLabel}
        onBackendChange={onBackendChange}
      />
    </View>
  );
}
