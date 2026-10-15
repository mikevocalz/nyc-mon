'use client';

import { useCallback, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { bloodlines, eggs } from '@acme/content';
import {
  Button,
  Card,
  ChoiceRows,
  ChoiceTriptych,
  ErrorMessage,
  Heading,
  HLynkShell,
  StatusRow,
  Text,
  TrackpadActions,
  useInstanceStore,
  useLayoutSize,
  useReducedMotion,
  useStore,
  type ChoiceTriptychItem,
  type ShellTrackpadProps,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { ScrollView, View } from '@acme/ui/tw';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { readConsentRequested } from '../onboarding/onboarding.store';
import { schemeForTime } from '../onboarding/time-scheme';
import { useTextRamp } from './use-text-ramp';
import { eggCopy } from './copy';
import { EggStill } from './EggStill';
import {
  buildEggViews,
  entryRedirect,
  incubateHref,
  MEET_INITIAL,
  meetAskConfirm,
  meetBack,
  meetFocus,
  meetStep,
  type EggView,
  type MeetState,
} from './egg-model';
import { isAccessibilityTextSize, isLandscapeWindow } from './window-layout';

/** Built once at import: a content parse failure surfaces as the route's error state. */
function loadEggs(): { views: readonly EggView[] } | { error: true } {
  try {
    return { views: buildEggViews(eggs, bloodlines) };
  } catch {
    return { error: true };
  }
}

interface MeetStore extends MeetState {
  readonly holding: boolean;
  /** Content rebuilt after "Try again". */
  readonly loaded: ReturnType<typeof loadEggs>;
  readonly scheme: 'daylit' | 'night';
}

/**
 * M08 egg choice (docs/design/screens/M08/08-handoff.md, D-16a–e). Three
 * eggs, no default. Browsing → approaching (a tile fills, the card rises) →
 * confirming (the button path asks once) → M10 with `?bloodline=`. Holding
 * the trackpad commits directly. Nothing is written here: the choice lives in
 * the M10 route param until `startIncubation` (D-16c). A Caller with a Mon
 * or an egg never sees this screen (re-entry guard on focus).
 */
export function MeetScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const t = useTextRamp();
  // Text size from the window; shape from the screen the shell actually gives
  // us, so a resized Horizon window or split view re-lays out live.
  const { fontScale } = useWindowDimensions();
  const listLayout = isAccessibilityTextSize(fontScale);
  const { size: area, onLayout } = useLayoutSize({ width: 351, height: 468 });
  const landscape = isLandscapeWindow(area.width, area.height);

  const store = useInstanceStore<MeetStore>(() => ({
    ...MEET_INITIAL,
    holding: false,
    loaded: loadEggs(),
    scheme: schemeForTime(Date.now()),
  }));
  const { phase, focused, holding, loaded, scheme } = useStore(store);

  // Re-entry guard (handoff § States "already chosen"): on mount and on focus.
  useFocusEffect(
    useCallback(() => {
      const mon = useMonStore.getState();
      const to = entryRedirect({ hasMon: selectActiveMon(mon) !== undefined, hasPendingEgg: selectPendingEgg(mon) !== undefined });
      if (to !== undefined) router.replace(to);
    }, [router]),
  );

  const set = (next: MeetState) => store.setState({ phase: next.phase, focused: next.focused });
  const views = 'views' in loaded ? loaded.views : [];
  const count = views.length;
  const egg = focused === null ? undefined : views[focused];

  const choose = (chosen: EggView) => {
    haptics.success();
    announcePolitely(eggCopy('m08.chosen.a11y.announce', { eggName: chosen.eggName }));
    // Back from M10 returns to this egg, focused (M10 "Trackpad": back → M08 with the egg focused).
    set({ phase: 'approaching', focused: chosen.index - 1 });
    store.setState({ holding: false });
    router.push(incubateHref(chosen.bloodlineId));
  };
  const step = (direction: -1 | 1) => {
    if (phase === 'confirming') return;
    haptics.selection();
    set(meetStep(store.getState(), direction, count));
  };
  const back = () => {
    const next = meetBack(store.getState());
    if (next === 'leave') {
      if (router.canGoBack()) router.back();
      return;
    }
    set(next);
  };
  const lookCloser = () => {
    haptics.tap();
    set(meetStep(store.getState(), 1, count));
  };

  const consentPending = readConsentRequested();
  const statusRow = consentPending ? (
    <StatusRow items={[{ id: 'status-consent-pending', label: onboardingCopy('m05.badge.pending'), tone: 'pending' }]} />
  ) : undefined;

  const trackpad: ShellTrackpadProps =
    phase === 'browsing'
      ? {
          label: eggCopy('m08.trackpad.label.browsing'),
          hint: eggCopy('m08.trackpad.hint'),
          onStep: step,
          onActivate: lookCloser,
        }
      : phase === 'approaching' && egg !== undefined
        ? {
            label: eggCopy('m08.trackpad.label.focused', { eggName: egg.eggName, index: egg.index }),
            hint: eggCopy('m08.trackpad.hint'),
            onStep: step,
            onCommit: () => choose(egg),
            commitLabel: eggCopy('m08.trackpad.commit.label', { eggName: egg.eggName }),
            onHoldStart: () => store.setState({ holding: true }),
            onHoldEnd: () => store.setState({ holding: false }),
          }
        : {
            label: egg === undefined ? eggCopy('m08.trackpad.label.browsing') : eggCopy('m08.confirm.title', { eggName: egg.eggName }),
            onActivate: egg === undefined ? undefined : () => choose(egg),
          };

  const keys = {
    back: { label: eggCopy('m08.back.a11y.label'), onPress: back },
    forward: { onPress: phase === 'confirming' ? undefined : () => step(1) },
  };

  const shell = (screen: ReactNode) => (
    <HLynkShell
      testIDPrefix="m08"
      tier="core"
      scheme={scheme}
      status={{ led: 'off' }}
      reducedMotion={reducedMotion}
      statusRow={statusRow}
      trackpad={trackpad}
      keys={keys}
      screen={screen}
    />
  );

  if ('error' in loaded) {
    return shell(
      <View className="flex-1 justify-center gap-4 p-4" testID="m08-error">
        <Heading level={1} className={t.title}>{eggCopy('m08.error.title')}</Heading>
        <ErrorMessage message={eggCopy('m08.error.body')} />
        <View testID="m08-retry">
          <Button variant="outline" title={eggCopy('m08.error.retry')} onPress={() => store.setState({ loaded: loadEggs() })} />
        </View>
      </View>,
    );
  }

  const tileItems: ChoiceTriptychItem[] = views.map((v) => ({
    key: v.bloodlineId,
    label: eggCopy('m08.tile.label', { eggName: v.eggName }),
    accessibilityLabel: eggCopy('m08.tile.a11y.label', { eggName: v.eggName, bloodline: v.bloodline, index: v.index }),
    media: <EggStill dexId={v.dexId} />,
  }));

  const card = egg === undefined ? null : (
    <Card variant="notch" surface="page" title={egg.eggName} titleLevel={2} padded={false} testID="m08-card">
      <ScrollView className="max-h-full" contentContainerClassName="gap-2 p-3">
        <Text
          className={`${t.strong} tabular-nums text-text`}
          accessibilityLabel={eggCopy('m08.card.number.a11y', { dexId: egg.dexId })}
          testID="m08-card-number"
        >
          {eggCopy('m08.card.number', { dexNumber: egg.dexNumber })}
        </Text>
        <Text className={`${t.label} text-text-muted`} testID="m08-card-bloodline">
          {eggCopy('m08.card.bloodline', { bloodline: egg.bloodline })}
        </Text>
        {phase === 'confirming' ? (
          <View className="gap-3">
            <Text className={`${t.strong} text-text`} testID="m08-confirm-title">
              {eggCopy('m08.confirm.title', { eggName: egg.eggName })}
            </Text>
            <Text className={`${t.body} text-text`}>{eggCopy('m08.confirm.body')}</Text>
            <View testID="m08-confirm-yes">
              <Button variant="cta" size="lg" fullWidth title={eggCopy('m08.confirm.yes')} onPress={() => choose(egg)} />
            </View>
            <View testID="m08-confirm-no">
              <Button variant="outline" size="lg" fullWidth title={eggCopy('m08.confirm.no')} onPress={back} />
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Text className={`${t.body} text-text`} testID="m08-card-body">{eggCopy('m08.card.body')}</Text>
            <View testID="m08-choose">
              <Button
                variant="cta"
                size="lg"
                fullWidth
                title={eggCopy('m08.cta.choose', { eggName: egg.eggName })}
                onPress={() => set(meetAskConfirm(store.getState()))}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Card>
  );

  const santoroLine = eggCopy('m08.santoro.line');
  const actions = (
    <View testID="m08-actions">
      {phase === 'browsing' ? (
        <TrackpadActions onActivate={lookCloser} activateLabel={eggCopy('m08.action.look')} />
      ) : phase === 'approaching' ? (
        <TrackpadActions
          onStepBack={() => step(-1)}
          stepBackLabel={eggCopy('m08.action.prev')}
          onActivate={() => set(MEET_INITIAL)}
          activateLabel={eggCopy('m08.action.all')}
          onStepForward={() => step(1)}
          stepForwardLabel={eggCopy('m08.action.next')}
        />
      ) : null}
    </View>
  );

  return shell(
    <View onLayout={onLayout} className={`flex-1 gap-3 ${landscape ? 'p-6' : 'p-4'}`}>
      {phase === 'browsing' || listLayout ? (
        <View className="gap-1">
          <Heading level={1} className={t.title} testID="m08-title">{eggCopy('m08.title')}</Heading>
          <Text className={`${t.body} text-text-muted`} testID="m08-caption">{eggCopy('m08.santoro.caption')}</Text>
          {santoroLine !== '' ? <Text className={`${t.body} text-text`} testID="m08-santoro-line">{santoroLine}</Text> : null}
        </View>
      ) : null}
      {listLayout ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-3">
          <ChoiceRows
            rows={views.map((v, i) => ({
              key: v.bloodlineId,
              label: tileItems[i]!.label,
              detail: v.bloodline,
              accessibilityLabel: tileItems[i]!.accessibilityLabel,
              media: <EggStill dexId={v.dexId} />,
            }))}
            value={focused}
            onChange={(i) => set(meetFocus(store.getState(), i))}
            accessibilityLabel={eggCopy('m08.title')}
            testID="m08-triptych"
            rowTestID={(row) => `m08-egg-${row.key}`}
          />
          {card}
          {actions}
        </ScrollView>
      ) : (
        <>
          <View className="flex-1" style={landscape ? { maxWidth: 3 * 300 + 2 * 12, width: '100%', alignSelf: 'center' } : undefined}>
            <ChoiceTriptych
              items={tileItems}
              focusedIndex={focused}
              onFocusChange={(i) => set(meetFocus(store.getState(), i))}
              accessibilityLabel={eggCopy('m08.title')}
              focusedOverlay={card}
              overlayPlacement={landscape ? 'trailing' : 'bottom'}
              holding={holding}
              reducedMotion={reducedMotion}
              testID="m08-triptych"
              itemTestID={(item) => `m08-egg-${item.key}`}
            />
          </View>
          {actions}
        </>
      )}
    </View>,
  );
}
