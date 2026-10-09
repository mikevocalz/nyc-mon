'use client';

import { useEffect, useMemo } from 'react';
import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createHatchState, deriveFirstLook } from '@acme/core/sim';
import {
  Button, CaptureCase, HLYNK_COPY, HatchBurst, HatchEgg, Image, SignagePlate, TrackpadActions,
  useHLynkStageWide, useInstanceStore, useReducedMotion, useStore, type CreaturePerformance, type ImageProps,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { selectActiveMon, selectCallerIsUnder13, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { clearReadyNotification } from '../onboarding/notify-permission';
import { useHomeStage } from '../companion/home-stage.store';
import { tickMinuteClock } from '../companion/minute-clock';
import { eggIdentity, monIdentity } from '../companion/mon-identity';
import { hatchCopy } from './copy';
import { CRACK_BEATS, HESITATE_HINT_MS, PHASE_MS, SKIP_AFTER_MS, resolveHatchEntry, type HatchPhase } from './hatch-sequence';

type Stage = 'entering' | 'pre' | 'show' | 'complete' | 'leaving';

interface LocalState {
  stage: Stage;
  eggId: string | undefined;
  showSkip: boolean;
  /** Hesitation resolved by the Caller's hold or the "Stay close" button. */
  stayedClose: boolean;
  showHesitateHint: boolean;
}

const PHASE_ANNOUNCE: Partial<Record<HatchPhase, 'm12.a11y.case_open' | 'm12.a11y.crack' | 'm12.a11y.emerge'>> = {
  'case-open': 'm12.a11y.case_open',
  crack: 'm12.a11y.crack',
  emerge: 'm12.a11y.emerge',
};

/**
 * M12 Hatch at `/(home)/hatch`. The `open` write commits the individual
 * before any reveal frame; each phase end writes one `advance`, so a kill at
 * any point resumes the same Mon at the start of its saved phase. The screen
 * never decides state: it asks `applyHatch` and reads the result back. Skip
 * writes `skip` and lands on the lean-in ending. The Baby itself is drawn by
 * the layout's creature layer, so M12 → M09 → M13 never cuts.
 */
export function HatchScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const wide = useHLynkStageWide();
  const params = useLocalSearchParams<{ eggId?: string; from?: string }>();
  const fromM11 = params.from === 'm11';

  const local = useInstanceStore<LocalState>(() => ({
    stage: 'entering',
    eggId: params.eggId ?? selectPendingEgg(useMonStore.getState())?.egg.eggId,
    showSkip: false,
    stayedClose: false,
    showHesitateHint: false,
  }));
  const s = useStore(local);
  const eggId = s.eggId;

  const egg = useMonStore((st) => st.save?.eggs.find((e) => e.eggId === eggId));
  const stored = useMonStore((st) => st.save?.hatches.find((h) => h.eggId === eggId));
  const hatch = stored ?? (egg === undefined ? undefined : createHatchState(egg));
  const activeMon = useMonStore(selectActiveMon);
  const under13 = useMonStore(useMemo(() => selectCallerIsUnder13(Date.now()), []));

  const eggId_ = eggId ?? '';
  const apply = (event: Parameters<ReturnType<typeof useMonStore.getState>['applyHatch']>[1]) =>
    useMonStore.getState().applyHatch(eggId_, event, Date.now());

  const mon = hatch?.kind === 'presenting' || hatch?.kind === 'hatched' ? hatch.mon : activeMon;
  const eggId0 = egg === undefined ? undefined : eggIdentity(egg);
  const babyName = eggId0?.babyName ?? (mon ? monIdentity(mon).name : '');
  const monName = mon ? monIdentity(mon).name : babyName;
  const firstLook = mon === undefined ? 'lean-in' : deriveFirstLook(mon.monInstanceId, under13 ?? true);
  const phase: HatchPhase | undefined = hatch?.kind === 'presenting' ? hatch.phase : undefined;

  // Entry (M12 "Route, entry and states"), once.
  useEffect(() => {
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
        router.replace(activeMon?.nickname == null ? '/(home)/name' : '/(home)');
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
  const lidProgress = useSharedValue(0);
  const hatchProgress = useSharedValue(0);
  const crackGlow = useSharedValue(0);
  const burst = useSharedValue(0);
  const padGlow = useSharedValue(0);

  const peak = wide ? 0.4 : 0.6;
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
      case 'case-open':
        haptics.hatchLatch();
        lidProgress.set(0);
        lidProgress.set(withTiming(1, timing(ms)));
        break;
      case 'scanner':
        lidProgress.set(1);
        haptics.selection();
        break;
      case 'crack':
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
    void clearReadyNotification(eggId_);
    tickMinuteClock();
    local.setState({ stage: 'complete', showSkip: false, showHesitateHint: false });
  }

  const open = () => {
    apply({ type: 'open', now: Date.now() });
    local.setState({ stage: 'show' });
  };
  const skip = () => {
    for (const v of [lidProgress, hatchProgress, crackGlow, burst]) cancelAnimation(v);
    lidProgress.set(1);
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
    // The phase loop re-runs with `stayedClose` and writes the `advance` after the lean-in.
    local.setState({ stayedClose: true, showHesitateHint: false });
  };
  const leave = () => {
    local.setState({ stage: 'leaving' });
    router.replace(mon?.nickname == null ? '/(home)/name' : '/(home)');
  };

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
  const showCase = s.stage === 'pre' || (s.stage === 'show' && phase !== undefined && phase !== 'emerge' && phase !== 'attention');
  const lid = s.stage === 'pre' ? 'closed' : phase === 'case-open' ? 'opening' : 'open';
  const eggArt = eggId0?.eggArt;

  const trackpad =
    s.stage === 'pre'
      ? { label: hatchCopy('m12.trackpad.open'), onActivate: open, accent: 'hatch' as const }
      : hesitating
        ? { label: hatchCopy('m12.first_look.hesitate.trackpad'), onHoldStart: stayClose, onActivate: stayClose, accent: 'hatch' as const }
        : s.stage === 'complete'
          ? { label: mon?.nickname == null ? hatchCopy('m12.cta.name', { babyName }) : hatchCopy('m12.cta.home', { monName }), onActivate: leave }
          : { label: hatchCopy('m12.trackpad.open'), disabled: true, accent: 'hatch' as const };

  const ctaLabel = mon?.nickname == null ? hatchCopy('m12.cta.name', { babyName }) : hatchCopy('m12.cta.home', { monName });

  useHomeStage({
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
          <TrackpadActions testID={mon?.nickname == null ? 'm12-action-name' : 'm12-action-home'} onActivate={leave} activateLabel={ctaLabel} />
        ) : undefined,
    },
    screen:
      s.stage === 'entering' || s.stage === 'leaving' ? null : (
        <View testID={`m12-phase-${s.stage === 'show' ? (phase ?? 'hatched') : s.stage}`} className="flex-1">
          {showCase ? (
            <View className="flex-1 items-center justify-center">
              <CaptureCase
                testID="m12-case"
                lid={lid}
                lidProgress={lidProgress}
                padGlow={padGlow}
                seam="lit"
                scheme="night"
                reducedMotion={reducedMotion}
                accessibilityLabel={hatchCopy('m11.case.a11y.label.ready', { eggName: eggId0?.eggName ?? '' })}
              >
                {s.stage === 'show' && egg !== undefined ? (
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
                ) : null}
              </CaptureCase>
              {phase === 'burst' ? (
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
          {s.stage === 'complete' && eggId0 !== undefined ? (
            <View className="absolute inset-x-4 bottom-4 items-center gap-1">
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

  return null;
}
