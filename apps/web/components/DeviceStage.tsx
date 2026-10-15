'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  Button, Image, SegmentedControl, Switch, ThreeCanvas, useInView, useInstanceStore, useStore,
  type SegmentedOption, type ThreeSetup,
} from '@acme/ui';
import { Figcaption, Figure, Output } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { DeviceSceneParams } from './home/device-scene';
import { HUD_TABS, hudCaption, initialHudState, type HudContent, type HudTab } from './home/hlynk-hud';
import { playSideKeyChirp, primeSideKeyChirp } from './home/side-key-chirp';

/** The static capture: a render of the scene at its rest pose, on the stage's ink. */
export interface DeviceCapture {
  src: string;
  width: number;
  height: number;
  sizes: string;
}

/** Labels for the controls under the stage, from copy.ts. */
export interface DeviceStageControls {
  /** accessible name of the tab control */
  tabs: string;
  /** the side key button */
  sideKey: string;
  /** the sound switch */
  sound: string;
}

export interface DeviceStageProps {
  /** `placeholder`: the procedural H-Lynk Core. `h-lynk-entry`: the real model, same frame. */
  model?: DeviceSceneParams['model'];
  /** What the H-Lynk's screen shows, per tab. Strings from copy.ts and @acme/content. */
  hud: HudContent;
  controls: DeviceStageControls;
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
 * The H-Lynk Core in 3D (PS-017) with its screen live again (PS-037). The
 * server renders the static capture, the tab control and the caption of the
 * default tab. Within 600 px of the viewport the canvas mounts underneath the
 * capture, compiles its pipelines off the frame path, and only after its
 * first full frame does the capture fade out. Under reduced motion, or if no
 * GPU backend starts, the capture stays and the controls and caption still
 * work: the caption is the screen's content as text.
 *
 * One store per stage holds the tab, the hover target, the sound switch and
 * the side key press count. The DOM radio group is the accessible source of
 * truth; a click or tap on the 3D screen's tab bar writes the same store.
 * The scene repaints its screen only when the store changes.
 *
 * The scene plays one intro, then rests and the loop pauses. A pointer over
 * the stage wakes it for the tilt (≤ 8°). Offscreen it is paused too.
 */
export function DeviceStage({ model = 'placeholder', hud, controls, capture, caption, label, className }: DeviceStageProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx: 600 });
  const reducedMotion = useReducedMotion();
  const live = hasBeenNear && !reducedMotion;

  // Per-instance state in stores (repo rule: no useState).
  const stage = useInstanceStore(() => ({ ready: false, resting: false }));
  const ready = useStore(stage, (s) => s.ready);
  const resting = useStore(stage, (s) => s.resting);
  const screen = useInstanceStore(initialHudState);
  const tab = useStore(screen, (s) => s.tab);
  const pointing = useStore(screen, (s) => s.hover !== null);
  const sound = useStore(screen, (s) => s.sound);

  const params = useMemo<DeviceSceneParams>(() => {
    const pressSideKey = () => {
      const s = screen.getState();
      if (s.sound) playSideKeyChirp();
      screen.setState({ presses: s.presses + 1 });
    };
    return {
      model,
      hud,
      store: screen,
      onSideKey: pressSideKey,
      onReady: () => stage.setState({ ready: true }),
      onRest: (rest) => stage.setState({ resting: rest }),
    };
  }, [model, hud, screen, stage]);
  const options = useMemo<SegmentedOption<HudTab>[]>(
    () => HUD_TABS.map((value) => ({ value, label: hud.tabs[value] })),
    [hud],
  );
  const showCapture = !live || !ready;

  return (
    <Figure aria-label={label} data-testid="w01-device-stage" className={`m-0 w-full gap-3 ${className ?? ''}`}>
      <View
        ref={ref}
        className={`relative aspect-[4/5] w-full overflow-hidden bg-ink-950 ${pointing ? 'cursor-pointer' : ''}`}
        // Count the press for the scene (it raycasts once per press). The 3D
        // side key chirps from a scene frame, after the gesture, so unlock
        // audio inside the gesture itself and every browser lets it play.
        onPointerDown={() => {
          const s = screen.getState();
          if (s.sound) primeSideKeyChirp();
          screen.setState({ taps: s.taps + 1 });
        }}
      >
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
      <View testID="w01-hlynk-controls" className="gap-3">
        <SegmentedControl
          options={options}
          value={tab}
          onChange={(next) => screen.setState({ tab: next })}
          aria-label={controls.tabs}
          tone="apple"
          className="w-full self-stretch"
          segmentClassName="basis-0 px-2 md:px-3"
        />
        <Output
          aria-live="polite"
          data-testid="w01-hlynk-readout"
          className="min-h-[4.5rem] text-sm leading-6 text-text"
        >
          {hudCaption(tab, hud)}
        </Output>
        <View className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Button
            title={controls.sideKey}
            variant="outline"
            tone="apple"
            size="sm"
            onPress={params.onSideKey}
            testID="w01-hlynk-side-key"
          />
          <Switch
            value={sound}
            onChange={(next) => screen.setState({ sound: next })}
            label={controls.sound}
            tone="apple"
            className="w-auto"
          />
        </View>
      </View>
      <Figcaption className="text-sm leading-6 text-text-muted">{caption}</Figcaption>
    </Figure>
  );
}
