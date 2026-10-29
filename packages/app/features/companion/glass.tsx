'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useIsFocused, usePathname } from 'expo-router';
import { lobbyStore } from '../game/lobby/lobby.store.ts';
import { deriveMonMood, heartsFor } from '@acme/core/sim';
import type { CareNeed, CareState } from '@acme/core/types';
import {
  createGlassScreen, createSwitchScreen, DeviceStage, GLASS_MON_TARGET, glbFraction, glassGeometry, glbProgressStore, KeyboardAwareScroll, releaseHLynkResources, SafeArea, useInstanceStore,
  useReducedMotion, useStore, type DeviceKey, type DeviceScreen, type GlassLayout, type GlassRing, type GlassView, type ScreenModelSource,
} from '@acme/ui';
import { View } from '@acme/ui/tw';
import { StageControls, type StageControl } from '../egg/StageControls';
import { StageLoader } from '../egg/StageLoader';
import { isAccessibilityTextSize } from '../egg/window-layout';
import { companionCopy } from './copy';
import { CompanionPaneLoading } from './CompanionPane';
import { CompanionStageHost, useTabletClass } from './CompanionStageHost';
import { clearCompanion, clearGlass, publishCompanion, publishGlass, setGlassFailed, setStageFrame, useHomeStageStore, type GlassRoute } from './home-stage.store';
import { isLow, NEED_RING } from './home-model';
import { STAGE_LOADING, stageLoaderUp, type StageLoading } from './stage-loading';
import { stageFailureState } from '../system/recovery-model';
import { clipsFor, monModelSource } from './mon-models';

/** The kit's convention for a model that does not exist yet (MonView, EggStill). */
export const COMING_SOON = 'Coming Soon';

/**
 * One care meter as a row of four hearts on the glass (M32 D20a), with M13's
 * label and low wording. One tint for all three, no number, no red.
 */
export function glassRing(need: CareNeed, value: number): GlassRing {
  return {
    id: need, label: companionCopy(NEED_RING[need]), hearts: heartsFor(value), low: isLow(value),
    lowLabel: companionCopy('m13.ring.low'),
  };
}

/**
 * The active Baby on the glass: its rigged model (null source: Coming Soon)
 * and its clips for the mood now, read every frame so a mood change
 * cross-fades in place. `lead` clips play first when the file has them
 * (M14's eating: `jaw_chomp`).
 */
export function useMonGlass(dexId: number | null, care: CareState | undefined, lead: readonly string[] = []) {
  const model = useMemo(() => ({ source: monModelSource(dexId) }), [dexId]);
  const clips = useRef<readonly string[]>([]);
  const mood = care === undefined ? null : deriveMonMood(care);
  const asleep = care?.activity.kind === 'asleep';
  const leadKey = lead.join('\n');
  useEffect(() => {
    clips.current = [...(leadKey === '' ? [] : leadKey.split('\n')), ...(clipsFor(dexId, mood, asleep) ?? [])];
  }, [dexId, mood, asleep, leadKey]);
  const monClips = useCallback(() => clips.current, []);
  return { model, monClips };
}

/**
 * Whether a screen runs on the full-window 3D H-Lynk. Same rule as M08, M10
 * and M11: it does unless motion is reduced, the text is at an accessibility
 * size (the glass can't reflow), or the stage reported it can't run (no
 * GPU). Only then does the 2D shell come back, as the fallback.
 */
export function useGlassOn(failed: boolean): boolean {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const stageFailed = useHomeStageStore((st) => st.glassFailed);
  return !reducedMotion && !isAccessibilityTextSize(fontScale) && !failed && !stageFailed;
}

/** What a tap on the glass does; a route binds these from its own effect (`glass.bind`). */
export interface GlassHandlers {
  readonly onAction: (target: string) => void;
  readonly onModel: () => void;
  readonly monClips: () => readonly string[];
}

/** A built glass screen and the binder for its handlers. */
export interface GlassScreenHandle {
  readonly screen: DeviceScreen;
  /**
   * Hands the screen the route's latest handlers. Call it from the route's
   * own `useEffect` (no deps), never during render: the handlers write the
   * save and read refs, which a render must not do.
   */
  readonly bind: (handlers: Partial<GlassHandlers>) => void;
  /** Presses a glass action through the bound handler, for the hidden accessible controls. */
  readonly press: (target: string) => void;
}

type GlassReaction = { readonly key: number; readonly clips: readonly string[] };
const NO_REACTION: GlassReaction = { key: 0, clips: [] };

const NO_HANDLERS: GlassHandlers = { onAction: () => undefined, onModel: () => undefined, monClips: () => [] };

/**
 * A glass screen (createGlassScreen) that a route rebuilds on every render.
 * It takes data only; the route binds its handlers with `bind` from an
 * effect. The screen itself is built once per layout and model and reads the
 * latest view, handlers and per-frame values from stores, so the stage never
 * rebuilds; the glass repaints only when the view's content changes. `nudge`
 * counts taps on the Baby, and each one wobbles it.
 */
export function useGlassScreen(options: {
  readonly layout: GlassLayout;
  readonly model: { readonly source: ScreenModelSource | null; readonly glow?: string } | null;
  readonly view: GlassView;
  /** Whether the Baby shows now (M16 hides it during the rounds). */
  readonly modelVisible?: boolean;
  /** Where the Baby stands across the glass, a share of its width (M16's peek). */
  readonly modelOffset?: number;
  readonly nudge?: number;
  /**
   * A one-shot clip on the Baby (M13 `attention` / `approach`): bump `key`
   * to play the first of `clips` its GLB has, once.
   */
  readonly reaction?: { readonly key: number; readonly clips: readonly string[] };
  /** The trackpad pans on this screen: a press answers on release, a drag pans (GlassStage `onPan`). */
  readonly padPans?: boolean;
}): GlassScreenHandle {
  const store = useInstanceStore(() => ({
    view: options.view,
    key: JSON.stringify(options.view),
    nudge: options.nudge ?? 0,
    visible: options.modelVisible ?? true,
    offset: options.modelOffset ?? 0,
    reaction: options.reaction ?? NO_REACTION,
  }));
  const handlers = useInstanceStore<GlassHandlers>(() => NO_HANDLERS);
  // After each commit: the view only when its content changed (one repaint per change), and the per-frame values.
  useEffect(() => {
    const key = JSON.stringify(options.view);
    const state = store.getState();
    const next: Partial<{ view: GlassView; key: string; nudge: number; visible: boolean; offset: number; reaction: GlassReaction }> = {};
    if (key !== state.key) Object.assign(next, { view: options.view, key });
    if ((options.nudge ?? 0) !== state.nudge) next.nudge = options.nudge ?? 0;
    if ((options.modelVisible ?? true) !== state.visible) next.visible = options.modelVisible ?? true;
    if ((options.modelOffset ?? 0) !== state.offset) next.offset = options.modelOffset ?? 0;
    if ((options.reaction?.key ?? 0) !== state.reaction.key) next.reaction = options.reaction ?? NO_REACTION;
    if (Object.keys(next).length > 0) store.setState(next);
  });
  const { layout, model } = options;
  const padPans = options.padPans === true;
  const layoutKey = JSON.stringify(layout);
  const modelKey = model === null ? 'none' : model.source === null ? 'soon' : 'eggId' in model.source ? model.source.eggId : model.source.key;
  const screen = useMemo(
    () => createGlassScreen({
      layout,
      model,
      comingSoon: COMING_SOON,
      view: () => store.getState().view,
      subscribe: (onChange) => store.subscribe((next, prev) => {
        if (next.key !== prev.key) onChange();
      }),
      onAction: (target) => handlers.getState().onAction(target),
      onModel: () => handlers.getState().onModel(),
      monClips: () => handlers.getState().monClips(),
      modelVisible: () => store.getState().visible,
      modelOffset: () => store.getState().offset,
      nudge: () => store.getState().nudge,
      monReaction: () => store.getState().reaction,
      padPans,
    }),
    // The scene reads the layout and the model once; rebuild only when they really change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey, modelKey, store, handlers, padPans],
  );
  return useMemo(() => ({
    screen,
    bind: (h: Partial<GlassHandlers>) => handlers.setState(h),
    press: (target: string) => handlers.getState().onAction(target),
  }), [screen, handlers]);
}

/**
 * The glass's buttons as hidden accessible controls (StageControls), each
 * pressing what a tap on the glass would. `testIDOf` names each one.
 */
export function glassControls(
  actions: readonly { readonly target: string; readonly label: string; readonly disabled?: boolean }[],
  onAction: (target: string) => void,
  testIDOf: (target: string) => string,
  hintOf: (target: string) => string | undefined = () => undefined,
): StageControl[] {
  return actions.map((a) => ({
    key: a.target, label: a.label, disabled: a.disabled, hint: hintOf(a.target), onPress: () => onAction(a.target), testID: testIDOf(a.target),
  }));
}

export interface GlassStageProps {
  readonly screen: DeviceScreen;
  /** The stage's accessible name. */
  readonly label: string;
  readonly testIDPrefix: string;
  /** What the glass says, for screen readers (the canvas is hidden from them). Drawn at 1 px, zero opacity. */
  readonly a11y: ReactNode;
  /** Every action on the glass, as real buttons for screen readers, switch control and keyboards. */
  readonly controls: readonly StageControl[];
  readonly onKey: (key: DeviceKey) => void;
  /** No GPU backend: the route goes back to its 2D fallback. */
  readonly onFailed: () => void;
  /** A real control under the device, for what can't be drawn on the glass (M09's text field). */
  readonly below?: ReactNode;
  /**
   * The route's companion pane (CompanionPane), drawn beside or under the
   * device on tablet-class windows only. Phones never render it.
   */
  readonly companion?: ReactNode;
  /** A drag on the 3D trackpad, pt (M13's room pan). Pair it with `useGlassScreen({ padPans: true })`. */
  readonly onPan?: (dxPt: number, dyPt: number) => void;
}

/**
 * A route's screen on the ONE persistent 3D H-Lynk (HomeLayout's
 * PersistentGlass). The route draws no canvas: it publishes its screen and
 * key handler to the stage, which swaps the glass and re-seats the Baby in
 * place, so moving between routes never tears the renderer down, reloads a
 * GLB, replays the intro or shows the loader again. What this renders is
 * transparent: what the glass says for screen readers, every action as a
 * hidden accessible button, and `below`, a real control for what can't be
 * drawn on the glass (M09's text field).
 */
export function GlassStage({ screen, label, testIDPrefix, a11y, controls, onKey, onFailed, below, companion, onPan }: GlassStageProps) {
  const owner = useId();
  const keys = useInstanceStore<{ onKey: (key: DeviceKey) => void; onPan: GlassStageProps['onPan'] }>(() => ({ onKey, onPan }));
  useEffect(() => {
    keys.setState({ onKey, onPan });
  });
  const pans = onPan !== undefined;
  useLayoutEffect(() => {
    publishGlass({
      owner, screen, label, onKey: (key) => keys.getState().onKey(key),
      ...(pans ? { onPan: (dx: number, dy: number) => keys.getState().onPan?.(dx, dy) } : {}),
    });
  }, [owner, screen, label, keys, pans]);
  useLayoutEffect(() => () => clearGlass(owner), [owner]);
  // The pane is republished every render (it carries live data); only the stage host re-renders for it.
  useLayoutEffect(() => {
    if (companion === undefined) clearCompanion(owner);
    else publishCompanion(owner, companion);
  });
  useLayoutEffect(() => () => clearCompanion(owner), [owner]);
  const failed = useHomeStageStore((st) => st.glassFailed);
  useEffect(() => {
    if (failed) onFailed();
  }, [failed, onFailed]);
  // With a companion pane beside it, the device's own overlays (M09's field) stay over the device.
  const frame = useHomeStageStore((st) => st.stageFrame);
  const box = frame === null ? undefined : { left: frame.x, top: frame.y, width: frame.width, height: frame.height };

  return (
    <View className="absolute inset-0" style={{ pointerEvents: 'box-none' }} testID={`${testIDPrefix}-3d`}>
      <View className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0" testID={`${testIDPrefix}-glass-a11y`}>{a11y}</View>
      <StageControls testID={`${testIDPrefix}-stage-controls`} controls={controls} />
      {below ? (
        <View className={box === undefined ? 'absolute inset-0' : 'absolute'} style={[{ pointerEvents: 'box-none' }, box]}>
          <KeyboardAwareScroll className="flex-1" contentContainerClassName="grow justify-end" keyboardShouldPersistTaps="handled">
            <SafeArea edges={['bottom', 'left', 'right']}>{below}</SafeArea>
          </KeyboardAwareScroll>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The persistent stage itself, mounted once by HomeLayout for every `(home)`
 * route on the 3D path: the device, the active Baby loaded once (fitted
 * inside the glass, on its mood's idle), and the Rive loader over both until
 * the device has drawn and the Baby has landed (GlassDevice). It draws the current route's screen
 * (createSwitchScreen); with no route screen it shows the Baby under its
 * name. `fallbackKey` handles the keys then.
 */
export function PersistentGlassStage({
  model, fallback, fallbackKey, label, children,
}: {
  readonly model: { readonly source: ScreenModelSource | null } | null;
  readonly fallback: DeviceScreen;
  readonly fallbackKey: (key: DeviceKey) => void;
  readonly label: string;
  readonly children?: ReactNode;
}) {
  const route = useHomeStageStore((st) => st.glass);
  const current = useInstanceStore<{ screen: DeviceScreen }>(() => ({ screen: route?.screen ?? fallback }));
  useLayoutEffect(() => {
    const next = route?.screen ?? fallback;
    if (current.getState().screen !== next) current.setState({ screen: next });
  }, [route, fallback, current]);
  const keys = useInstanceStore<{ onKey: (key: DeviceKey) => void; onPan: GlassRoute['onPan'] }>(() => ({ onKey: fallbackKey, onPan: undefined }));
  useEffect(() => {
    keys.setState({ onKey: route?.onKey ?? fallbackKey, onPan: route?.onPan });
  });
  const source = model?.source ?? null;
  const modelKey = source === null ? 'none' : 'eggId' in source ? source.eggId : source.key;
  const screen = useMemo(
    () => createSwitchScreen({
      models: source === null ? [] : [{ target: GLASS_MON_TARGET, rect: glassGeometry(PERSISTENT_LAYOUT).model!, source }],
      current: () => current.getState().screen,
      watch: (onChange) => current.subscribe((next, prev) => {
        if (next.screen !== prev.screen) onChange();
      }),
    }),
    // One scene per Baby: the model loads once and stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelKey, current],
  );
  const onKey = useCallback((key: DeviceKey) => keys.getState().onKey(key), [keys]);
  const onPan = useCallback((dx: number, dy: number) => keys.getState().onPan?.(dx, dy), [keys]);

  const tablet = useTabletClass();
  // The root stack keeps (home) mounted under (drawer) routes so the stage
  // never reloads; covered, it must not keep drawing.
  const focused = useIsFocused();
  // Full screens inside (home) that draw their own content over the stage (MONS)
  // hold it too, so only one renderer runs.
  const pathname = usePathname() ?? '/';
  const overlaid = pathname === '/mons' || pathname.startsWith('/mons/');
  // The city is a second WebGPU renderer and a large world. With both alive
  // the iPad runs out of memory, so the H-Lynk releases its renderer while
  // the city is up, and with it the shared GLB parses (the Baby's 26-34 MB
  // file decodes to ~110-190 MB of geometry, morphs and textures), their
  // decoded images and the glass's Skia rasters. On return the device
  // remounts and reloads under its Rive loader.
  const cityUp = useStore(lobbyStore, (st: { phase: string }) => st.phase !== 'lobby');
  useEffect(() => {
    // Passive effects run after the GlassDevice's unmount cleanup, so its rigs have let go and are freed now;
    // a stage still mounted elsewhere in (home) keeps its parse until it unmounts.
    if (cityUp) releaseHLynkResources();
  }, [cityUp]);

  return (
    <View className="absolute inset-0 bg-ink-950" testID="home-glass-stage">
      <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
        <CompanionStageHost
          enabled={tablet.companion}
          pane={<HomeCompanionPane />}
          onFrame={setStageFrame}
          device={
            <>
              {/* Keyed by the Baby: a new Baby is a new scene, and its loader starts over. */}
              {cityUp ? null : <GlassDevice
                key={modelKey}
                screen={screen}
                label={route?.label ?? label}
                loaderLabel={label}
                glassScale={tablet.glassScale}
                onKey={onKey}
                onPan={onPan}
                covered={!focused || overlaid}
                progressKey={source?.kind === 'mon' ? source.key : null}
              />}
              {children}
            </>
          }
        />
      </SafeArea>
    </View>
  );
}

/**
 * The device and its Rive loader. The loader is up from the very first frame
 * and stays until the device has drawn AND the Baby is really on the glass
 * (stage-loading.ts), never lifting on the scene's 8 s model wait. While it is
 * up the stage holds its loop: only the frames the scene asks for draw, and
 * the intro waits to play until the loader lifts. With the GLB's size known
 * the loader fills with the bytes downloaded.
 */
function GlassDevice({ screen, label, loaderLabel, glassScale, onKey, onPan, covered, progressKey }: {
  readonly screen: DeviceScreen;
  readonly label: string;
  readonly loaderLabel: string;
  readonly glassScale: number;
  readonly onKey: (key: DeviceKey) => void;
  readonly onPan: (dxPt: number, dyPt: number) => void;
  /** Another root route is on top of (home): hold the loop (the renderer and the Baby stay loaded). */
  readonly covered: boolean;
  /** The Baby's model key, for its download progress; null with no Baby (or an egg). */
  readonly progressKey: string | null;
}) {
  const loading = useInstanceStore<StageLoading>(() => STAGE_LOADING);
  const up = useStore(loading, stageLoaderUp);
  const progress = useStore(glbProgressStore, (all) => (progressKey === null ? undefined : glbFraction(all[progressKey])));
  const onReady = useCallback(() => loading.setState({ deviceReady: true }), [loading]);
  const onModelsSettled = useCallback(() => loading.setState({ modelsSettled: true }), [loading]);
  // A backend that ran and then went away is a lost context, not a device that can't run 3D (M22).
  const started = useRef(false);
  const onBackend = useCallback((backend: unknown) => {
    if (backend !== null) {
      started.current = true;
      return;
    }
    loading.setState({ failed: true });
    setGlassFailed(stageFailureState(started.current));
  }, [loading]);
  return (
    <>
      <View
        testID="home-device-stage"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute inset-0"
      >
        <DeviceStage
          screen={screen}
          label={label}
          className="h-full"
          stageClassName="min-h-0 w-full flex-1"
          glassScale={glassScale}
          onKey={onKey}
          onPan={onPan}
          onReady={onReady}
          onModelsSettled={onModelsSettled}
          onBackendChange={onBackend}
          hold={up || covered}
        />
      </View>
      {up ? <StageLoader label={loaderLabel} testID="home-stage-loader" progress={progress} /> : null}
    </>
  );
}

/** The current route's pane, or the loading state while the next route mounts. */
function HomeCompanionPane() {
  const companion = useHomeStageStore((st) => st.companion);
  return <>{companion?.node ?? <CompanionPaneLoading />}</>;
}

/** The persistent stage's default slot for the Baby (re-seated per screen through `modelRect`). */
export const PERSISTENT_LAYOUT = { model: 'large', rings: false, lineRows: 0, actionRows: 0, perRow: 1 } as const;
