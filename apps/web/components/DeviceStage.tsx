'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Image, ThreeCanvas, useInView, useInstanceStore, useStore, type ThreeSetup } from '@acme/ui';
import { Figcaption, Figure } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { DeviceSceneParams, DeviceScreenCopy } from './home/device-scene';

/** The static capture: a render of the scene at its rest pose, on the stage's ink. */
export interface DeviceCapture {
  src: string;
  width: number;
  height: number;
  sizes: string;
}

export interface DeviceStageProps {
  /** `placeholder`: the procedural H-Lynk Core. `h-lynk-entry`: the real model, same frame. */
  model?: DeviceSceneParams['model'];
  /** The words on the H-Lynk's screen, from copy.ts. */
  screen: DeviceScreenCopy;
  /** Shown before the canvas mounts, without JavaScript, under reduced motion, and if no GPU backend starts. */
  capture: DeviceCapture;
  /** Visible caption under the stage. */
  caption: string;
  /** Accessible name of the stage figure. */
  label: string;
  /** Classes for the figure (width, placement). */
  className?: string;
}

// Module-level and stable, so three.js and the scene stay out of the first chunk.
const loadDeviceScene = (): Promise<ThreeSetup<DeviceSceneParams>> =>
  import('./home/device-scene').then((m) => m.createDeviceScene);

const QUERY = '(prefers-reduced-motion: reduce)';
function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}
/** Live `prefers-reduced-motion`. The server pass renders the capture either way. */
function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}

/** Capture → canvas cross-fade, ms. CSS, so it adds no frame loop. */
const HANDOFF_MS = 400;

/**
 * The H-Lynk Core in 3D (PS-017). The server renders the static capture.
 * Within 600 px of the viewport the canvas mounts underneath it, compiles its
 * pipelines off the frame path, and only after its first full frame does the
 * capture fade out, so the stage never shows an empty plate or a stalled
 * frame. Under reduced motion, or if no GPU backend starts, the capture stays.
 *
 * The scene plays one intro (settle, slow turn, the scanner's flare, screen
 * on), then reports that it is at rest and the loop pauses: a still H-Lynk
 * costs no frames. A pointer over the stage wakes it for the tilt (≤ 8°).
 * Offscreen it is paused too.
 */
export function DeviceStage({ model = 'placeholder', screen, capture, caption, label, className }: DeviceStageProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx: 600 });
  const reducedMotion = useReducedMotion();
  const live = hasBeenNear && !reducedMotion;

  // Per-instance state in a store (repo rule: no useState).
  const stage = useInstanceStore(() => ({ ready: false, resting: false }));
  const ready = useStore(stage, (s) => s.ready);
  const resting = useStore(stage, (s) => s.resting);
  const params = useMemo<DeviceSceneParams>(
    () => ({
      model,
      screen,
      onReady: () => stage.setState({ ready: true }),
      onRest: (rest) => stage.setState({ resting: rest }),
    }),
    [model, screen, stage],
  );
  const showCapture = !live || !ready;

  return (
    <Figure aria-label={label} data-testid="w01-device-stage" className={`m-0 w-full gap-3 ${className ?? ''}`}>
      <View ref={ref} className="relative aspect-[4/5] w-full overflow-hidden bg-ink-950">
        {live ? (
          <ThreeCanvas
            load={loadDeviceScene}
            params={params}
            paused={!isVisible || resting}
            maxPixelRatio={1.5}
            className="absolute inset-0"
          />
        ) : null}
        <View
          testID="w01-device-capture"
          aria-hidden
          className="pointer-events-none absolute inset-0"
          // Computed: the hand-off fade follows the scene's ready signal.
          style={{ opacity: showCapture ? 1 : 0, transitionProperty: 'opacity', transitionDuration: `${HANDOFF_MS}ms` }}
        >
          <Image
            src={capture.src}
            alt=""
            fill
            framed={false}
            sizes={capture.sizes}
            loading="lazy"
            className="h-full w-full"
          />
        </View>
      </View>
      <Figcaption className="text-sm leading-6 text-text-muted">{caption}</Figcaption>
    </Figure>
  );
}
