'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { bloodlines, eggs } from '@acme/content';
import { INCUBATION_MINUTES } from '@acme/core/schemas';
import type { EggRecord, IncubationMinutes } from '@acme/core/types';
import {
  Button,
  ChoiceRows,
  ErrorMessage,
  FIT_SIDE_GAP_PT,
  Heading,
  HLynkFit,
  HLynkShell,
  IncubationRing,
  StatusRow,
  Text,
  TrackpadActions,
  useInstanceStore,
  useIsHeadset,
  useReducedMotion,
  useStore,
  type FitStep,
  type HLynkFitContext,
  type HLynkStatus,
  type IncubationRingStop,
  type ShellTrackpadProps,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { View } from '@acme/ui/tw';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { readConsentRequested, readPermissionReview, startPermissionReview } from '../onboarding/onboarding.store';
import { schemeForTime } from '../onboarding/time-scheme';
import { eggCopy, type EggCopyId } from './copy';
import {
  buildEggViews,
  entryRedirect,
  ledChip,
  MEET_PATH,
  MON_HOME_PATH,
  PERMISSIONS_PATH,
  parseBloodlineParam,
  readyAt,
  stepMinutes,
} from './egg-model';
import { EggStill } from './EggStill';
import { incubateArrangement, incubateFitBlocks, isAccessibilityTextSize } from './window-layout';

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

/**
 * Pause between the confirmation and the sheet or M11 (M10 "Motion"), so the
 * announcement lands before the route changes. Reduced motion: none. The case
 * close that used to fill this gap is gone (Decision 29).
 */
const AFTER_START_HOLD_MS = 400;
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
  /** The final review route was entered; re-focus resolves to its saved checkpoint. */
  readonly permissionsShown: boolean;
  readonly nowMs: number;
  readonly scheme: 'daylit' | 'night';
}

/**
 * M10 incubation choice (docs/design/screens/M10/08-handoff.md, D-16b/c/e).
 * 15, 30 or 60 minutes, no default. Start calls `startIncubation` once (the
 * only write in the M08 → M10 path), the egg starts incubating where it sits
 * (no case, Decision 29), and after a short hold the final permissions review
 * opens. First-run
 * notification scheduling belongs there, never during the animation.
 * Re-entry with an egg or a Mon goes
 * straight to `/(home)`; a bad `bloodline` param goes back to M08.
 */
export function IncubateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bloodline?: string }>();
  const egg = parseBloodlineParam(params.bloodline, VIEWS);
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const listLayout = isAccessibilityTextSize(fontScale);
  const headset = useIsHeadset();

  const store = useInstanceStore<IncubateStore>(() => {
    const nowMs = Date.now();
    return { minutes: null, phase: 'choose', egg: null, permissionsShown: false, nowMs, scheme: schemeForTime(nowMs) };
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
      const { phase, permissionsShown } = store.getState();
      if (phase === 'confirmed') {
        if (permissionsShown) router.replace(readPermissionReview() === 'pending' ? PERMISSIONS_PATH : MON_HOME_PATH);
        return;
      }
      if (phase === 'starting') return;
      const mon = useMonStore.getState();
      const to = entryRedirect({ hasMon: selectActiveMon(mon) !== undefined, hasPendingEgg: selectPendingEgg(mon) !== undefined });
      if (to !== undefined) router.replace(to);
    }, [router, store]),
  );

  // The hold after the confirmation ends on a timer; unmount clears it so a
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
    let created: EggRecord;
    try {
      created = useMonStore.getState().startIncubation({ bloodlineId: egg.bloodlineId, minutes, atMs: eventNow() });
    } catch {
      store.setState({ phase: 'error' });
      return;
    }
    // The egg exists from here on. Nothing below may route to the error state,
    // or a retry would start a second egg.
    startPermissionReview();
    store.setState({ phase: 'confirmed', egg: created, nowMs: eventNow() });
    confirmed(created);
  };

  const confirmed = (created: EggRecord) => {
    haptics.success();
    announcePolitely(eggCopy('m10.confirmed.a11y.announce', { time: formatClock(created.incubationEndsAt) }));
    store.setState({ permissionsShown: true });
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      () => router.replace(readPermissionReview() === 'pending' ? PERMISSIONS_PATH : MON_HOME_PATH),
      reducedMotion ? 0 : AFTER_START_HOLD_MS,
    );
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
    home: { onPress: s.permissionsShown ? () => router.replace(readPermissionReview() === 'pending' ? PERMISSIONS_PATH : MON_HOME_PATH) : undefined },
  };

  const consentPending = readConsentRequested();
  const statusRow = consentPending ? (
    <StatusRow items={[{ id: 'status-consent-pending', label: onboardingCopy('m05.badge.pending'), tone: 'pending' }]} />
  ) : undefined;

  const eggLabel = eggCopy('m10.egg.a11y.label', { eggName: egg.eggName });
  const incubatingLabel = s.phase === 'confirmed' ? eggCopy('m10.egg.a11y.incubating', { eggName: egg.eggName }) : eggLabel;
  const eggView = (sizePt: number) => (
    <View
      testID="m10-egg"
      accessible
      accessibilityRole="image"
      accessibilityLabel={incubatingLabel}
      aria-label={incubatingLabel}
      style={{ width: sizePt, height: sizePt }}
    >
      <EggStill dexId={egg.dexId} decorative />
    </View>
  );

  const titleText = eggCopy('m10.title');
  const bodyText = eggCopy('m10.body');
  const readyText = ready === undefined ? '' : eggCopy(ready.id, { time: ready.time });
  const errorTitle = eggCopy('m10.error.title');
  const errorBody = eggCopy('m10.error.body');

  const head = (type: FitStep) => (
    <View className="gap-1">
      <Heading level={1} className={type.title.className} testID="m10-title">{titleText}</Heading>
      <Text className={`${type.body.className} text-text-muted`} testID="m10-body">{bodyText}</Text>
    </View>
  );

  const choice = (mediaPt: number) => listLayout ? (
    <View style={{ gap: 8 }}>
      <View className="items-center">{eggView(mediaPt)}</View>
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
        centre={eggView(Math.round(mediaPt * 0.5))}
        sizePt={mediaPt}
        scheme={s.scheme}
        reducedMotion={reducedMotion}
        testID="m10-ring"
        stopTestID={(v) => `m10-option-${v}`}
      />
    </View>
  );

  const readyLine = (type: FitStep) => ready === undefined ? null : (
    <Text className={`${type.strong.className} tabular-nums text-text`} testID="m10-ready">{readyText}</Text>
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

  const error = (type: FitStep) => s.phase === 'error' ? (
    <View style={{ gap: type.gapPt }} testID="m10-error">
      <Text className={`${type.strong.className} text-text`}>{errorTitle}</Text>
      <ErrorMessage message={errorBody} />
      <View testID="m10-retry">
        <Button variant="outline" title={eggCopy('m10.error.retry')} onPress={start} />
      </View>
    </View>
  ) : null;

  // Decision H-3: nothing in the H-Lynk screen scrolls. HLynkFit measures the
  // screen, shrinks the ring first, then steps the type and spacing down.
  const fitParts = (ctx: HLynkFitContext) => ({
    titleChars: titleText.length,
    bodyChars: bodyText.length,
    headInScreen: true,
    listLayout,
    readyChars: readyText.length,
    actionsShown: !busy,
    error: s.phase === 'error' ? { titleChars: errorTitle.length, bodyChars: errorBody.length } : null,
    fontScale: ctx.fontScale,
    widthDp: ctx.widthPt,
  });
  const arrangementFor = (ctx: HLynkFitContext) => incubateArrangement(ctx.widthPt, ctx.heightPt, listLayout);

  const screen = (
    <HLynkFit
      testID="m10-fit"
      ramp={headset ? 'xr' : 'mobile'}
      arrangement={arrangementFor}
      blocks={(ctx) => incubateFitBlocks(fitParts(ctx), arrangementFor(ctx) === 'side')}
    >
      {(fit, ctx) => arrangementFor(ctx) === 'side' ? (
        <View className="flex-row" style={{ flexGrow: 1, gap: FIT_SIDE_GAP_PT }}>
          <View className="flex-1 justify-center" style={{ gap: fit.type.gapPt }}>
            {head(fit.type)}
            {readyLine(fit.type)}
            {error(fit.type)}
            {actions}
            {startButton}
          </View>
          <View className="items-center justify-center" style={{ width: fit.mediaPt }}>{choice(fit.mediaPt)}</View>
        </View>
      ) : (
        // flexGrow, not flex-1: an auto basis lets HLynkFit measure a real overflow.
        <View style={{ flexGrow: 1, gap: fit.type.gapPt }}>
          {head(fit.type)}
          {choice(fit.mediaPt)}
          {readyLine(fit.type)}
          {error(fit.type)}
          {actions}
          {/* Start sits on the screen's bottom edge (07-a11y.md XXL). */}
          <View className="justify-end" style={{ flexGrow: 1 }}>{startButton}</View>
        </View>
      )}
    </HLynkFit>
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
