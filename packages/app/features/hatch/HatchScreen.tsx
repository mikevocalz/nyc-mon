'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HATCH_PRESENTATION_PHASES } from '@acme/core/schemas';
import { createHatchState, deriveFirstLook } from '@acme/core/sim';
import type { HatchState } from '@acme/core/types';
import { eggHatchAssetForSpecies } from '@acme/assets/eggs';
import { allSpecies } from '@acme/content';
import {
  Badge, Button, HLYNK_COPY, HatchBurst, HatchEgg, HatchSequenceStage, Heading, Image, MonStage, SafeArea, SignagePlate,
  StageReadyGate, TrackpadActions, createStageReady, useInstanceStore, useReducedMotion, useStore, type CreaturePerformance,
  type ImageProps, type StageReadyResource,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { selectActiveMon, selectCallerIsUnder13, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { clearReadyNotification } from '../onboarding/notify-permission';
import { needsNicknamePrompt } from '../onboarding/onboarding.store';
import { useHomeStage } from '../companion/home-stage.store';
import { tickMinuteClock } from '../companion/minute-clock';
import { eggIdentity, monIdentity } from '../companion/mon-identity';
import { useAdminStills } from '../mons/use-admin-stills';
import { StageControls, type StageControl } from '../egg/StageControls';
import { StageLoader } from '../egg/StageLoader';
import { COMING_SOON } from '../companion/glass';
import { monModelSource } from '../companion/mon-models';
import { MonCaption } from '../voice/MonCaption';
import { useMonVoice } from '../voice/use-mon-voice';
import { hatchCopy } from './copy';
import {
  CRACK_BEATS, HESITATE_HINT_MS, PHASE_MS, SKIP_AFTER_MS, eggPrecrackPose, resolveHatchEntry, type HatchPhase,
} from './hatch-sequence';

type Stage = 'entering' | 'pre' | 'show' | 'complete' | 'leaving';

interface LocalState {
  stage: Stage;
  eggId: string | undefined;
  showSkip: boolean;
  /** Hesitation resolved by the Caller's hold or the "Stay close" button. */
  stayedClose: boolean;
  showHesitateHint: boolean;
  /** The 3D hatch sequence: `starting` until its egg is posed (the Rive loader covers it), `ready`, or `failed` (the 2D egg). */
  seq3d: 'starting' | 'ready' | 'failed';
  /** Settles with the hatch stage's first posed frame, or its failure: the Rive loader's Suspense gate. */
  stageReady: StageReadyResource;
  /** The Baby's own stage (MonStage) drew its first frame: the hatch stage over it goes, so the Baby never blinks. */
  monReady: boolean;
  /** Dev replay only: the phase playing, held here instead of the save (null before Hatch your egg is pressed). */
  replayPhase: HatchPhase | null;
}

/** The egg a hatched Mon came from, for the dev replay. */
function eggOfMon(monInstanceId: string | undefined): string | undefined {
  if (monInstanceId === undefined) return undefined;
  const save = useMonStore.getState().save;
  return save?.hatches.find((h) => h.kind === 'hatched' && h.mon.monInstanceId === monInstanceId)?.eggId ?? save?.eggs[0]?.eggId;
}

const dexBySpecies = new Map(allSpecies.map((sp) => [sp.speciesId, sp.dexId]));

const PHASE_ANNOUNCE: Partial<Record<HatchPhase, 'm12.a11y.stir' | 'm12.a11y.pressure' | 'm12.a11y.crack' | 'm12.a11y.emerge'>> = {
  stir: 'm12.a11y.stir',
  pressure: 'm12.a11y.pressure',
  crack: 'm12.a11y.crack',
  emerge: 'm12.a11y.emerge',
};

/**
 * M12 Hatch at `/(home)/hatch`. The `open` write commits the individual
 * before any reveal frame; each phase end writes one `advance`, so a kill at
 * any point resumes the same Mon at the start of its saved phase. The screen
 * never decides state: it asks `applyHatch` and reads the result back. Skip
 * writes `skip` and lands on the lean-in ending. The Baby itself is drawn by
 * the layout's creature layer, so M12 → M09 → M13 never cuts. The egg sits
 * in the hatch scene on its own: no case, lid or scanner (Decision 29).
 */
export function HatchScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{ eggId?: string; from?: string; replay?: string }>();
  const fromM11 = params.from === 'm11';
  /**
   * Development builds only: `nycmon://hatch?replay=1` plays the whole 3D
   * hatch again for the Mon that already hatched. Nothing is written: the
   * phases run from this screen's own state, never `applyHatch`.
   */
  const replay = __DEV__ && params.replay === '1';

  const local = useInstanceStore<LocalState>(() => ({
    stage: 'entering',
    eggId: params.eggId ?? (replay
      ? eggOfMon(selectActiveMon(useMonStore.getState())?.monInstanceId)
      : selectPendingEgg(useMonStore.getState())?.egg.eggId),
    showSkip: false,
    stayedClose: false,
    showHesitateHint: false,
    seq3d: 'starting',
    stageReady: createStageReady(),
    monReady: false,
    replayPhase: null,
  }));
  const s = useStore(local);
  const eggId = s.eggId;

  const egg = useMonStore((st) => st.save?.eggs.find((e) => e.eggId === eggId));
  const activeMonForReplay = useMonStore(selectActiveMon);
  const stored = useMonStore((st) => st.save?.hatches.find((h) => h.eggId === eggId));
  const replayHatch: HatchState | undefined = replay && s.replayPhase !== null && activeMonForReplay !== undefined
    ? { kind: 'presenting', eggId: eggId ?? '', mon: activeMonForReplay, phase: s.replayPhase, serverConfirmed: true }
    : undefined;
  const hatch = replay ? replayHatch : (stored ?? (egg === undefined ? undefined : createHatchState(egg)));
  const activeMon = useMonStore(selectActiveMon);
  const stills = useAdminStills();
  const under13 = useMonStore(useMemo(() => selectCallerIsUnder13(Date.now()), []));

  const eggId_ = eggId ?? '';
  const apply = (event: Parameters<ReturnType<typeof useMonStore.getState>['applyHatch']>[1]): { kind: HatchState['kind'] } => {
    if (!replay) return useMonStore.getState().applyHatch(eggId_, event, Date.now());
    // Dev replay: the same phase walk, held in this screen's state; the save is never touched.
    const at = local.getState().replayPhase;
    const next = event.type === 'open' ? HATCH_PRESENTATION_PHASES[0]
      : event.type === 'advance' && at !== null ? HATCH_PRESENTATION_PHASES[HATCH_PRESENTATION_PHASES.indexOf(at) + 1]
        : undefined;
    local.setState({ replayPhase: next ?? null });
    return { kind: next === undefined ? 'hatched' : 'presenting' };
  };

  const mon = hatch?.kind === 'presenting' || hatch?.kind === 'hatched' ? hatch.mon : activeMon;
  const eggId0 = egg === undefined ? undefined : eggIdentity(egg, stills);
  const babyName = eggId0?.babyName ?? (mon ? monIdentity(mon).name : '');
  const monName = mon ? monIdentity(mon).name : babyName;
  const firstLook = mon === undefined ? 'lean-in' : deriveFirstLook(mon.monInstanceId, under13 ?? true);
  const phase: HatchPhase | undefined = hatch?.kind === 'presenting' ? hatch.phase : undefined;
  // The first look is where the Baby's first words go (canon lines only: @acme/content/lines).
  const voice = useMonVoice(mon);

  // Entry (M12 "Route, entry and states"), once.
  useEffect(() => {
    if (replay) {
      // Dev replay: the egg waits for Hatch your egg, as on the real ready screen.
      local.setState({ stage: egg === undefined ? 'leaving' : 'pre' });
      if (egg === undefined) router.replace('/(home)');
      return;
    }
    const entry = resolveHatchEntry({
      hatch,
      incubationEndsAt: egg?.incubationEndsAt,
      hasMon: activeMon !== undefined,
      fromM11,
      nowMs: Date.now(),
    });
    switch (entry.kind) {
      case 'already':
        if (eggId !== undefined) void clearReadyNotification(eggId);
        announcePolitely(hatchCopy('m12.a11y.already', { monName }));
        local.setState({ stage: 'leaving' });
        router.replace(activeMon !== undefined && needsNicknamePrompt(activeMon) ? '/(home)/name' : '/(home)');
        return;
      case 'unknown-egg':
        router.replace('/');
        return;
      case 'early':
        router.replace('/(home)');
        return;
      case 'pre':
        local.setState({ stage: 'pre' });
        return;
      case 'open-now':
        apply({ type: 'open', now: Date.now() });
        local.setState({ stage: 'show' });
        return;
      case 'resume':
        local.setState({ stage: 'show' });
        return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI-thread values the kit pieces read; the JS side only starts each phase.
  const stirProgress = useSharedValue(0);
  const pressureProgress = useSharedValue(0);
  const hatchProgress = useSharedValue(0);
  const crackGlow = useSharedValue(0);
  const burst = useSharedValue(0);
  const eggPose = useAnimatedStyle(() => {
    const pose = eggPrecrackPose(stirProgress.get(), pressureProgress.get(), reducedMotion);
    return { transform: [{ rotate: `${pose.rotateDeg}deg` }, { scale: pose.scale }] };
  });

  // The burst always draws inside the H-Lynk screen (the 0.4 side-pane peak went with Decision H-2).
  const peak = 0.6;
  const durations = PHASE_MS[reducedMotion ? 'reduced' : 'full'];

  // Skip appears 2000 ms into the show.
  useEffect(() => {
    if (s.stage !== 'show') return;
    const t = setTimeout(() => local.setState({ showSkip: true }), SKIP_AFTER_MS);
    return () => clearTimeout(t);
  }, [s.stage, local]);

  // Phase loop: start the phase's motion and haptics, then write `advance` at its end.
  useEffect(() => {
    if (s.stage !== 'show' || phase === undefined) return;
    const ms = durations[phase];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delay: number, fn: () => void) => timers.push(setTimeout(fn, delay));
    const announce = PHASE_ANNOUNCE[phase];
    if (announce) announcePolitely(hatchCopy(announce, { babyName }));
    const timing = (duration: number) => ({ duration: reducedMotion ? 0 : duration, easing: Easing.out(Easing.cubic) });
    switch (phase) {
      case 'stir':
        haptics.tap();
        stirProgress.set(0);
        stirProgress.set(withTiming(1, { duration: reducedMotion ? 0 : ms, easing: Easing.linear }));
        break;
      case 'pressure':
        stirProgress.set(1);
        haptics.selection();
        pressureProgress.set(0);
        // Reduced motion holds the authored fuller pose for the whole beat.
        pressureProgress.set(reducedMotion ? 0.5 : withTiming(1, { duration: ms, easing: Easing.linear }));
        break;
      case 'crack':
        stirProgress.set(1);
        pressureProgress.set(1);
        hatchProgress.set(0);
        hatchProgress.set(withTiming(1, { duration: ms, easing: Easing.linear }));
        crackGlow.set(withTiming(1, timing(ms)));
        for (const beat of CRACK_BEATS) at(beat * ms, haptics.hatchCrack);
        break;
      case 'burst':
        hatchProgress.set(1);
        burst.set(0);
        burst.set(withTiming(1, { duration: reducedMotion ? 0 : ms, easing: Easing.linear }));
        at(ms * 0.36, haptics.hatchBloom);
        break;
      case 'emerge':
        at(300, haptics.hatchEmerge);
        break;
      case 'attention':
        if (firstLook === 'lean-in') {
          haptics.firstLook();
          announcePolitely(hatchCopy('m12.a11y.first_look.lean_in', { babyName }));
          voice.sayLine('first-words');
        } else if (!local.getState().stayedClose) {
          announcePolitely(hatchCopy('m12.a11y.first_look.hesitate', { babyName }));
          at(HESITATE_HINT_MS, () => local.setState({ showHesitateHint: true }));
          // The hesitation stays open; the Caller's hold ends it (`stayClose`).
          return () => timers.forEach(clearTimeout);
        }
        break;
    }
    at(ms, () => {
      const next = apply({ type: 'advance' });
      if (next.kind === 'hatched') finish();
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.stage, phase, s.stayedClose]);

  /** The hatched edge (last `advance`, or `skip`): also retires the egg's ready notification (M12 housekeeping). */
  function finish() {
    if (!replay) void clearReadyNotification(eggId_);
    tickMinuteClock();
    local.setState({ stage: 'complete', showSkip: false, showHesitateHint: false });
  }

  const open = () => {
    apply({ type: 'open', now: Date.now() });
    local.setState({ stage: 'show' });
  };
  const skip = () => {
    for (const v of [stirProgress, pressureProgress, hatchProgress, crackGlow, burst]) cancelAnimation(v);
    stirProgress.set(1);
    pressureProgress.set(1);
    hatchProgress.set(1);
    apply({ type: 'skip' });
    announcePolitely(hatchCopy('m12.a11y.skipped', { babyName }));
    finish();
  };
  const stayClose = () => {
    if (local.getState().stayedClose) return;
    haptics.warm();
    announcePolitely(hatchCopy('m12.a11y.first_look.resolved', { babyName }));
    haptics.firstLook();
    voice.sayLine('first-words');
    // The phase loop re-runs with `stayedClose` and writes the `advance` after the lean-in.
    local.setState({ stayedClose: true, showHesitateHint: false });
  };
  const leave = () => {
    local.setState({ stage: 'leaving' });
    router.replace(!replay && mon !== undefined && needsNicknamePrompt(mon) ? '/(home)/name' : '/(home)');
  };
  const asksNickname = !replay && (mon === undefined || needsNicknamePrompt(mon));

  // What the creature layer shows.
  const creatureVisible = s.stage === 'complete' || phase === 'emerge' || phase === 'attention';
  const performance: CreaturePerformance | undefined =
    phase === 'emerge'
      ? { kind: 'hatch-emerge' }
      : phase === 'attention'
        ? { kind: 'first-look', choice: firstLook, resolved: firstLook === 'lean-in' || s.stayedClose }
        : s.stage === 'complete'
          ? { kind: 'first-look', choice: 'lean-in', resolved: true }
          : undefined;

  const hesitating = phase === 'attention' && firstLook === 'hesitate' && !s.stayedClose;
  const showEgg = s.stage === 'pre' || (s.stage === 'show' && phase !== undefined && phase !== 'emerge' && phase !== 'attention');
  const eggArt = eggId0?.eggArt;
  // The Blender-built hatch GLB for this egg, when one exists; HatchEgg stays the fallback.
  const egg3d = egg === undefined ? undefined : eggHatchAssetForSpecies(egg.speciesId);
  // The 3D shell stays through emerge and attention: its pieces part and settle,
  // goo pools and the creature layer's Baby climbs out over it. The flat egg
  // has no open state, so it still leaves at emerge.
  const showEggScene = showEgg || (egg3d !== undefined && s.stage === 'show' && (phase === 'emerge' || phase === 'attention'));
  // When the screen entered this phase; a late GLB load starts the clip this far in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const phaseStartedAt = useMemo(() => Date.now(), [phase, s.stage]);
  const flatEgg = egg === undefined ? null : (
    <Animated.View style={eggPose}>
      <HatchEgg
        testID="m12-egg"
        eggSpeciesId={egg.speciesId}
        hatchProgress={hatchProgress}
        crackGlow={crackGlow}
        reducedMotion={reducedMotion}
        art={eggArt ? (
          <Image src={eggArt.source as ImageProps['src']} alt={eggArt.alt} fill framed={false} unoptimized className="h-full w-full" />
        ) : null}
      />
    </Animated.View>
  );
  // The 3D hatch is the Alexa view's moment (HatchSequence3D) on the shared
  // renderer: each M12 phase plays its window of that one timeline over the
  // screen's own phase length, so it stays in step with the phase loop above
  // and a resumed phase starts at its beginning. The app's creature layer
  // draws the Baby (no Baby model ships in the app yet), so the scene hands
  // over to it under the white-out. On any load error it shows flatEgg.
  const seqFailed = egg3d === undefined || s.seq3d === 'failed';
  const eggView = egg3d === undefined || s.seq3d === 'failed' ? flatEgg : (
    <View className="h-full w-full">
      <HatchSequenceStage
        testID="m12-egg-3d"
        eggId={egg3d.eggId}
        source={egg3d}
        phase={s.stage === 'show' ? (phase ?? null) : null}
        phaseMs={phase === undefined ? 0 : durations[phase]}
        phaseStartedAt={phaseStartedAt}
        reducedMotion={reducedMotion}
        fallback={flatEgg}
        onReady={() => local.setState({ seq3d: 'ready' })}
        onError={() => local.setState({ seq3d: 'failed' })}
        onBackendChange={(backend) => {
          if (backend === null) local.setState({ seq3d: 'failed' });
        }}
      />
      {s.seq3d === 'starting' ? <StageLoader label={hatchCopy('m12.trackpad.open')} testID="m12-stage-loader" /> : null}
    </View>
  );

  const trackpad =
    s.stage === 'pre'
      ? { label: hatchCopy('m12.trackpad.open'), onActivate: open, accent: 'hatch' as const }
      : hesitating
        ? { label: hatchCopy('m12.first_look.hesitate.trackpad'), onHoldStart: stayClose, onActivate: stayClose, accent: 'hatch' as const }
        : s.stage === 'complete'
          ? { label: asksNickname ? hatchCopy('m12.cta.name', { babyName }) : hatchCopy('m12.cta.home', { monName }), onActivate: leave }
          : { label: hatchCopy('m12.trackpad.open'), disabled: true, accent: 'hatch' as const };

  const ctaLabel = asksNickname ? hatchCopy('m12.cta.name', { babyName }) : hatchCopy('m12.cta.home', { monName });

  // The Baby the egg hatches into, as its rigged model (null: no model yet, Coming Soon).
  const babyDex = egg === undefined ? null : (dexBySpecies.get(egg.hatchesIntoSpeciesId) ?? null);
  const baby = useMemo(() => monModelSource(babyDex), [babyDex]);
  // The default path is the full-window 3D hatch: the Alexa view's sequence
  // with the Baby's GLB, handing over to the Baby's own stage. Reduced motion
  // stays 3D and follows the timeline's reduced path (one cross-fade). Only a
  // missing hatch GLB or a failed renderer brings back the 2D shell below.
  const immersive = egg3d !== undefined && s.seq3d !== 'failed';
  const sequencePhase = s.stage === 'show' ? (phase ?? 'attention') : s.stage === 'complete' ? 'attention' : null;
  const babyOut = s.stage === 'complete' || phase === 'emerge' || phase === 'attention';
  const showMonStage = baby !== null && (s.stage === 'complete' || phase === 'attention');
  const primary =
    s.stage === 'pre' ? { label: hatchCopy('m12.trackpad.open'), onPress: open, testID: 'm12-action-open' }
      : hesitating ? { label: hatchCopy('m12.first_look.hesitate.trackpad'), onPress: stayClose, testID: 'm12-action-stay-close' }
        : s.stage === 'complete' ? { label: ctaLabel, onPress: leave, testID: asksNickname ? 'm12-action-name' : 'm12-action-home' }
          : null;
  const controls: StageControl[] = [
    ...(primary ? [{ key: 'primary', label: primary.label, onPress: primary.onPress, testID: `${primary.testID}-a11y` }] : []),
    ...(s.showSkip && s.stage === 'show'
      ? [{ key: 'skip', label: hatchCopy('m12.skip'), hint: hatchCopy('m12.skip.a11y.hint'), onPress: skip, testID: 'm12-skip-a11y' }]
      : []),
  ];
  const sceneLabel = babyOut && s.stage !== 'pre'
    ? hatchCopy('m12.a11y.hatched_from', { babyName, eggName: eggId0?.eggName ?? '' })
    : hatchCopy('m11.egg.a11y.label.ready', { eggName: eggId0?.eggName ?? '' });

  useHomeStage(immersive ? { immersive: true } : {
    chrome: {
      status: { led: 'ready', label: HLYNK_COPY['hlynk.led.ready'] },
      scheme: 'night',
      testIDPrefix: 'm12',
      creature: creatureVisible && s.stage !== 'entering',
      framing: 'hatch-closeup',
      performance,
      trackpad,
      keys: { home: { disabled: true } },
      statusRow:
        s.stage === 'pre' ? (
          <TrackpadActions testID="m12-action-open" onActivate={open} activateLabel={hatchCopy('m12.trackpad.open')} />
        ) : hesitating ? (
          <TrackpadActions testID="m12-action-stay-close" onActivate={stayClose} activateLabel={hatchCopy('m12.first_look.hesitate.trackpad')} />
        ) : s.stage === 'complete' ? (
          <TrackpadActions testID={asksNickname ? 'm12-action-name' : 'm12-action-home'} onActivate={leave} activateLabel={ctaLabel} />
        ) : undefined,
    },
    screen:
      s.stage === 'entering' || s.stage === 'leaving' ? null : (
        <View testID={`m12-phase-${s.stage === 'show' ? (phase ?? 'hatched') : s.stage}`} className="flex-1">
          {showEggScene ? (
            <View className="flex-1 items-center justify-center">
              <View
                testID="m12-egg-scene"
                className={seqFailed ? undefined : 'flex-1 self-stretch'}
                accessible
                accessibilityRole="image"
                accessibilityLabel={hatchCopy('m11.egg.a11y.label.ready', { eggName: eggId0?.eggName ?? '' })}
                aria-label={hatchCopy('m11.egg.a11y.label.ready', { eggName: eggId0?.eggName ?? '' })}
              >
                {eggView}
              </View>
              {phase === 'burst' && seqFailed ? (
                <View className="absolute inset-0 items-center justify-center" style={{ pointerEvents: 'none' }}>
                  <HatchBurst testID="m12-burst" progress={burst} peakOpacity={peak} reducedMotion={reducedMotion} />
                </View>
              ) : null}
            </View>
          ) : <View className="flex-1" />}
          {s.showSkip && s.stage === 'show' ? (
            <View testID="m12-skip" className="absolute right-4 top-4 bg-hlynk-core-black">
              <Button
                variant="ghost"
                title={hatchCopy('m12.skip')}
                accessibilityHint={hatchCopy('m12.skip.a11y.hint')}
                onPress={skip}
                className="min-h-target min-w-target"
              />
            </View>
          ) : null}
          {hesitating && s.showHesitateHint ? (
            <Text testID="m12-hint-stay-close" className="absolute inset-x-4 bottom-4 text-center text-xr-caption text-silver-300">
              {hatchCopy('m12.first_look.hesitate.hint')}
            </Text>
          ) : null}
          {s.stage !== 'complete' && !(hesitating && s.showHesitateHint) ? (
            <MonCaption testID="m12-mon-caption" className="absolute inset-x-4 bottom-4 text-center" />
          ) : null}
          {s.stage === 'complete' && eggId0 !== undefined ? (
            <View className="absolute inset-x-4 bottom-4 items-center gap-1">
              <MonCaption testID="m12-mon-caption" className="text-center" />
              <SignagePlate
                testID="m12-plate"
                text={babyName}
                accessibilityLabel={hatchCopy('m12.plate.a11y.label', { babyName, bloodlineLabel: eggId0.bloodlineLabel ?? '' })}
              />
              {eggId0.bloodlineLabel ? (
                <Text className="text-xr-caption text-silver-300" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {eggId0.bloodlineLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ),
  });

  if (!immersive || egg3d === undefined || s.stage === 'entering' || s.stage === 'leaving') return null;

  return (
    <View className="flex-1 bg-ink-950" testID="m12-3d">
      <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
        <View testID={`m12-phase-${s.stage === 'show' ? (phase ?? 'hatched') : s.stage}`} className="relative min-h-0 flex-1">
          {/* What the stage shows, for screen readers (the canvases are hidden from them). */}
          <View className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0" testID="m12-glass-a11y">
            <View testID="m12-egg-scene" accessible accessibilityRole="image" accessibilityLabel={sceneLabel} aria-label={sceneLabel} />
          </View>
          {/* The Baby's own stage, under the hatch: it mounts once the Baby is out, and the hatch goes after its first frame. */}
          {showMonStage ? (
            <View testID="m12-mon-stage" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
              <MonStage
                source={baby}
                reducedMotion={reducedMotion}
                fallback={null}
                onReady={() => local.setState({ monReady: true })}
              />
            </View>
          ) : null}
          {s.monReady && showMonStage ? null : (
            <View testID="m12-egg-3d" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
              <HatchSequenceStage
                eggId={egg3d.eggId}
                source={egg3d}
                baby={baby}
                phase={sequencePhase}
                phaseMs={phase === undefined ? 0 : durations[phase]}
                phaseStartedAt={phaseStartedAt}
                reducedMotion={reducedMotion}
                fallback={null}
                onReady={() => {
                  local.setState({ seq3d: 'ready' });
                  local.getState().stageReady.settle();
                }}
                onError={() => {
                  local.getState().stageReady.settle();
                  local.setState({ seq3d: 'failed' });
                }}
                onBackendChange={(backend) => {
                  if (backend !== null) return;
                  local.getState().stageReady.settle();
                  local.setState({ seq3d: 'failed' });
                }}
              />
            </View>
          )}
          {/* A form with no model yet: the kit's Coming Soon badge where the Baby stands, never a picture. */}
          {baby === null && babyOut ? (
            <View className="absolute inset-0 items-center justify-center" style={{ pointerEvents: 'none' }}>
              <Badge label={COMING_SOON} tone="neutral" />
            </View>
          ) : null}
          <Suspense fallback={<StageLoader label={hatchCopy('m12.trackpad.open')} testID="m12-stage-loader" />}>
            <StageReadyGate resource={s.stageReady} />
          </Suspense>
          {s.showSkip && s.stage === 'show' ? (
            <View testID="m12-skip" className="absolute right-4 top-4 bg-hlynk-core-black">
              <Button
                variant="ghost"
                title={hatchCopy('m12.skip')}
                accessibilityHint={hatchCopy('m12.skip.a11y.hint')}
                onPress={skip}
                className="min-h-target min-w-target"
              />
            </View>
          ) : null}
          <View className="absolute inset-x-4 bottom-4 items-center gap-3">
            {hesitating && s.showHesitateHint ? (
              <Text testID="m12-hint-stay-close" className="text-center text-xr-caption text-silver-300">
                {hatchCopy('m12.first_look.hesitate.hint')}
              </Text>
            ) : null}
            <MonCaption testID="m12-mon-caption" className="text-center" />
            {s.stage === 'complete' && eggId0 !== undefined ? (
              <View
                testID="m12-plate"
                className="items-center gap-1"
                accessible
                accessibilityLabel={hatchCopy('m12.plate.a11y.label', { babyName, bloodlineLabel: eggId0.bloodlineLabel ?? '' })}
              >
                <Heading level={1} className="text-xr-title text-signage-white">{babyName}</Heading>
                {eggId0.bloodlineLabel ? <Text className="text-xr-caption text-silver-300">{eggId0.bloodlineLabel}</Text> : null}
              </View>
            ) : null}
            {primary ? (
              <View testID={primary.testID} className="w-full max-w-content-form">
                <Button variant="cta" size="lg" fullWidth title={primary.label} onPress={primary.onPress} className="min-h-target" />
              </View>
            ) : null}
          </View>
          <StageControls testID="m12-stage-controls" controls={controls} />
        </View>
      </SafeArea>
    </View>
  );
}
