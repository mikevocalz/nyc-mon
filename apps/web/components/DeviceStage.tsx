'use client';

import { useSyncExternalStore } from 'react';
import { Image, ThreeCanvas, useInView, type ThreeSetup } from '@acme/ui';
import { Figcaption, Figure } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { DeviceSceneParams } from './home/device-scene';

export interface DeviceStageProps {
  /** `placeholder`: the box model at the H-Lynk Core's proportions. `h-lynk-entry`: the real model, same frame. */
  model?: DeviceSceneParams['model'];
  /** Visible caption under the stage. */
  caption: string;
  /** Classes for the figure (width, aspect). */
  className?: string;
}

/** The static capture shown before the canvas mounts, without JavaScript, and under reduced motion. */
export const DEVICE_CAPTURE = { src: '/home/h-lynk-core.png', width: 896, height: 1120 } as const;

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

/**
 * The H-Lynk in 3D (BUILD_PROMPT §5 "Web hero canvas", D12). The server
 * renders the static capture; on the client the canvas replaces it once the
 * stage comes within 600 px of the viewport, so it never competes with LCP.
 * Offscreen the loop pauses. Under reduced motion the capture stays.
 * Slow idle yaw and a pointer tilt of 8 degrees or less live in the scene.
 */
export function DeviceStage({ model = 'placeholder', caption, className }: DeviceStageProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx: 600 });
  const reducedMotion = useReducedMotion();
  const live = hasBeenNear && !reducedMotion;

  const capture = (
    <Image
      src={DEVICE_CAPTURE.src}
      alt=""
      fill
      framed={false}
      sizes="(min-width: 768px) 40vw, 90vw"
      className="h-full w-full"
    />
  );

  return (
    <Figure aria-label="H-Lynk device" data-testid="w01-device-stage" className={`m-0 w-full gap-3 ${className ?? ''}`}>
      <View ref={ref} className="relative aspect-[4/5] w-full">
        {live ? (
          <ThreeCanvas
            load={loadDeviceScene}
            params={{ model }}
            paused={!isVisible}
            maxPixelRatio={1.5}
            fallback={capture}
            className="absolute inset-0"
          />
        ) : (
          capture
        )}
      </View>
      <Figcaption className="text-sm text-text-muted">{caption}</Figcaption>
    </Figure>
  );
}
