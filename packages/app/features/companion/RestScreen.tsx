'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { assertNever, DEFAULT_CARE_TUNING } from '@acme/core/sim';
import type { CareAction } from '@acme/core/types';
import {
  Button, CareMeterRing, HLYNK_COPY, SheetSurface, useInstanceStore, useReducedMotion, useStore, type DeviceKey, type GlassAction,
  type GlassView,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { careLed, useCareNow } from './care-shared';
import { companionCopy as c } from './copy';
import { GlassStage, glassControls, glassRing, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { useHomeStage } from './home-stage.store';
import { CareHistoryPane } from './pane-content';
import { tickMinuteClock } from './minute-clock';

/** `m15.sleeping.leave` shows once per session (M15 copy notes). */
let leaveNoteShown = false;

/** How long "Settling in." holds before the sleeping lines. The 2D still has no `sleep_in` clip to time it (B2). */
const SETTLING_MS = 1200;
/** The Baby large, the energy ring, three lines and one row of buttons. */
const LAYOUT = { model: 'large', rings: true, lineRows: 3, actionRows: 1, perRow: 2 } as const;

interface RestLocal {
  settling: boolean;
  confirming: boolean;
  /** A race: another surface put the Mon to bed first (`declined: already-asleep`). */
  raced: boolean;
  showLeave: boolean;
  failed: boolean;
  nudge: number;
}

/**
 * M15 Rest. Entered awake (the Rest key), it puts the Mon to bed at once: the
 * screen is the bedroom. While asleep it says Energy is coming back and offers
 * Wake; under the early-wake line the cost is on screen before any wake, and
 * the button asks to confirm. The trackpad hold commits a wake too. A tap on
 * the scene never wakes. A natural wake returns to M13.
 */
export function RestScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { care, identity, scheme } = useCareNow();
  const local = useInstanceStore<RestLocal>(() => ({ settling: false, confirming: false, raced: false, showLeave: false, failed: false, nudge: 0 }));
  const { settling, confirming, raced, showLeave, failed, nudge } = useStore(local);
  const glassOn = useGlassOn(failed);
  const entered = useRef(false);
  const sawAsleep = useRef(false);
  const leaving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = identity?.name ?? '';

  const apply = (action: CareAction) => {
    try {
      const outcome = useMonStore.getState().applyCare(action, Date.now());
      tickMinuteClock();
      return outcome;
    } catch {
      router.replace('/(home)');
      return undefined;
    }
  };

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.back();
  };

  // Entry: awake → put to bed once.
  useEffect(() => {
    if (identity === undefined) {
      router.replace('/(home)');
      return;
    }
    if (entered.current || care === undefined) return;
    entered.current = true;
    if (!leaveNoteShown) {
      leaveNoteShown = true;
      local.setState({ showLeave: true });
    }
    if (care.activity.kind === 'asleep') return;
    const outcome = apply({ kind: 'rest' });
    if (outcome === undefined) return;
    switch (outcome.kind) {
      case 'fell-asleep':
        announcePolitely(c('m15.settling'));
        local.setState({ settling: true });
        timer.current = setTimeout(() => local.setState({ settling: false }), reducedMotion ? 0 : SETTLING_MS);
        return;
      case 'declined':
        if (outcome.reason === 'already-asleep') local.setState({ raced: true });
        return;
      case 'eaten':
      case 'overfed':
      case 'woke':
      case 'played':
      case 'paused':
      case 'resumed':
        return;
      default:
        return assertNever(outcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, care]);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const asleep = care?.activity.kind === 'asleep';
  // Natural wake on a clock tick: the sim's state, no absence copy.
  useEffect(() => {
    if (asleep) {
      sawAsleep.current = true;
      return;
    }
    if (sawAsleep.current && care !== undefined) {
      announcePolitely(c('m15.woke.rested.a11y', { name }));
      leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep, care]);

  const earlyWake = care !== undefined && care.energy < DEFAULT_CARE_TUNING.earlyWakeEnergyBelow;

  const wake = () => {
    const outcome = apply({ kind: 'wake' });
    if (outcome === undefined) return;
    switch (outcome.kind) {
      case 'woke':
        haptics.success();
        announcePolitely(outcome.early ? c('m15.woke.early.a11y', { name }) : c('m15.woke.rested.a11y', { name }));
        leave();
        return;
      case 'declined':
        // `already-awake`: another surface woke the Mon; the clock tick routes back.
        leave();
        return;
      case 'eaten':
      case 'overfed':
      case 'fell-asleep':
      case 'played':
      case 'paused':
      case 'resumed':
        return;
      default:
        return assertNever(outcome);
    }
  };

  const onWakeButton = () => {
    if (earlyWake) local.setState({ confirming: true });
    else wake();
  };

  const panel = (
    <SheetSurface placement="in-screen" scheme="night" testID="m15-panel">
      <View className="gap-target-gap">
        <Text testID="m15-status" accessibilityLiveRegion="polite" className="text-xr-body text-text">
          {raced ? c('m15.declined.already', { name }) : settling ? c('m15.settling') : c('m15.sleeping')}
        </Text>
        {showLeave && !settling ? (
          <Text testID="m15-leave-note" className="text-xr-caption text-text-muted">{c('m15.sleeping.leave', { name })}</Text>
        ) : null}
        {earlyWake && asleep && !settling ? (
          <Text testID="m15-wake-cost" className="text-xr-body text-text">{c('m15.wake.cost', { name })}</Text>
        ) : null}
        {!asleep || settling ? null : confirming ? (
          <View className="flex-row gap-target-gap">
            <View className="flex-1">
              <View testID="m15-wake-confirm"><Button title={c('m15.wake.confirm', { name })} variant="cta" size="lg" fullWidth className="min-h-target" onPress={wake} /></View>
            </View>
            <View className="flex-1">
              <View testID="m15-wake-cancel"><Button title={c('m15.wake.cancel', { name })} variant="outline" size="lg" fullWidth className="min-h-target" onPress={() => local.setState({ confirming: false })} /></View>
            </View>
          </View>
        ) : (
          <View testID="m15-wake"><Button title={c('m15.wake.button', { name })} variant="outline" size="lg" fullWidth className="min-h-target" onPress={onWakeButton} /></View>
        )}
      </View>
    </SheetSurface>
  );

  // ---- the 3D H-Lynk: the Baby asleep on the glass (its tired / still pose), the energy ring and Wake drawn there ----
  const { model, monClips } = useMonGlass(identity?.dexId ?? null, care);
  const statusText = raced ? c('m15.declined.already', { name }) : settling ? c('m15.settling') : c('m15.sleeping');
  const canWake = asleep && !settling;
  const actions: GlassAction[] = !canWake ? [] : confirming
    ? [
      { target: 'cancel', label: c('m15.wake.cancel', { name }), tone: 'secondary' },
      { target: 'confirm', label: c('m15.wake.confirm', { name }), tone: 'primary' },
    ]
    : [{ target: 'wake', label: c('m15.wake.button', { name }), tone: 'secondary' }];
  const glassView: GlassView = {
    status: null,
    title: name,
    subtitle: statusText,
    rings: care === undefined ? [] : [glassRing('energy', care.energy)],
    lines: [
      ...(showLeave && !settling ? [{ text: c('m15.sleeping.leave', { name }), size: 'caption' as const }] : []),
      ...(earlyWake && canWake ? [{ text: c('m15.wake.cost', { name }), tone: 'amber' as const }] : []),
    ],
    actions,
  };
  const onAction = (target: string) => {
    if (target === 'wake') onWakeButton();
    else if (target === 'confirm') wake();
    else if (target === 'cancel') local.setState({ confirming: false });
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view: glassView, nudge });
  useEffect(() => {
    // A tap on the sleeping Baby never wakes it (M15): it only stirs.
    glass.bind({ onAction, monClips, onModel: () => local.setState({ nudge: local.getState().nudge + 1 }) });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'activate' && canWake) (confirming ? wake : onWakeButton)();
    else if (key === 'back') leave();
    else if (key === 'home') router.replace('/(home)');
  };
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: careLed(care),
      scheme: asleep ? 'night' : scheme,
      testIDPrefix: 'm15',
      creature: true,
      framing: 'home',
      trackpad: asleep && !settling
        ? { label: c('m15.trackpad.label', { name }), hint: c('m15.trackpad.hint'), onCommit: wake, commitLabel: c('m15.trackpad.commit', { name }) }
        : { label: c('m15.trackpad.label', { name }), disabled: true },
      keys: { home: { onPress: () => router.replace('/(home)') } },
    },
    screen: (
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
        {care === undefined ? null : (
          <View className="absolute right-4 top-4">
            <CareMeterRing
              need="energy"
              value={care.energy}
              label={c('m13.ring.energy')}
              low={care.energy < DEFAULT_CARE_TUNING.needsAttentionBelow}
              lowLabel={c('m13.ring.low')}
              size="md"
              scheme="night"
              reducedMotion={reducedMotion}
              testID="m15-ring-energy"
            />
          </View>
        )}
        {/* From md the panel sits in the stage's companion pane instead (HLynkStage). */}
        <View className="absolute inset-x-0 bottom-0 md:hidden">{panel}</View>
      </View>
    ),
    trailing: panel,
  });

  if (!glassOn) return null;
  const paneTips = [
    c('pane.rest.tip.energy'),
    c('pane.rest.tip.close', { name }),
    c('pane.rest.tip.early', { name }),
  ];

  return (
    <GlassStage
      screen={glass.screen}
      label={statusText}
      testIDPrefix="m15"
      onKey={onKey}
      onFailed={onFailed}
      companion={<CareHistoryPane route="rest" tips={paneTips} loading={care === undefined} />}
      a11y={
        <>
          <Text testID="m15-status" accessibilityLiveRegion="polite">{statusText}</Text>
          {care === undefined ? null : <Text testID="m15-ring-energy">{`${c('m13.ring.energy')} ${Math.round(care.energy * 100)}%`}</Text>}
          {showLeave && !settling ? <Text testID="m15-leave-note">{c('m15.sleeping.leave', { name })}</Text> : null}
          {earlyWake && canWake ? <Text testID="m15-wake-cost">{c('m15.wake.cost', { name })}</Text> : null}
        </>
      }
      controls={[
        ...glassControls(actions, glass.press, (t) => `m15-${t === 'confirm' ? 'wake-confirm' : t === 'cancel' ? 'wake-cancel' : 'wake'}`),
        { key: 'back', label: HLYNK_COPY['hlynk.key.back.label'], onPress: leave, testID: 'm15-back' },
        { key: 'home', label: HLYNK_COPY['hlynk.key.home.label'], onPress: () => router.replace('/(home)'), testID: 'm15-home' },
      ]}
    />
  );
}

