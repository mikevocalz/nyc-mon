'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { bloodlines, eggs } from '@acme/content';
import { INCUBATION_MINUTES } from '@acme/core/schemas';
import type { EggRecord, IncubationMinutes } from '@acme/core/types';
import {
  Button,
  ChoiceRows,
  EggCase,
  ErrorMessage,
  Heading,
  HLynkShell,
  IncubationRing,
  StatusRow,
  Text,
  TrackpadActions,
  useInstanceStore,
  useLayoutSize,
  useReducedMotion,
  useStore,
  type HLynkStatus,
  type IncubationRingStop,
  type ShellTrackpadProps,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { ScrollView, View } from '@acme/ui/tw';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { getNotifyPermission, scheduleReadyNotification } from '../onboarding/notify-permission';
import { readConsentRequested, useOnboarding } from '../onboarding/onboarding.store';
import { schemeForTime } from '../onboarding/time-scheme';
import { useTextRamp } from './use-text-ramp';
import { eggCopy, type EggCopyId } from './copy';
import {
  afterCaseClosed,
  buildEggViews,
  entryRedirect,
  ledChip,
  MEET_PATH,
  MON_HOME_PATH,
  NOTIFY_SHEET_PATH,
  parseBloodlineParam,
  readyAt,
  stepMinutes,
} from './egg-model';
import { EggStill } from './EggStill';
import { isAccessibilityTextSize, isLandscapeWindow, ringSizeDp } from './window-layout';

const OPTION_ID: Record<IncubationMinutes, { label: EggCopyId; a11y: EggCopyId }> = {
  15: { label: 'm10.option.15', a11y: 'm10.option.15.a11y' },
  30: { label: 'm10.option.30', a11y: 'm10.option.30.a11y' },
  60: { label: 'm10.option.60', a11y: 'm10.option.60.a11y' },
};

const STOPS: readonly IncubationRingStop<IncubationMinutes>[] = INCUBATION_MINUTES.map((value) => ({
  value,
  label: eggCopy(OPTION_ID[value].label),
  accessibilityLabel: eggCopy(OPTION_ID[value].a11y),
}));

/** Pause between the case shutting and the sheet or M11 (M10 "Motion"). Reduced motion: none. */
const AFTER_CLOSE_HOLD_MS = 400;
/** Ready-at refresh cadence: often enough to turn over on the minute. */
const CLOCK_TICK_MS = 15_000;

/** Device-locale clock time; follows the 12/24-hour setting (05-copy.md `{time}`). */
function formatClock(atMs: number): string {
  return new Date(atMs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const VIEWS = buildEggViews(eggs, bloodlines);

/** Wall clock for event handlers (choose, Start). Render reads the store's ticking `nowMs` instead. */
function eventNow(): number {
  return Date.now();
}

type IncubatePhase = 'choose' | 'starting' | 'confirmed' | 'error';

interface IncubateStore {
  readonly minutes: IncubationMinutes | null;
  readonly phase: IncubatePhase;
  readonly egg: EggRecord | null;
  readonly caseState: 'open' | 'closing' | 'closed';
  /** The M06 sheet went up; the next focus is its dismissal, so go on to M11. */
  readonly sheetShown: boolean;
  readonly nowMs: number;
  readonly scheme: 'daylit' | 'night';
}

/**
 * M10 incubation choice (docs/design/screens/M10/08-handoff.md, D-16b/c/e).
 * 15, 30 or 60 minutes, no default. Start calls `startIncubation` once (the
 * only write in the M08 → M10 path), the case closes around the egg, and
 * from the close's end callback the M06 sheet rises when notification
 * permission is undecided; otherwise M11. Re-entry with an egg or a Mon goes
 * straight to `/(home)`; a bad `bloodline` param goes back to M08.
 */
export function IncubateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bloodline?: string }>();
  const egg = parseBloodlineParam(params.bloodline, VIEWS);
  const reducedMotion = useReducedMotion();
  const t = useTextRamp();
  const { fontScale } = useWindowDimensions();
  const listLayout = isAccessibilityTextSize(fontScale);
  const { size: area, onLayout } = useLayoutSize({ width: 351, height: 468 });
  const landscape = isLandscapeWindow(area.width, area.height);

  const store = useInstanceStore<IncubateStore>(() => {
    const nowMs = Date.now();
    return { minutes: null, phase: 'choose', egg: null, caseState: 'open', sheetShown: false, nowMs, scheme: schemeForTime(nowMs) };
  });
  const s = useStore(store);

  // Ready-at refreshes with the clock while a time is chosen but not started.
  useEffect(() => {
    const id = setInterval(() => store.setState({ nowMs: Date.now() }), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [store]);

  useEffect(() => {
    if (egg === undefined) router.replace(MEET_PATH);
  }, [egg, router]);

  // Guard on mount and on focus (handoff § States "already-incubating").
  useFocusEffect(
    useCallback(() => {
      const { phase, sheetShown } = store.getState();
      if (phase === 'confirmed') {
        if (sheetShown) router.replace(MON_HOME_PATH);
        return;
      }
      if (phase === 'starting') return;
      const mon = useMonStore.getState();
      const to = entryRedirect({ hasMon: selectActiveMon(mon) !== undefined, hasPendingEgg: selectPendingEgg(mon) !== undefined });
      if (to !== undefined) router.replace(to);
    }, [router, store]),
  );

  // The hold after the case closes ends on a timer; unmount clears it so a
  // left screen never routes.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  if (egg === undefined) return null;

  const busy = s.phase === 'starting' || s.phase === 'confirmed';
  const choose = (minutes: IncubationMinutes) => {
    if (busy) return;
    store.setState({ minutes, nowMs: eventNow() });
  };
  const step = (direction: -1 | 1) => {
    if (busy) return;
    haptics.selection();
    choose(stepMinutes(INCUBATION_MINUTES, store.getState().minutes, direction));
  };

  const start = () => {
    const { minutes, phase } = store.getState();
    if (phase === 'starting' || phase === 'confirmed') return;
    if (minutes === null) {
      // With no time chosen, activate picks nothing and says why (handoff "Trackpad").
      announcePolitely(eggCopy('m10.cta.start.a11y.hint.disabled'));
      return;
    }
    store.setState({ phase: 'starting' });
    try {
      const created = useMonStore.getState().startIncubation({ bloodlineId: egg.bloodlineId, minutes, atMs: eventNow() });
      store.setState({ phase: 'confirmed', egg: created, caseState: 'closing', nowMs: eventNow() });
    } catch {
      store.setState({ phase: 'error' });
    }
  };

  const onCaseEnd = (end: 'closed' | 'open') => {
    const created = store.getState().egg;
    if (end !== 'closed' || created === null) return;
    store.setState({ caseState: 'closed' });
    haptics.success();
    announcePolitely(eggCopy('m10.confirmed.a11y.announce', { time: formatClock(created.incubationEndsAt) }));
    const proceed = async () => {
      const next = afterCaseClosed(await getNotifyPermission());
      if (next === 'sheet') {
        store.setState({ sheetShown: true });
        router.push(
          `${NOTIFY_SHEET_PATH}?mins=${created.incubationMinutes}&eggId=${encodeURIComponent(created.eggId)}&endsAtMs=${created.incubationEndsAt}`,
        );
        return;
      }
      if (next === 'schedule-then-home') {
        const scheduled = await scheduleReadyNotification({
          eggId: created.eggId,
          endsAtMs: created.incubationEndsAt,
          title: onboardingCopy('m23.notification.title'),
          body: onboardingCopy('m23.notification.body'),
        });
        if (!scheduled) useOnboarding.getState().setNotifyOff('schedule-failed');
      } else if (next === 'home') {
        const permission = await getNotifyPermission();
        if (permission === 'denied') useOnboarding.getState().setNotifyOff('denied');
      }
      router.replace(MON_HOME_PATH);
    };
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => void proceed(), reducedMotion ? 0 : AFTER_CLOSE_HOLD_MS);
  };

  const ready = s.minutes === null ? undefined : readyAt(s.nowMs, s.minutes, formatClock);
  const status: HLynkStatus =
    s.phase === 'confirmed' && s.egg !== null
      ? (() => {
          const chip = ledChip(s.egg.incubationEndsAt - s.nowMs);
          return { led: 'incubating', label: eggCopy(chip.id, { minutes: chip.minutes }), progress: 0 };
        })()
      : { led: 'off' };

  const trackpad: ShellTrackpadProps = {
    label: s.minutes === null
      ? eggCopy('m10.ring.a11y.label')
      : eggCopy('m10.trackpad.label', { option: eggCopy(OPTION_ID[s.minutes].a11y) }),
    hint: eggCopy('m10.trackpad.hint'),
    onStep: step,
    onActivate: start,
    disabled: busy,
  };
  const keys = {
    back: { label: eggCopy('m10.back.a11y.label'), onPress: busy ? undefined : () => router.back() },
    home: { onPress: s.caseState === 'closed' ? () => router.replace(MON_HOME_PATH) : undefined },
  };

  const consentPending = readConsentRequested();
  const statusRow = consentPending ? (
    <StatusRow items={[{ id: 'status-consent-pending', label: onboardingCopy('m05.badge.pending'), tone: 'pending' }]} />
  ) : undefined;

  const ringSize = ringSizeDp(area.width, area.height);
  const eggLabel = eggCopy('m10.egg.a11y.label', { eggName: egg.eggName });
  const eggCase = (sizePt: number) => (
    <EggCase
      state={s.caseState}
      padLit={s.caseState !== 'open'}
      onTransitionEnd={onCaseEnd}
      reducedMotion={reducedMotion}
      accessibilityLabel={s.caseState === 'closed' ? eggCopy('m10.case.a11y.closed', { eggName: egg.eggName }) : undefined}
      sizePt={sizePt}
      scheme={s.scheme}
      testID="m10-case"
    >
      <View testID="m10-egg" accessible accessibilityRole="image" accessibilityLabel={eggLabel} aria-label={eggLabel} className="flex-1">
        <EggStill dexId={egg.dexId} decorative />
      </View>
    </EggCase>
  );

  const head = (
    <View className="gap-1">
      <Heading level={1} className={t.title} testID="m10-title">{eggCopy('m10.title')}</Heading>
      <Text className={`${t.body} text-text-muted`} testID="m10-body">{eggCopy('m10.body')}</Text>
    </View>
  );

  const choice: ReactNode = listLayout ? (
    <View className="gap-3">
      <View className="items-center">{eggCase(120)}</View>
      <ChoiceRows
        rows={STOPS.map((stop) => ({ key: String(stop.value), label: stop.accessibilityLabel, accessibilityLabel: stop.accessibilityLabel }))}
        value={s.minutes === null ? null : INCUBATION_MINUTES.indexOf(s.minutes)}
        onChange={(i) => choose(INCUBATION_MINUTES[i]!)}
        accessibilityLabel={eggCopy('m10.ring.a11y.label')}
        testID="m10-ring"
        rowTestID={(row) => `m10-option-${row.key}`}
      />
    </View>
  ) : (
    <View className="items-center">
      <IncubationRing
        stops={STOPS}
        value={s.minutes}
        onChange={busy ? undefined : choose}
        accessibilityLabel={eggCopy('m10.ring.a11y.label')}
        centre={eggCase(Math.round(ringSize * 0.5))}
        sizePt={ringSize}
        scheme={s.scheme}
        reducedMotion={reducedMotion}
        testID="m10-ring"
        stopTestID={(v) => `m10-option-${v}`}
      />
    </View>
  );

  const readyLine = ready === undefined ? null : (
    <Text className={`${t.strong} tabular-nums text-text`} testID="m10-ready">
      {eggCopy(ready.id, { time: ready.time })}
    </Text>
  );

  const startButton = (
    <View testID="m10-start">
      <Button
        variant="cta"
        size="lg"
        fullWidth
        title={eggCopy('m10.cta.start')}
        disabled={s.minutes === null || s.phase === 'confirmed'}
        loading={s.phase === 'starting'}
        accessibilityHint={s.minutes === null ? eggCopy('m10.cta.start.a11y.hint.disabled') : undefined}
        onPress={start}
      />
    </View>
  );

  const actions = busy ? null : (
    <View testID="m10-actions">
      <TrackpadActions
        onStepBack={() => step(-1)}
        stepBackLabel={eggCopy('m10.action.prev')}
        onStepForward={() => step(1)}
        stepForwardLabel={eggCopy('m10.action.next')}
      />
    </View>
  );

  const error = s.phase === 'error' ? (
    <View className="gap-2" testID="m10-error">
      <Text className={`${t.strong} text-text`}>{eggCopy('m10.error.title')}</Text>
      <ErrorMessage message={eggCopy('m10.error.body')} />
      <View testID="m10-retry">
        <Button variant="outline" title={eggCopy('m10.error.retry')} onPress={start} />
      </View>
    </View>
  ) : null;

  const screen = landscape && !listLayout ? (
    <View onLayout={onLayout} className="flex-1 flex-row gap-6 p-6">
      <ScrollView className="flex-1" contentContainerClassName="gap-4">
        {head}
        {readyLine}
        {error}
        {actions}
        {startButton}
      </ScrollView>
      <View className="flex-1 items-center justify-center">{choice}</View>
    </View>
  ) : (
    <View onLayout={onLayout} className="flex-1 p-4">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-3">
        {head}
        {choice}
        {readyLine}
        {error}
        {actions}
      </ScrollView>
      {/* Start stays pinned to the screen's bottom edge, above the scroll (07-a11y.md XXL). */}
      {startButton}
    </View>
  );

  return (
    <HLynkShell
      testIDPrefix="m10"
      tier="core"
      scheme={s.scheme}
      status={status}
      reducedMotion={reducedMotion}
      statusRow={statusRow}
      trackpad={trackpad}
      keys={keys}
      screen={screen}
    />
  );
}
