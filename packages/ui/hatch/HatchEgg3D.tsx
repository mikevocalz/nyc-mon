'use client';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { ThreeCanvas } from '../three/ThreeCanvas';
import { loadEggHatch, preloadEggHatch } from '../three/hatch/load-hatch';
import type { EggHatchSceneParams } from '../three/hatch/hatch-scene';
import type { EggHatchSource } from '../three/hatch/egg-hatch-rig';
import type { EggAttention, EggHatchAssetError, EggHatchPhase } from '../three/hatch/hatch-manifest';
import type { ThreeBackend } from '../three/types';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';

export interface HatchEgg3DProps {
  /** The egg's manifest `eggId` (e.g. `metro-egg`); also the cache key. */
  eggId: string;
  /** Manifest JSON and bundled GLB, from `@acme/assets/eggs`. The kit holds no art. */
  source: EggHatchSource;
  /** The presentation phase; null shows the egg idling before the hatch starts. */
  phase: EggHatchPhase | null;
  /**
   * 0–1 through `phase`: the scene seeks there and holds. Leave unset to play
   * the phase in real time from its start (so a resumed phase starts at its
   * beginning) over `phaseMs`.
   */
  progress?: number | null;
  /** Real-time length of `phase` in ms; unset uses the length the clip authors. */
  phaseMs?: number;
  /** Date.now() when the screen entered `phase`. If the egg finishes loading late, it starts the phase that far in, so it stays in step with the screen. */
  phaseStartedAt?: number;
  /** The attention clip for `phase === 'attention'`: the first-look outcome, or `lean-in` once a hesitation is resolved. */
  firstLook: EggAttention;
  /** Each phase holds its end pose: no wobble, no playback. */
  reducedMotion: boolean;
  /**
   * Show the GLB's stand-in Baby (`PROXY_*` nodes). Off by default: in the
   * app the creature layer draws the Baby, and the proxy is a pipeline test
   * piece, not creature art.
   */
  showProxyBaby?: boolean;
  /** Drawn instead of the 3D egg when the GLB fails to load or no renderer runs here. Pass the 2D HatchEgg. */
  fallback: ReactNode;
  /** Called once when the asset fails; the fallback is already showing. */
  onError?: (error: EggHatchAssetError) => void;
  /** Called when the egg is loaded and posed. */
  onReady?: () => void;
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Web only: WebGPURenderer's WebGL2 backend even where WebGPU works. For stories and tests. */
  forceWebGL?: boolean;
  /** Unset means decorative: the screen around it names the egg. */
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

/**
 * The egg's physical hatch from its Blender-built GLB (M12, Decision 29):
 * stir, pressure, three cracks with goo leaking from the fissures, burst and
 * emerge, then an attention clip over the finished hatch. Runs on
 * ThreeCanvas (one WebGPURenderer, its single loop, disposed on unmount).
 * Timing comes from the egg's manifest, so every egg uses this component.
 *
 * Pass `phase` without `progress` and the scene plays that phase over
 * `phaseMs`; pass `progress` to seek and hold. On a load error, a missing
 * clip, or no WebGPU/WebGL2 backend it draws `fallback` and calls `onError`.
 */
export function HatchEgg3D({
  eggId,
  source,
  phase,
  progress = null,
  phaseMs,
  phaseStartedAt,
  firstLook,
  reducedMotion,
  showProxyBaby = false,
  fallback,
  onError,
  onReady,
  onBackendChange,
  forceWebGL,
  accessibilityLabel,
  className,
  testID,
}: HatchEgg3DProps) {
  const status = useInstanceStore(() => ({ failedEggId: null as string | null }));
  const failedEggId = useStore(status, (s) => s.failedEggId);

  // Callbacks go through a ref so a new handler identity doesn't redraw a still frame.
  const handlers = useRef({ onError, onReady });
  useEffect(() => {
    handlers.current = { onError, onReady };
  });
  const stable = useMemo(
    () => ({
      onError: (error: EggHatchAssetError) => {
        console.warn(`[HatchEgg3D] ${eggId} ${error.code}: ${error.message}`);
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

  const params = useMemo<EggHatchSceneParams>(
    () => ({
      eggId,
      source,
      phase,
      progress,
      phaseSeconds: phaseMs === undefined ? null : phaseMs / 1000,
      phaseStartedAt: phaseStartedAt ?? null,
      attention: firstLook,
      reducedMotion,
      showProxyBaby,
      onError: stable.onError,
      onReady: stable.onReady,
    }),
    [eggId, source, phase, progress, phaseMs, phaseStartedAt, firstLook, reducedMotion, showProxyBaby, stable],
  );

  if (failedEggId === eggId) return <>{fallback}</>;
  return (
    <View testID={testID} className={twMerge('flex-1', className)}>
      <ThreeCanvas
        load={loadEggHatch}
        params={params}
        forceWebGL={forceWebGL}
        fallback={fallback}
        tracksPointer={false}
        accessibilityLabel={accessibilityLabel}
        onBackendChange={onBackendChange}
      />
    </View>
  );
}
