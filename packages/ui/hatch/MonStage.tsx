'use client';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { ThreeCanvas } from '../three/ThreeCanvas';
import { loadMonScene, preloadMonModel } from '../three/hatch/load-hatch';
import type { MonSceneParams } from '../three/mon/mon-scene';
import type { MonRigSource } from '../three/mon/mon-rig';
import type { ThreeBackend } from '../three/types';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';

export interface MonStageProps {
  /** The Baby's GLB, its mood's clips and its mouth's rest pose. A new `clips` list cross-fades in place. */
  source: MonRigSource;
  reducedMotion: boolean;
  /** Drawn when the GLB fails or no renderer runs here. */
  fallback: ReactNode;
  /** Once, after the first frame with the Mon in it: the hatch stage over it can go (no blink). */
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Unset means decorative: the screen around it names the Mon. */
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

/**
 * The Alexa view's MonModel3D on the shared ThreeCanvas (mon-scene.ts), so
 * it runs on native and web with no DOM: the Baby standing face-on, idling
 * on its mood's clips. M12 mounts it under the hatch sequence once the Baby
 * is out and drops the sequence after this stage's first frame, the same
 * hand-over MonView's HatchStage makes, so the Baby never blinks.
 */
export function MonStage({
  source, reducedMotion, fallback, onReady, onError, onBackendChange, accessibilityLabel, className, testID,
}: MonStageProps) {
  const status = useInstanceStore(() => ({ failedKey: null as string | null }));
  const failedKey = useStore(status, (s) => s.failedKey);

  const handlers = useRef({ onError, onReady });
  useEffect(() => {
    handlers.current = { onError, onReady };
  });
  const stable = useMemo(
    () => ({
      onError: (error: unknown) => {
        console.warn(`[MonStage] ${source.key} did not load`, error);
        status.setState({ failedKey: source.key });
        handlers.current.onError?.(error);
      },
      onReady: () => handlers.current.onReady?.(),
    }),
    [source.key, status],
  );

  useEffect(() => {
    preloadMonModel(source);
  }, [source]);

  const params = useMemo<MonSceneParams>(
    () => ({ source, reducedMotion, onError: stable.onError, onReady: stable.onReady }),
    [source, reducedMotion, stable],
  );

  if (failedKey === source.key) return <>{fallback}</>;
  return (
    <View testID={testID} className={twMerge('flex-1', className)}>
      <ThreeCanvas
        load={loadMonScene}
        params={params}
        fallback={fallback}
        tracksPointer={false}
        accessibilityLabel={accessibilityLabel}
        onBackendChange={onBackendChange}
      />
    </View>
  );
}
