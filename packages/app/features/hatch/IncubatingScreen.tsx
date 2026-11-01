'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { eggHatchAssetForSpecies } from '@acme/assets/eggs';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  HLYNK_COPY, IncubationRing, SafeArea, StageReadyGate, StatusRow, TrackpadActions, createIncubatingScreen, createStageReady,
  DeviceStage, inhaleStarted, preloadEggHatch, useInstanceStore, useLedBreathPhase, useReducedMotion, useStore,
  type DeviceKey, type HLynkStatus, type IncubatingView, type StageReadyResource, type StatusRowItem,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import type { PendingEgg } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { getNotifyPermission, requestNotifyPermission, scheduleReadyNotification, type NotifyPermission } from '../onboarding/notify-permission';
import { readyBannerHold } from '../onboarding/notify-foreground';
import { schemeForTime } from '../onboarding/time-scheme';
import { setHomeMenuOpen, useHomeStage, useHomeStageStore } from '../companion/home-stage.store';
import { useMinuteClock } from '../companion/minute-clock';
import { eggIdentity } from '../companion/mon-identity';
import { CompanionStageHost, useTabletClass } from '../companion/CompanionStageHost';
import { eggCopy } from '../egg/copy';
import { EggStill } from '../egg/EggStill';
import { IncubationPane } from '../egg/IncubationPane';
import { eggSpeciesModel } from '../egg/egg-source';
import { StageControls } from '../egg/StageControls';
import { StageLoader } from '../egg/StageLoader';
import { isAccessibilityTextSize } from '../egg/window-layout';
import { useEggVoice } from '../voice/use-mon-voice';
import { hatchCopy } from './copy';
import { detailLine, incubationProgress, incubationView, minutesLeft, timeLine } from './incubation-model';

/** The picked wait in words, for the incubation pane (M10's option labels). */
const INCUBATION_A11Y = { 15: 'm10.option.15.a11y', 30: 'm10.option.30.a11y', 60: 'm10.option.60.a11y' } as const;
const PANE_CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** One warm announcement per this window at most (M11 copy). */
const WARM_ANNOUNCE_MS = 10_000;
/** Egg size, matching M12's `HatchEgg` so the egg does not jump between M11 and M12. */
const EGG_PT = 120;
/** The "resting" caption shows only when the egg was just created (first arrival from M10). */
const FIRST_ARRIVAL_MS = 5 * 60_000;
const captionSeen = new Set<string>();
/** The kit's convention for a model that does not exist yet (MonView, EggStill). */
const COMING_SOON = 'Coming Soon';

/** The egg's glow on the glass: it warms as incubation runs, a tap of "Keep it warm" adds a breath, ready is full. */
function glassWarmth(view: IncubatingView, holding: boolean): number {
  if (view.ready) return 1;
  return Math.min(1, 0.2 + 0.5 * view.progress + (holding ? 0.4 : 0));
}

function sameNotify(a: IncubatingView['notify'], b: IncubatingView['notify']): boolean {
  return a === b || (a !== null && b !== null && a.label === b.label && a.action === b.action);
}
function sameView(a: IncubatingView, b: IncubatingView): boolean {
  return a.status === b.status && a.progress === b.progress && a.ready === b.ready && a.time === b.time
    && a.detail === b.detail && a.caption === b.caption && a.action === b.action && sameNotify(a.notify, b.notify);
}

interface Handlers {
  readonly action: () => void;
  readonly egg: () => void;
  readonly notify: () => void;
  readonly key: (key: DeviceKey) => void;
}

interface LocalState {
  entryMs: number;
  readyLatched: boolean;
  announcedReady: boolean;
  permission: NotifyPermission | undefined;
  scheduleFailed: boolean;
  holding: boolean;
  lastWarmAnnounceMs: number | undefined;
  showCaption: boolean;
  /** The 3D H-Lynk: `starting` until its first frame with the egg, `ready`, or `failed` (the 2D shell then). */
  stage3d: 'starting' | 'ready' | 'failed';
  stageReady: StageReadyResource;
  /** "Keep it warm" presses on the 3D stage: each one wobbles the egg once (DeviceScreen.nudge). */
  nudges: number;
}

/**
 * M11 Incubating, rendered at `/(home)` while the egg incubates. The egg sits
 * in the scene on its own, with no case (Decision 29). Writes nothing:
 * readiness is the hatch state ticked to the minute clock, not persisted
 * (Law 6); the only commit is M12's `open`. "Keep it warm" is haptic and
 * announced only, with no sim effect (a reviewer should reject any
 * `applyCare` or bond change wired to it). The egg answers a warm with a
 * babble from inside the shell, and babbles now and then on its own
 * (Decision 32); its babble takes the caption line while it shows.
 */
export function IncubatingScreen({ pending }: { pending: PendingEgg }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const nowMs = useMinuteClock((s) => s.nowMs);
  const { egg, hatch } = pending;
  const id = eggIdentity(egg);
  const voice = useEggVoice(egg);
  // Fetch and parse the hatch GLB while the egg incubates, so M12 starts on time.
  useEffect(() => {
    const asset = eggHatchAssetForSpecies(egg.speciesId);
    if (asset) preloadEggHatch(asset.eggId, asset);
  }, [egg.speciesId]);

  const local = useInstanceStore<LocalState>(() => {
    const entryMs = Date.now();
    const fresh = entryMs - egg.createdAt < FIRST_ARRIVAL_MS && !captionSeen.has(egg.eggId);
    captionSeen.add(egg.eggId);
    return {
      entryMs, readyLatched: false, announcedReady: false, permission: undefined, scheduleFailed: false,
      holding: false, lastWarmAnnounceMs: undefined, showCaption: fresh,
      stage3d: 'starting', stageReady: createStageReady(), nudges: 0,
    };
  });
  const s = useStore(local);
  const tablet = useTabletClass();

  const view = incubationView(hatch, egg, nowMs, s.entryMs, s.readyLatched);
  const ready = view === 'ready' || view === 'overdue' || view === 'resume';

  // Latch ready (a backwards clock never un-readies the screen) and announce the edge once.
  useEffect(() => {
    if (!ready || s.readyLatched) return;
    local.setState({ readyLatched: true });
    if (!s.announcedReady && view === 'ready') {
      local.setState({ announcedReady: true });
      announcePolitely(hatchCopy('m11.a11y.announce.ready'));
    }
  }, [ready, view, s.readyLatched, s.announcedReady, local]);

  // Read permission on entry; the scheduling effect below also responds
  // when the Caller grants permission from the status row.
  useEffect(() => {
    let live = true;
    void getNotifyPermission().then((permission) => {
      if (live) local.setState({ permission });
    });
    return () => { live = false; };
  }, [local]);

  // Identifier is derived from the egg, so re-entering never duplicates it.
  useEffect(() => {
    if (s.permission !== 'granted' || Date.now() >= egg.incubationEndsAt) return;
    let live = true;
    void scheduleReadyNotification({
      eggId: egg.eggId,
      endsAtMs: egg.incubationEndsAt,
      title: onboardingCopy('m23.notification.title'),
      body: onboardingCopy('m23.notification.body'),
    }).then((ok) => {
      if (live) local.setState({ scheduleFailed: !ok });
    });
    return () => { live = false; };
  }, [egg.eggId, egg.incubationEndsAt, s.permission, local]);

  // While M11 is on screen its egg's ready notification arrives without a
  // banner: the screen already shows the ready state (M11 handoff, effect 3).
  // A mount effect, not useFocusEffect: `(home)` is a Slot, which unmounts M11
  // whenever another route of the group is showing.
  useEffect(() => readyBannerHold.hold(egg.eggId), [egg.eggId]);

  // The one-breath warm from a tap ends on a timer; unmount clears it.
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (warmTimer.current !== null) clearTimeout(warmTimer.current);
  }, []);

  // While held, the warm haptic lands on each inhale of the shared breath clock.
  const breath = useLedBreathPhase(s.holding && !reducedMotion);
  const holding = useSharedValue(0);
  useEffect(() => {
    holding.set(s.holding ? 1 : withTiming(0, { duration: reducedMotion ? 0 : 200 }));
  }, [s.holding, reducedMotion, holding]);
  useAnimatedReaction(
    () => breath.get(),
    (phase, prev) => {
      if (prev !== null && holding.get() === 1 && inhaleStarted(prev, phase)) scheduleOnRN(haptics.warm);
    },
  );

  const warmStart = (haptic: () => void = haptics.warm) => {
    haptic();
    voice.babble();
    const now = Date.now();
    const last = local.getState().lastWarmAnnounceMs;
    if (last === undefined || now - last >= WARM_ANNOUNCE_MS) {
      announcePolitely(hatchCopy('m11.a11y.announce.warm'));
      local.setState({ lastWarmAnnounceMs: now });
    }
    local.setState({ holding: true });
  };
  const warmEnd = () => local.setState({ holding: false });
  /** Tap while counting: one breath of warm. */
  const warmOnce = (haptic?: () => void) => {
    warmStart(haptic);
    if (warmTimer.current !== null) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(warmEnd, reducedMotion ? 600 : 4000);
  };
  /** A press on the 3D stage: a light tap, one wobble of the egg, and the one-breath warm. */
  const pressWarm = () => {
    local.setState({ nudges: local.getState().nudges + 1 });
    warmOnce(haptics.tap);
  };
  const open = () => router.push({ pathname: '/(home)/hatch', params: { from: 'm11' } });

  const minutes = minutesLeft(egg.incubationEndsAt, nowMs);
  const status: HLynkStatus = ready
    ? { led: 'ready', label: HLYNK_COPY['hlynk.led.ready'] }
    : { led: 'incubating', label: hatchCopy('m11.led.incubating', { minutes }), progress: incubationProgress(egg, nowMs) };

  const notifyRows: StatusRowItem[] = [];
  if (!ready && (s.permission === 'denied' || s.permission === 'undetermined')) {
    notifyRows.push({
      id: 'm11-status-notify-off',
      label: onboardingCopy('m11.status.notify_off'),
      action:
        s.permission === 'undetermined'
          ? {
              label: onboardingCopy('m11.status.notify_off.action.ask'),
              onPress: () => void requestNotifyPermission().then((permission) => local.setState({ permission })),
            }
          : {
              label: onboardingCopy('m11.status.notify_off.action.settings'),
              accessibilityHint: onboardingCopy('m11.status.notify_off.action.settings.a11y.hint'),
              onPress: () => void Linking.openSettings(),
            },
    });
  } else if (!ready && s.scheduleFailed) {
    notifyRows.push({ id: 'm11-status-schedule-failed', label: onboardingCopy('m11.status.schedule_failed') });
  }

  const scheme = schemeForTime(nowMs);
  const detail = detailLine(view, id.eggName, egg.incubationEndsAt, nowMs);
  const eggLabel = hatchCopy(ready ? 'm11.egg.a11y.label.ready' : 'm11.egg.a11y.label', { eggName: id.eggName });
  const timeText = timeLine(view, egg.incubationEndsAt, nowMs);
  const captionText = voice.caption ?? (s.showCaption && view === 'counting' ? hatchCopy('m11.caption.counting') : '');
  const actionLabel = hatchCopy(ready ? 'm11.trackpad.open' : 'm11.trackpad.warm');
  const notifyRow = notifyRows[0];
  const notifyAction = notifyRow?.action;

  // The 3D H-Lynk (same rule as M08 and M10): it runs unless motion is
  // reduced, the GPU never started, or the text is at an accessibility size.
  // Then there is no 2D shell and no photo: the egg's hatch GLB stands on the
  // glass, and the Rive loader covers the stage until its first frame.
  const stageOn = !reducedMotion && !isAccessibilityTextSize(fontScale) && s.stage3d !== 'failed';

  const glassView: IncubatingView = {
    status: status.label ?? '',
    progress: incubationProgress(egg, nowMs),
    ready,
    time: timeText,
    detail: detail ?? '',
    caption: captionText,
    action: actionLabel,
    notify: notifyRow === undefined ? null : { label: notifyRow.label, action: notifyAction?.label ?? null },
  };
  // What the glass reads. Written only when a value changes, so the texture repaints on change, not per render.
  const glass = useInstanceStore<{ view: IncubatingView }>(() => ({ view: glassView }));
  useEffect(() => {
    if (!sameView(glass.getState().view, glassView)) glass.setState({ view: glassView });
  });

  // The latest handlers, written after each commit and read only from event paths, so the screen stays stable.
  const handlers = useInstanceStore<Handlers>(() => ({ action: () => undefined, egg: () => undefined, notify: () => undefined, key: () => undefined }));
  useEffect(() => {
    handlers.setState({
      action: ready ? open : pressWarm,
      egg: ready ? () => undefined : pressWarm,
      notify: () => notifyAction?.onPress(),
      key: (k) => {
        if (k === 'activate') (ready ? open : pressWarm)();
        else if (k === 'back') router.back();
        else if (k === 'menu') setHomeMenuOpen(!useHomeStageStore.getState().menuOpen);
        // home is disabled on M11; `<` and `>` have nothing to step.
      },
    });
  });

  const eggModel = useMemo(() => eggSpeciesModel(egg.speciesId), [egg.speciesId]);
  const incubatingScreen = useMemo(() => createIncubatingScreen({
    egg: eggModel,
    comingSoon: COMING_SOON,
    view: () => glass.getState().view,
    warmth: () => glassWarmth(glass.getState().view, local.getState().holding),
    nudge: () => local.getState().nudges,
    subscribe: (onChange) => glass.subscribe(onChange),
    onAction: () => handlers.getState().action(),
    onEgg: () => handlers.getState().egg(),
    onNotify: () => handlers.getState().notify(),
  }), [eggModel, glass, local, handlers]);
  const onStageKey = useCallback((key: DeviceKey) => handlers.getState().key(key), [handlers]);
  const onStageReady = useCallback(() => {
    local.setState({ stage3d: 'ready' });
    local.getState().stageReady.settle();
  }, [local]);
  const onStageBackend = useCallback((backend: unknown) => {
    if (backend !== null) return;
    local.setState({ stage3d: 'failed' });
    local.getState().stageReady.settle();
  }, [local]);

  useHomeStage(stageOn ? { immersive: true } : {
    chrome: {
      status,
      scheme,
      testIDPrefix: 'm11',
      creature: false,
      framing: 'hatch-closeup',
      trackpad: ready
        ? { label: hatchCopy('m11.trackpad.open'), hint: hatchCopy('m11.trackpad.open.a11y.hint'), onActivate: open, accent: 'hatch' }
        : {
            label: hatchCopy('m11.trackpad.warm'),
            hint: hatchCopy('m11.trackpad.warm.a11y.hint'),
            onActivate: () => warmOnce(),
            onHoldStart: () => warmStart(),
            onHoldEnd: warmEnd,
          },
      keys: { home: { disabled: true } },
      statusRow: (
        <TrackpadActions
          testID={ready ? 'm11-action-open' : 'm11-action-warm'}
          onActivate={ready ? open : () => warmOnce()}
          activateLabel={actionLabel}
        />
      ),
    },
    screen: (
      <View className="flex-1 items-center justify-between px-4 pb-4 pt-6">
        {notifyRows.length > 0 ? (
          <View testID={notifyRows[0]?.id} className="self-stretch">
            <StatusRow items={notifyRows} />
          </View>
        ) : <View />}
        <View
          testID="m11-egg"
          accessible
          accessibilityRole="image"
          accessibilityLabel={eggLabel}
          aria-label={eggLabel}
          style={{ width: EGG_PT, height: EGG_PT }}
        >
          {id.eggDexId === null ? null : <EggStill dexId={id.eggDexId} decorative />}
        </View>
        <View className="w-full items-center gap-2 bg-scrim-scene px-4 py-3" style={{ minHeight: 96 }}>
          <View className="flex-row items-center gap-3">
            {view === 'counting' ? (
              <IncubationRing testID="m11-ring" startedAt={egg.createdAt} endsAt={egg.incubationEndsAt} reducedMotion={reducedMotion} sizePt={48} />
            ) : null}
            <Text testID="m11-time" className="text-xr-title text-signage-white" accessibilityRole="header">
              {timeText}
            </Text>
          </View>
          {detail ? <Text testID="m11-time-detail" className="text-xr-caption text-silver-300">{detail}</Text> : null}
          {captionText !== '' ? (
            <Text testID="m11-caption" className="text-xr-caption text-silver-300">{captionText}</Text>
          ) : null}
        </View>
      </View>
    ),
  });

  if (!stageOn) return null;

  return (
    <View className="flex-1 bg-ink-950" testID="m11-3d">
      <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
        <CompanionStageHost
          enabled={tablet.companion}
          pane={
            <IncubationPane
              testID="m11-pane"
              reducedMotion={reducedMotion}
              input={{
                eggName: id.eggName,
                stage: ready ? 'ready' : 'incubating',
                duration: eggCopy(INCUBATION_A11Y[egg.incubationMinutes]),
                startedAt: egg.createdAt,
                readyAt: egg.incubationEndsAt,
                clock: (ms) => PANE_CLOCK.format(new Date(ms)),
              }}
            />
          }
          device={<>
          {/* Visually hidden: what the glass says, for screen readers (the canvas is hidden from them). */}
          <View className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0" testID="m11-glass-a11y">
            <View testID="m11-status" accessible accessibilityLabel={status.label ?? ''}>
              <Text>{status.label ?? ''}</Text>
            </View>
            <View testID="m11-egg" accessible accessibilityRole="image" accessibilityLabel={eggLabel} aria-label={eggLabel} />
            <Text testID="m11-time" accessibilityRole="header">{timeText}</Text>
            {detail ? <Text testID="m11-time-detail">{detail}</Text> : null}
            {captionText !== '' ? <Text testID="m11-caption">{captionText}</Text> : null}
            {notifyRow ? <Text testID={notifyRow.id}>{notifyRow.label}</Text> : null}
          </View>
          <View
            testID="m11-device-stage"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute inset-0"
          >
            <DeviceStage
              screen={incubatingScreen}
              label={eggLabel}
              className="h-full"
              stageClassName="min-h-0 w-full flex-1"
              glassScale={tablet.glassScale}
              onKey={onStageKey}
              onReady={onStageReady}
              onBackendChange={onStageBackend}
            />
          </View>
          <Suspense fallback={<StageLoader label={eggLabel} testID="m11-stage-loader" />}>
            <StageReadyGate resource={s.stageReady} />
          </Suspense>
          <StageControls
            testID="m11-stage-controls"
            controls={[
              {
                key: 'action',
                label: actionLabel,
                hint: hatchCopy(ready ? 'm11.trackpad.open.a11y.hint' : 'm11.trackpad.warm.a11y.hint'),
                onPress: ready ? open : pressWarm,
                testID: ready ? 'm11-action-open' : 'm11-action-warm',
              },
              ...(notifyAction ? [{
                key: 'notify',
                label: notifyAction.label,
                hint: notifyAction.accessibilityHint,
                onPress: notifyAction.onPress,
                testID: 'm11-action-notify',
              }] : []),
              { key: 'back', label: HLYNK_COPY['hlynk.key.back.label'], onPress: () => router.back(), testID: 'm11-back' },
            ]}
          />
          </>}
        />
      </SafeArea>
    </View>
  );
}
