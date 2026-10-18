'use client';
// The overlay root (Master Directive v2 §13): one router, the stick (analog
// or D-pad by profile), the six-button cluster and the START/STOP pill,
// placed by lane D's AdaptiveControlLayout. The game session owns state; the
// router validates input; Rive reflects. This component wires the three
// touch adapters to the router, derives each cap's visual state from the
// router's events (a discrete store write per press, never per frame), and
// runs haptics through the kit's vocabulary scaled by the profile.
//
// Cap visual states: `pressed` on an accepted button-down, `held` once the
// press has lasted HELD_AFTER_MS, `idle` on button-up, every cap `idle` on
// `cancel-all`. `disabled` comes from the binding's `enabled: false`, the
// `disabled` prop or preview mode; `cooldown` only from `buttonOverrides`,
// because the kit knows no game mechanic that would start one (§2B).
//
// The pill goes through the router: tap in `start` sends `resumeRequest`
// unless `onStart` is given (lane E decides what starts a session: G01
// 08-handoff.md § Interaction), tap in `playing`/`paused` sends
// `pauseRequest`/`resumeRequest`, a completed hold sends `stopRequest`.
// Keyboard and gamepad adapters are lane C2's; they call the same router.
//
// Touch and accessibility presses go through a TouchInputGate: downs only
// while live, ups always, and a cancelAll when the controller stops being
// live, so a cap released after `disabled` or `mode` flipped never stays held
// in the router (finding H4). The gate also owns the accessibility press
// timers and releases them on unmount (finding L7).
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { RiveFile } from '@rive-app/react-native';
import { Button } from '../Button';
import { testIdProps } from '../hlynk/a11y';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { AnalogStick, type StickAccessibilityAction } from './AnalogStick.tsx';
import { ArcadeSixButtons, type ButtonStates } from './ArcadeSixButtons.tsx';
import type { ArcadeRiveSource } from './ArcadeRiveSurface.types.ts';
import { StartStopPill, type StartStopPillState } from './StartStopPill.tsx';
import {
  BUTTON_IDS,
  type ButtonId,
  type ButtonVisualState,
  type ControllerBindings,
  type ControllerProfile,
  type GameInputRouter,
  type InputEvent,
} from './contract.ts';
import { controllerHaptics } from './controller-haptics.ts';
import { AdaptiveControlLayout, type AdaptiveControlLayoutProps } from './layout/index.ts';
import { hardwareInputStore } from './hardware/hardware-input.store.ts';
import { createTouchInputGate } from './touch-input-gate.ts';

/** The three artboards, each optional until lane B's `.riv` lands. */
export interface ArcadeControllerRive {
  readonly stick?: ArcadeRiveSource;
  readonly cluster?: ArcadeRiveSource;
  readonly pill?: ArcadeRiveSource;
}

/** Loads the three sources from already-loaded files with the default artboards. */
export function arcadeRiveFromFiles(files: { stick?: RiveFile; cluster?: RiveFile; pill?: RiveFile }): ArcadeControllerRive {
  return {
    stick: files.stick ? { file: files.stick } : undefined,
    cluster: files.cluster ? { file: files.cluster } : undefined,
    pill: files.pill ? { file: files.pill } : undefined,
  };
}

/**
 * The artboard names inside the merged `arcade.riv` — generated from the
 * three sibling projects by `packages/ui/rive/arcade-controls/arcade/
 * merge.mjs` and verified byte-identical to the per-file builds.
 */
export const MERGED_STICK_ARTBOARD = 'LeftStick';
export const MERGED_CLUSTER_ARTBOARD = 'RightSix';
export const MERGED_PILL_ARTBOARD = 'StartStop';

/**
 * Shares one already-loaded merged file across the three controls: one
 * `useRiveFile` parse instead of three. The Thumbpad surface keeps its own
 * hardcoded artboard/state-machine names, so it is not listed here.
 */
export function arcadeRiveFromFile(file: RiveFile | undefined): ArcadeControllerRive {
  if (!file) return {};
  return {
    stick: { file, artboardName: MERGED_STICK_ARTBOARD },
    cluster: { file, artboardName: MERGED_CLUSTER_ARTBOARD },
    pill: { file, artboardName: MERGED_PILL_ARTBOARD },
  };
}

/** Props of {@linkcode ArcadeController}. */
export interface ArcadeControllerProps
  extends Pick<AdaptiveControlLayoutProps, 'savedLayouts' | 'insets' | 'hardwareFamily' | 'runtime' | 'hideTouchControls' | 'onLayoutResolved'> {
  /** The one profile from the settings store. */
  readonly profile: ControllerProfile;
  /** What each cap means on this screen. Caps with `enabled: false` render disabled and their presses are dropped. */
  readonly bindings: ControllerBindings;
  /** The screen's router. The controller subscribes to it for cap states and calls it for every input. */
  readonly router: GameInputRouter;
  /** The session's pill state. The pill reflects it and never changes it. */
  readonly pill: StartStopPillState;
  /** Session-driven hold-ring fill while `pill` is `stopConfirm`. @default 0 */
  readonly stopProgress?: number;
  readonly reducedMotion: boolean;
  /** `preview` (the settings screen) renders and animates but never calls the router or haptics. @default 'play' */
  readonly mode?: 'play' | 'preview';
  /** Everything disabled: caps `disabled`, the stick inert, the pill `disabled`. @default false */
  readonly disabled?: boolean;
  /** Visual states the session imposes on caps (a cooldown it runs, a cap it has disabled). */
  readonly buttonOverrides?: Partial<Record<ButtonId, Extract<ButtonVisualState, 'cooldown' | 'disabled'>>>;
  /** Spoken cap names (the bound actions); defaults to the labels. */
  readonly spokenLabels?: Partial<Record<ButtonId, string>>;
  /** Non-drag camera commands the stick lists for screen readers (WCAG 2.5.7). */
  readonly stickA11yActions?: readonly StickAccessibilityAction[];
  readonly rive?: ArcadeControllerRive;
  /** What a tap in `start` does. Default: `router.resumeRequest('touch')`. */
  readonly onStart?: () => void;
  /** The pill's hold began; the session may enter `stopConfirm`. */
  readonly onStopHoldStart?: () => void;
  /** The hold ended before completing; nothing was requested. */
  readonly onStopReleased?: () => void;
  /** Optional content over the clear sightline; never a control. */
  readonly stage?: (slot: Parameters<NonNullable<AdaptiveControlLayoutProps['stage']>>[0]) => ReactNode;
  readonly testID?: string;
}

/** A press this long reads as `held` (ring on). */
export const HELD_AFTER_MS = 250;

interface CapStore {
  states: ButtonStates;
}

const IDLE: ButtonStates = {};

/**
 * Composes {@linkcode AnalogStick} (or the D-pad), {@linkcode ArcadeSixButtons}
 * and {@linkcode StartStopPill} around one {@linkcode GameInputRouter}.
 * The stick works while caps are held; two caps work together; a
 * cancellation clears every cap in one event.
 *
 * @example
 * ```tsx
 * const router = useMemo(() => createGameInputRouter({ bindings }), [bindings]);
 * <ArcadeController profile={profile} bindings={bindings} router={router} pill={session.pill} reducedMotion={reduced} />
 * ```
 */
export function ArcadeController({
  profile,
  bindings,
  router,
  pill,
  stopProgress = 0,
  reducedMotion,
  mode = 'play',
  disabled = false,
  buttonOverrides,
  spokenLabels,
  stickA11yActions,
  rive,
  onStart,
  onStopHoldStart,
  onStopReleased,
  stage,
  savedLayouts,
  insets,
  hardwareFamily,
  runtime,
  hideTouchControls,
  onLayoutResolved,
  testID,
}: ArcadeControllerProps) {
  const live = mode === 'play' && !disabled;
  const haptics = controllerHaptics(live ? profile.haptics : 'off');

  // One gate per router. It starts closed; the effect opens it after commit, before any touch can land.
  const gate = useMemo(() => createTouchInputGate({ router, live: false }), [router]);
  useEffect(() => { gate.setLive(live); }, [gate, live]);
  useEffect(() => () => gate.dispose(), [gate]);
  // The touch slots are about to unmount: end what touch holds, leave the hardware press that hid them.
  useEffect(() => { if (hideTouchControls) gate.releaseTouch(); }, [gate, hideTouchControls]);
  const handleLayoutResolved: AdaptiveControlLayoutProps['onLayoutResolved'] = (layout) => {
    if (layout.cramped) gate.releaseTouch();
    onLayoutResolved?.(layout);
  };

  // Cap visual states from the router's events: a store write per press, read with a selector.
  const caps = useInstanceStore<CapStore>(() => ({ states: IDLE }));
  const routerStates = useStore(caps, (s) => s.states);
  const heldTimers = useRef(new Map<ButtonId, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = heldTimers.current;
    const setCap = (id: ButtonId, state: ButtonVisualState | undefined) => {
      const current = caps.getState().states;
      if (current[id] === state) return;
      const next = { ...current };
      if (state === undefined) delete next[id];
      else next[id] = state;
      caps.setState({ states: next });
    };
    const clearTimer = (id: ButtonId) => {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.delete(id);
    };
    const onEvent = (event: InputEvent) => {
      switch (event.kind) {
        case 'button-down':
          setCap(event.button, 'pressed');
          clearTimer(event.button);
          timers.set(event.button, setTimeout(() => {
            timers.delete(event.button);
            if (router.heldButtons.has(event.button)) setCap(event.button, 'held');
          }, HELD_AFTER_MS));
          return;
        case 'button-up':
          if (!router.heldButtons.has(event.button)) {
            clearTimer(event.button);
            setCap(event.button, undefined);
          }
          return;
        case 'cancel-all':
          for (const id of BUTTON_IDS) clearTimer(id);
          caps.setState({ states: IDLE });
          return;
        case 'move':
        case 'pause-request':
        case 'resume-request':
        case 'stop-request':
          return;
      }
    };
    const subscription = router.addListener(onEvent);
    return () => {
      subscription.remove();
      for (const id of BUTTON_IDS) clearTimer(id);
    };
  }, [caps, router]);

  const states: ButtonStates = {};
  for (const id of BUTTON_IDS) {
    const override = buttonOverrides?.[id];
    if (!live || bindings[id].enabled === false) states[id] = 'disabled';
    else if (override) states[id] = override;
    else if (routerStates[id]) states[id] = routerStates[id];
  }

  const source = 'touch' as const;
  const onDown = (id: ButtonId, timestampMs: number) => {
    if (gate.down(id, timestampMs)) haptics.press();
  };
  const onUp = (id: ButtonId, timestampMs: number) => gate.up(id, timestampMs);
  const onAccessibilityActivate = (id: ButtonId) => gate.accessibilityActivate(id);

  const pillState: StartStopPillState = live ? pill : 'disabled';
  const pillProps = (() => {
    const common = { reducedMotion, rive: rive?.pill, testID: testID ? `${testID}-pill` : undefined };
    switch (pillState) {
      case 'start':
        return { ...common, state: 'start' as const, onStart: () => { haptics.toggle(); (onStart ?? (() => router.resumeRequest(source)))(); } };
      case 'playing':
        return {
          ...common,
          state: 'playing' as const,
          onPause: () => { haptics.toggle(); router.pauseRequest(source); },
          onStopHoldStart,
          onStopHoldComplete: () => { haptics.stopConfirm(); router.stopRequest(source); },
          onStopReleased,
        };
      case 'paused':
        return {
          ...common,
          state: 'paused' as const,
          onResume: () => { haptics.toggle(); router.resumeRequest(source); },
          onStopHoldStart,
          onStopHoldComplete: () => { haptics.stopConfirm(); router.stopRequest(source); },
          onStopReleased,
        };
      case 'stopConfirm':
        return {
          ...common,
          state: 'stopConfirm' as const,
          progress: stopProgress,
          onStopHoldComplete: () => { haptics.stopConfirm(); router.stopRequest(source); },
          onStopReleased: onStopReleased ?? (() => undefined),
          // A release inside the tap window still means pause/resume: cancel
          // the confirm first, then let each request pair itself to the state
          // the cancel restored (playing → pause-request, paused → resume).
          onShortPress: () => {
            (onStopReleased ?? (() => undefined))();
            router.pauseRequest(source);
            router.resumeRequest(source);
          },
        };
      case 'disabled':
        return { ...common, state: 'disabled' as const };
    }
  })();

  return (
    <View
      {...testIdProps(testID)}
      className="flex-1"
      pointerEvents="box-none"
      // Computed: overlay opacity is the profile's (0.3…1).
      style={{ opacity: profile.opacity }}
    >
      <AdaptiveControlLayout
        profile={profile}
        savedLayouts={savedLayouts}
        insets={insets}
        hardwareFamily={hardwareFamily}
        runtime={runtime}
        hideTouchControls={hideTouchControls}
        onLayoutResolved={handleLayoutResolved}
        stage={stage}
        restoreTouch={() => (
          <View className="flex-1 items-center justify-center">
            <Button
              // Copy: no deck row yet; reported for G01 05-copy.md (the g01.cancel.source line says "Touch controls are on").
              title="Show touch controls"
              variant="outline"
              size="sm"
              onPress={() => hardwareInputStore.getState().setActiveSource('touch')}
              testID={testID ? `${testID}-restore-touch` : undefined}
            />
          </View>
        )}
        stick={(slot) => (
          <AnalogStick
            mode={profile.stickMode}
            placement={profile.stickPlacement}
            tuning={profile.stick}
            scale={slot.layout.scale}
            disabled={!live}
            reducedMotion={reducedMotion}
            rive={rive?.stick}
            a11yActions={stickA11yActions}
            onMove={(reading, phase, timestampMs) => {
              if (phase === 'begin' && live) haptics.press();
              gate.move(reading.x, reading.y, phase, timestampMs);
            }}
            testID={testID ? `${testID}-stick` : undefined}
          />
        )}
        cluster={(slot) => (
          <View className="flex-1 items-center justify-center">
            <ArcadeSixButtons
              bindings={bindings}
              handedness={profile.handedness}
              scale={slot.layout.scale}
              states={states}
              reducedMotion={reducedMotion}
              rive={rive?.cluster}
              showIcons={profile.showIcons}
              spokenLabels={spokenLabels}
              onDown={onDown}
              onUp={onUp}
              onAccessibilityActivate={onAccessibilityActivate}
              testID={testID ? `${testID}-cluster` : undefined}
            />
          </View>
        )}
        pill={() => (
          <View className="flex-1 items-center justify-center">
            <StartStopPill {...pillProps} />
          </View>
        )}
      />
    </View>
  );
}
