'use client';

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  CaptureCase, HLYNK_COPY, IncubationRing, StatusRow, TrackpadActions, inhaleStarted, padGlowAt,
  useInstanceStore, useLedBreathPhase, useReducedMotion, useStore, type HLynkStatus, type StatusRowItem,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import type { PendingEgg } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { getNotifyPermission, requestNotifyPermission, scheduleReadyNotification, type NotifyPermission } from '../onboarding/notify-permission';
import { readyBannerHold } from '../onboarding/notify-foreground';
import { schemeForTime } from '../onboarding/time-scheme';
import { useHomeStage } from '../companion/home-stage.store';
import { useMinuteClock } from '../companion/minute-clock';
import { eggIdentity } from '../companion/mon-identity';
import { hatchCopy } from './copy';
import { detailLine, incubationProgress, incubationView, minutesLeft, timeLine } from './incubation-model';

/** One warm announcement per this window at most (M11 copy). */
const WARM_ANNOUNCE_MS = 10_000;
/** The "resting in its case" caption shows only when the egg was just created (first arrival from M10). */
const FIRST_ARRIVAL_MS = 5 * 60_000;
const captionSeen = new Set<string>();

interface LocalState {
  entryMs: number;
  readyLatched: boolean;
  announcedReady: boolean;
  permission: NotifyPermission | undefined;
  scheduleFailed: boolean;
  holding: boolean;
  lastWarmAnnounceMs: number | undefined;
  showCaption: boolean;
}

/**
 * M11 Incubating, rendered at `/(home)` while the egg is in its case. Writes
 * nothing: readiness is the hatch state ticked to the minute clock, not
 * persisted (Law 6); the only commit is M12's `open`. "Warm the case" is
 * haptic and visual only, with no sim effect (a reviewer should reject any
 * `applyCare` or bond change wired to it).
 */
export function IncubatingScreen({ pending }: { pending: PendingEgg }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const nowMs = useMinuteClock((s) => s.nowMs);
  const { egg, hatch } = pending;
  const id = eggIdentity(egg);

  const local = useInstanceStore<LocalState>(() => {
    const entryMs = Date.now();
    const fresh = entryMs - egg.createdAt < FIRST_ARRIVAL_MS && !captionSeen.has(egg.eggId);
    captionSeen.add(egg.eggId);
    return {
      entryMs, readyLatched: false, announcedReady: false, permission: undefined, scheduleFailed: false,
      holding: false, lastWarmAnnounceMs: undefined, showCaption: fresh,
    };
  });
  const s = useStore(local);

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

  // Pad glow follows the shared breath clock while held; the warm haptic lands on each inhale.
  const breath = useLedBreathPhase(s.holding && !reducedMotion);
  const holding = useSharedValue(0);
  useEffect(() => {
    holding.set(s.holding ? 1 : withTiming(0, { duration: reducedMotion ? 0 : 200 }));
  }, [s.holding, reducedMotion, holding]);
  const padGlow = useDerivedValue(() => holding.get() * padGlowAt(breath.get(), reducedMotion));
  useAnimatedReaction(
    () => breath.get(),
    (phase, prev) => {
      if (prev !== null && holding.get() === 1 && inhaleStarted(prev, phase)) scheduleOnRN(haptics.warm);
    },
  );

  const warmStart = () => {
    haptics.warm();
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
  const warmOnce = () => {
    warmStart();
    if (warmTimer.current !== null) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(warmEnd, reducedMotion ? 600 : 4000);
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
  const caseLabel = hatchCopy(ready ? 'm11.case.a11y.label.ready' : 'm11.case.a11y.label', { eggName: id.eggName });

  useHomeStage({
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
            onActivate: warmOnce,
            onHoldStart: warmStart,
            onHoldEnd: warmEnd,
          },
      keys: { home: { disabled: true } },
      statusRow: (
        <TrackpadActions
          testID={ready ? 'm11-action-open' : 'm11-action-warm'}
          onActivate={ready ? open : warmOnce}
          activateLabel={hatchCopy(ready ? 'm11.trackpad.open' : 'm11.trackpad.warm')}
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
        <CaptureCase
          testID="m11-case"
          lid="closed"
          padGlow={padGlow}
          seam={ready ? 'lit' : 'off'}
          scheme={scheme}
          reducedMotion={reducedMotion}
          accessibilityLabel={caseLabel}
        />
        <View className="w-full items-center gap-2 bg-scrim-scene px-4 py-3" style={{ minHeight: 96 }}>
          <View className="flex-row items-center gap-3">
            {view === 'counting' ? (
              <IncubationRing testID="m11-ring" startedAt={egg.createdAt} endsAt={egg.incubationEndsAt} reducedMotion={reducedMotion} sizePt={48} />
            ) : null}
            <Text testID="m11-time" className="text-xr-title text-signage-white" accessibilityRole="header">
              {timeLine(view, egg.incubationEndsAt, nowMs)}
            </Text>
          </View>
          {detail ? <Text testID="m11-time-detail" className="text-xr-caption text-silver-300">{detail}</Text> : null}
          {s.showCaption && view === 'counting' ? (
            <Text testID="m11-caption" className="text-xr-caption text-silver-300">{hatchCopy('m11.caption.counting')}</Text>
          ) : null}
        </View>
      </View>
    ),
  });

  return null;
}
