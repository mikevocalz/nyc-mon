'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { assertNever, DEFAULT_CARE_TUNING, deriveMonMood, mealNutrition, wouldOverfeed } from '@acme/core/sim';
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

/** D-15e: no named foods, so every meal is the shared meal. */
const SHARE_A_MEAL: Extract<CareAction, { kind: 'feed' }> = { kind: 'feed' };
/** How long the eating line holds before the tray returns. The 2D still has no `eat` clip to time it (B2). */
const EATING_MS = 1200;
/** The Baby large, the fullness ring, two lines of text and one row of buttons. */
const LAYOUT = { model: 'large', rings: true, lineRows: 2, actionRows: 1, perRow: 2 } as const;
/** Squeaklet's eating clip, when the file has it; otherwise the mood's own loop plays. */
const EATING_CLIPS = ['jaw_chomp'] as const;

type FeedPhase = { kind: 'tray' } | { kind: 'eating' } | { kind: 'declined'; reason: 'asleep' | 'sluggish' };

/**
 * M14 Feed, shipped as "Share a meal" (D-15e): no food tray until
 * `content/food` exists, so the one action feeds the shared meal through
 * `applyCare`. Opening while asleep or sluggish goes straight to the declined
 * message (no tray flash). The "full" line shows before the meal that would
 * overfeed, judged on the after-meal value (`wouldOverfeed`, D-15d).
 */
export function FeedScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { care, identity, scheme } = useCareNow();
  const local = useInstanceStore<{ phase: FeedPhase; failed: boolean; nudge: number }>(() => ({ phase: { kind: 'tray' }, failed: false, nudge: 0 }));
  const phase = useStore(local, (s) => s.phase);
  const failed = useStore(local, (s) => s.failed);
  const nudge = useStore(local, (s) => s.nudge);
  const glassOn = useGlassOn(failed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (identity === undefined) router.replace('/(home)');
  }, [identity, router]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const name = identity?.name ?? '';
  const mood = care === undefined ? undefined : deriveMonMood(care);
  // Opening asleep or sluggish is declined before any tap.
  const view: FeedPhase =
    phase.kind !== 'tray' ? phase
      : mood === 'asleep' ? { kind: 'declined', reason: 'asleep' }
        : mood === 'sluggish' ? { kind: 'declined', reason: 'sluggish' }
          : phase;
  const full = care !== undefined && wouldOverfeed(care, mealNutrition(SHARE_A_MEAL));

  const feed = () => {
    if (view.kind !== 'tray') return;
    let outcome;
    try {
      outcome = useMonStore.getState().applyCare(SHARE_A_MEAL, Date.now());
    } catch {
      // applyCare throws only with no active Mon (M22 recovery lives at the group index).
      router.replace('/(home)');
      return;
    }
    tickMinuteClock();
    switch (outcome.kind) {
      case 'eaten': {
        haptics.success();
        announcePolitely(c('m14.eating.a11y', { name }));
        local.setState({ phase: { kind: 'eating' } });
        timer.current = setTimeout(() => {
          const now = useMonStore.getState().save?.care.find((x) => x.monInstanceId === identity?.monInstanceId);
          announcePolitely(c('m14.eaten.a11y', { name, percent: Math.round((now?.fullness ?? 0) * 100) }));
          local.setState({ phase: { kind: 'tray' } });
        }, reducedMotion ? 0 : EATING_MS);
        return;
      }
      case 'overfed':
        haptics.success();
        announcePolitely(c('m14.overfed.a11y', { name }));
        router.back();
        return;
      case 'declined':
        if (outcome.reason === 'asleep' || outcome.reason === 'sluggish') {
          local.setState({ phase: { kind: 'declined', reason: outcome.reason } });
        }
        return;
      case 'fell-asleep':
      case 'woke':
      case 'played':
        // Feed never returns these; listed so a new outcome fails typecheck here.
        return;
      default:
        return assertNever(outcome);
    }
  };

  // One panel, drawn twice: over the device screen below md, and titled in
  // the stage's companion pane from md (HLynkStage). Only one is ever displayed.
  const panel = (inPane: boolean) => (
    <SheetSurface
      placement="in-screen"
      scheme="night"
      title={inPane ? c('m14.title', { name }) : undefined}
      onClose={() => router.back()}
      closeLabel={c('m14.close')}
      testID="m14-tray"
    >
      {view.kind === 'declined' ? (
        <View testID="m14-declined" className="gap-target-gap">
          <Text className="text-xr-body text-text">
            {view.reason === 'asleep' ? c('m14.declined.asleep', { name }) : c('m14.declined.sluggish', { name })}
          </Text>
          {view.reason === 'asleep' ? (
            <View testID="m14-declined-action"><Button
              title={c('m14.declined.asleep.action')}
              variant="outline"
              size="lg"
              fullWidth
              className="min-h-target"
              onPress={() => router.replace('/(home)/rest')}
            /></View>
          ) : null}
        </View>
      ) : (
        <View className="gap-target-gap" style={{ opacity: view.kind === 'eating' ? 0.4 : 1 }}>
          {full ? <Text testID="m14-full" className="text-xr-body text-text">{c('m14.full.body', { name })}</Text> : null}
          <Button
            title={c('m14.share')}
            variant="cta"
            size="lg"
            fullWidth
            className="min-h-target"
            accessibilityHint={c('m14.tile.hint', { name })}
            disabled={view.kind === 'eating'}
            onPress={feed}
          />
        </View>
      )}
    </SheetSurface>
  );

  const ring = care === undefined ? null : (
    <View className="absolute left-4 top-4">
      <CareMeterRing
        need="fullness"
        value={care.fullness}
        label={c('m13.ring.fullness')}
        low={care.fullness < DEFAULT_CARE_TUNING.needsAttentionBelow}
        lowLabel={c('m13.ring.low')}
        size="sm"
        scheme={scheme}
        reducedMotion={reducedMotion}
        testID="m14-ring-fullness"
      />
    </View>
  );

  // ---- the 3D H-Lynk: the Baby on the glass (eating plays its chomp), the ring and the tray drawn there ----
  const { model, monClips } = useMonGlass(identity?.dexId ?? null, care, view.kind === 'eating' ? EATING_CLIPS : []);
  const declinedText = view.kind === 'declined'
    ? (view.reason === 'asleep' ? c('m14.declined.asleep', { name }) : c('m14.declined.sluggish', { name }))
    : null;
  const actions: GlassAction[] = view.kind === 'declined'
    ? [
      ...(view.reason === 'asleep' ? [{ target: 'rest', label: c('m14.declined.asleep.action'), tone: 'primary' as const }] : []),
      { target: 'close', label: c('m14.close'), tone: view.reason === 'asleep' ? 'secondary' : 'primary' },
    ]
    : [
      { target: 'close', label: c('m14.close'), tone: 'secondary' },
      { target: 'share', label: c('m14.share'), tone: 'primary', disabled: view.kind === 'eating' },
    ];
  const glassView: GlassView = {
    status: null,
    title: c('m14.title', { name }),
    subtitle: identity?.bloodlineLabel ?? '',
    rings: care === undefined ? [] : [glassRing('fullness', care.fullness)],
    lines: [
      ...(declinedText ? [{ text: declinedText, tone: 'text' as const }] : []),
      ...(view.kind !== 'declined' && full ? [{ text: c('m14.full.body', { name }), tone: 'amber' as const }] : []),
    ],
    actions,
  };
  const onAction = (target: string) => {
    if (target === 'share') feed();
    else if (target === 'rest') router.replace('/(home)/rest');
    else if (target === 'close') router.back();
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view: glassView, nudge });
  useEffect(() => {
    glass.bind({ onAction, monClips, onModel: () => local.setState({ nudge: local.getState().nudge + 1 }) });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'activate' && view.kind === 'tray') feed();
    else if (key === 'back') router.back();
    else if (key === 'home') router.replace('/(home)');
  };
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: careLed(care),
      scheme,
      testIDPrefix: 'm14',
      creature: true,
      framing: 'home',
      trackpad: {
        label: c('m14.share'),
        hint: view.kind === 'tray' ? c('m14.trackpad.hint.share') : undefined,
        onActivate: view.kind === 'tray' ? feed : undefined,
        disabled: view.kind !== 'tray',
      },
      keys: { home: { onPress: () => router.replace('/(home)') } },
    },
    screen: (
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
        {ring}
        <View className="absolute inset-x-0 bottom-0 md:hidden">{panel(false)}</View>
      </View>
    ),
    trailing: panel(true),
  });

  if (!glassOn) return null;
  const paneTips = [
    ...(care?.activity.kind === 'asleep' ? [c('pane.feed.tip.asleep', { name })] : []),
    c('pane.feed.tip.ask', { name }),
    c('pane.feed.tip.full', { name }),
  ];

  return (
    <GlassStage
      screen={glass.screen}
      label={c('m14.title', { name })}
      testIDPrefix="m14"
      onKey={onKey}
      onFailed={onFailed}
      companion={<CareHistoryPane route="feed" tips={paneTips} loading={care === undefined} />}
      a11y={
        <>
          <Text accessibilityRole="header">{c('m14.title', { name })}</Text>
          {care === undefined ? null : (
            <Text testID="m14-ring-fullness">{`${c('m13.ring.fullness')} ${Math.round(care.fullness * 100)}%`}</Text>
          )}
          {declinedText ? <Text testID="m14-declined">{declinedText}</Text> : null}
          {view.kind !== 'declined' && full ? <Text testID="m14-full">{c('m14.full.body', { name })}</Text> : null}
        </>
      }
      controls={[
        ...glassControls(
          actions,
          glass.press,
          (t) => (t === 'share' ? 'm14-share' : t === 'rest' ? 'm14-declined-action' : 'm14-close'),
          (t) => (t === 'share' ? c('m14.tile.hint', { name }) : undefined),
        ),
        { key: 'home', label: HLYNK_COPY['hlynk.key.home.label'], onPress: () => router.replace('/(home)'), testID: 'm14-home' },
      ]}
    />
  );
}
