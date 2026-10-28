'use client';

import { Suspense, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { bloodlines, eggs } from '@acme/content';
import {
  Button,
  Card,
  ChoiceRows,
  ChoiceTriptych,
  createChoiceScreen,
  createStageReady,
  DeviceStage,
  ErrorMessage,
  Heading,
  HLynkFit,
  HLynkShell,
  SafeArea,
  StageReadyGate,
  StatusRow,
  Text,
  TrackpadActions,
  useInstanceStore,
  useIsHeadset,
  useReducedMotion,
  useStore,
  type ChoicePanel,
  type ChoiceTriptychItem,
  type DeviceKey,
  type FitStep,
  type HLynkFitContext,
  type ShellTrackpadProps,
  type StageReadyResource,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { View } from '@acme/ui/tw';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { copy as onboardingCopy } from '../onboarding/copy';
import { readConsentRequested } from '../onboarding/onboarding.store';
import { schemeForTime } from '../onboarding/time-scheme';
import { useTextRamp } from './use-text-ramp';
import { CompanionPane } from '../companion/CompanionPane';
import { CompanionStageHost, useTabletClass } from '../companion/CompanionStageHost';
import { eggCopy } from './copy';
import { EggStill } from './EggStill';
import { eggGlowTint, eggModelSource } from './egg-source';
import { StageControls, type StageControl } from './StageControls';
import { StageLoader } from './StageLoader';
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
import { isAccessibilityTextSize, isLandscapeWindow, meetFitBlocks, TRIPTYCH_LANDSCAPE_MAX_DP } from './window-layout';

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
  /**
   * The 3D H-Lynk stage: `starting` until its first frame with the eggs,
   * then `ready`; `failed` when no GPU backend starts (the 2D shell then).
   */
  readonly stage3d: 'starting' | 'ready' | 'failed';
  /** The stage's ready signal, for the Suspense gate over the Rive loader. */
  readonly stageReady: StageReadyResource;
}

/** The kit's convention for a model that does not exist yet (MonView, MonsModels3D, EggStill). */
const COMING_SOON = 'Coming Soon';

/** Glass button targets on M08's panel. */
type MeetAction = 'look' | 'choose' | 'confirm-yes' | 'confirm-no';

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
  const headset = useIsHeadset();

  const store = useInstanceStore<MeetStore>(() => ({
    ...MEET_INITIAL,
    holding: false,
    loaded: loadEggs(),
    scheme: schemeForTime(Date.now()),
    stage3d: 'starting',
    stageReady: createStageReady(),
  }));
  const { phase, focused, holding, loaded, scheme, stage3d, stageReady } = useStore(store);
  const tablet = useTabletClass();

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

  const titleText = eggCopy('m08.title');
  const captionText = eggCopy('m08.santoro.caption');

  const onStageReady = useCallback(() => {
    store.setState({ stage3d: 'ready' });
    store.getState().stageReady.settle();
  }, [store]);
  const onStageBackend = useCallback((backend: unknown) => {
    if (backend !== null) return;
    store.setState({ stage3d: 'failed' });
    store.getState().stageReady.settle();
  }, [store]);

  // The glass buttons and the 3D keys call the latest handlers through a store,
  // written after each commit (an effect) and read only from event paths, so
  // the screen object (and the scene built from it) stays stable.
  const handlers = useInstanceStore<{ action: (a: MeetAction) => void; key: (k: DeviceKey) => void }>(() => ({ action: () => undefined, key: () => undefined }));
  const onStageKey = useCallback((key: DeviceKey) => handlers.getState().key(key), [handlers]);

  // The egg choice on the 3D H-Lynk's glass: the same DeviceStage the
  // website's H-LYNK section shows, with this screen's store as the focus.
  // A tap on an egg (or its slot) focuses it exactly as a tile press does.
  const eggScreen = useMemo(
    () => createChoiceScreen({
      title: titleText,
      hint: captionText,
      comingSoon: COMING_SOON,
      items: ('views' in loaded ? loaded.views : []).map((v) => ({
        target: v.bloodlineId, label: v.eggName, detail: v.bloodline, source: eggModelSource(v), glow: eggGlowTint(v),
      })),
      focused: () => store.getState().focused,
      subscribe: (onChange) => store.subscribe((next, prev) => {
        if (next.focused !== prev.focused || next.phase !== prev.phase) onChange();
      }),
      onSelect: (i) => {
        haptics.selection();
        const next = meetFocus(store.getState(), i);
        store.setState({ phase: next.phase, focused: next.focused });
      },
      panel: () => meetPanel(store.getState(), 'views' in loaded ? loaded.views : [], captionText),
      onAction: (target) => handlers.getState().action(target as MeetAction),
    }),
    [loaded, store, titleText, captionText, handlers],
  );

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
  const askConfirm = () => {
    haptics.tap();
    set(meetAskConfirm(store.getState()));
  };
  /** The trackpad (and Enter on the glass): one step forward through browse → card → confirm → choose. */
  const activate = () => {
    const now = store.getState();
    const at = now.focused === null ? undefined : views[now.focused];
    if (now.phase === 'browsing' || at === undefined) lookCloser();
    else if (now.phase === 'approaching') askConfirm();
    else choose(at);
  };
  useEffect(() => {
    handlers.setState({
    action: (a) => {
      const at = egg;
      if (a === 'look') lookCloser();
      else if (a === 'choose') askConfirm();
      else if (a === 'confirm-yes' && at !== undefined) choose(at);
      else if (a === 'confirm-no') back();
    },
    key: (k) => {
      if (k === 'prev') step(-1);
      else if (k === 'next') step(1);
      else if (k === 'activate') activate();
      else if (k === 'menu') {
        // Menu: back to all three eggs.
        haptics.selection();
        set(MEET_INITIAL);
      } else back();
    },
    });
  });

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
      <View className="max-h-full gap-2 p-3">
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
      </View>
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

  const showHead = phase === 'browsing' || listLayout;
  const head = (type: FitStep) => (
    <View className="gap-1">
      <Heading level={1} className={type.title.className} testID="m08-title">{titleText}</Heading>
      <Text className={`${type.body.className} text-text-muted`} testID="m08-caption">{captionText}</Text>
      {santoroLine !== '' ? <Text className={`${type.body.className} text-text`} testID="m08-santoro-line">{santoroLine}</Text> : null}
    </View>
  );

  // The 3D stage runs unless motion is reduced, the GPU never started, or the
  // text size switched the choice to rows. While it loads, the kit's Rive
  // loader covers it (Suspense on the stage's ready signal); the photo tiles
  // never show on this path.
  const stageOn = !reducedMotion && !listLayout && stage3d !== 'failed' && views.length > 0;

  // The 3D H-Lynk REPLACES the 2D shell, and nothing 2D shows beside it: the
  // egg's card, its buttons and the confirm step are drawn on the glass, and
  // the 3D keys and trackpad drive it. The 2D shell below is only the
  // fallback: reduced motion, no GPU, large text (rows) or a load error.
  // Screen readers and keyboards get the triptych radio group and the
  // stage's actions as visually hidden controls.
  if (stageOn && !('error' in loaded)) {
    const controls: StageControl[] = [
      ...(phase === 'browsing'
        ? [{ key: 'look', label: eggCopy('m08.action.look'), onPress: lookCloser, testID: 'm08-look' }]
        : []),
      ...(phase === 'approaching' && egg !== undefined
        ? [
            { key: 'choose', label: eggCopy('m08.cta.choose', { eggName: egg.eggName }), onPress: askConfirm, testID: 'm08-choose' },
            { key: 'prev', label: eggCopy('m08.action.prev'), onPress: () => step(-1), testID: 'm08-prev' },
            { key: 'all', label: eggCopy('m08.action.all'), onPress: () => set(MEET_INITIAL), testID: 'm08-all' },
            { key: 'next', label: eggCopy('m08.action.next'), onPress: () => step(1), testID: 'm08-next' },
          ]
        : []),
      ...(phase === 'confirming' && egg !== undefined
        ? [
            { key: 'yes', label: eggCopy('m08.confirm.yes'), hint: eggCopy('m08.confirm.title', { eggName: egg.eggName }), onPress: () => choose(egg), testID: 'm08-confirm-yes' },
            { key: 'no', label: eggCopy('m08.confirm.no'), onPress: back, testID: 'm08-confirm-no' },
          ]
        : []),
      { key: 'back', label: eggCopy('m08.back.a11y.label'), onPress: back, testID: 'm08-back' },
    ];
    return (
      <View className="flex-1 bg-ink-950" testID="m08-3d">
        <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
          {/* Phones: the stage fills the screen. Tablets: the egg's facts beside or under the device. */}
          <CompanionStageHost
            enabled={tablet.companion}
            pane={<MeetPane egg={phase === 'browsing' ? undefined : egg} />}
            device={<>
            {/* Visually hidden from the first frame: the radio group screen readers and keyboards use. */}
            <View className="absolute inset-0 opacity-0" pointerEvents="none" testID="m08-triptych-a11y">
              <ChoiceTriptych
                // No photos behind the 3D stage, not even invisible ones: the radio group needs only the labels.
                items={tileItems.map((item) => ({ ...item, media: null }))}
                focusedIndex={focused}
                onFocusChange={(i) => set(meetFocus(store.getState(), i))}
                accessibilityLabel={titleText}
                focusedOverlay={null}
                overlayPlacement="bottom"
                holding={holding}
                reducedMotion={reducedMotion}
                testID="m08-triptych"
                itemTestID={(item) => `m08-egg-${item.key}`}
              />
            </View>
            <View
              testID="m08-device-stage"
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="absolute inset-0"
            >
              <DeviceStage
                screen={eggScreen}
                label={titleText}
                className="h-full"
                stageClassName="min-h-0 w-full flex-1"
                glassScale={tablet.glassScale}
                onKey={onStageKey}
                onReady={onStageReady}
                onBackendChange={onStageBackend}
              />
            </View>
            <Suspense fallback={<StageLoader label={titleText} testID="m08-stage-loader" />}>
              <StageReadyGate resource={stageReady} />
            </Suspense>
            <StageControls controls={controls} testID="m08-stage-controls" />
            </>}
          />
        </SafeArea>
      </View>
    );
  }

  // Decision H-3: nothing in the H-Lynk screen scrolls; HLynkFit steps the type
  // and spacing down until the step fits. The triptych is the flexible media.
  const fitBlocks = (ctx: HLynkFitContext) => meetFitBlocks({
    titleChars: titleText.length,
    captionChars: captionText.length,
    santoroChars: santoroLine.length,
    headInScreen: showHead,
    listLayout,
    cardShown: card !== null,
    confirming: phase === 'confirming',
    actionsShown: phase !== 'confirming',
    fontScale: ctx.fontScale,
  });

  return shell(
    <HLynkFit testID="m08-fit" ramp={headset ? 'xr' : 'mobile'} blocks={fitBlocks}>
      {(fit, ctx) => {
        const landscape = isLandscapeWindow(ctx.widthPt, ctx.heightPt);
        return (
          <View style={{ flexGrow: 1, gap: fit.type.gapPt }}>
            {showHead ? head(fit.type) : null}
            {listLayout ? (
              <View style={{ gap: fit.type.gapPt }}>
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
                  accessibilityLabel={titleText}
                  testID="m08-triptych"
                  rowTestID={(row) => `m08-egg-${row.key}`}
                />
                {card}
                {actions}
              </View>
            ) : (
              <>
                <View
                  // Portrait stacks the stage over the card, top-aligned; a landscape window from md puts them side by side.
                  className="justify-start gap-3 md:landscape:flex-row md:landscape:items-stretch"
                  style={{ flexGrow: 1, minHeight: fit.mediaPt, ...(landscape ? { maxWidth: TRIPTYCH_LANDSCAPE_MAX_DP, width: '100%', alignSelf: 'center' } : null) }}
                >
                  <View className="relative min-h-0 flex-1">
                    <ChoiceTriptych
                      items={tileItems}
                      focusedIndex={focused}
                      onFocusChange={(i) => set(meetFocus(store.getState(), i))}
                      accessibilityLabel={titleText}
                      focusedOverlay={card}
                      overlayPlacement={landscape ? 'trailing' : 'bottom'}
                      holding={holding}
                      reducedMotion={reducedMotion}
                      testID="m08-triptych"
                      itemTestID={(item) => `m08-egg-${item.key}`}
                    />
                  </View>
                </View>
                {actions}
              </>
            )}
          </View>
        );
      }}
    </HLynkFit>,
  );
}

/** What M08's glass shows under the eggs: the hint, the focused egg's card, or the confirm step. */
function meetPanel(state: MeetState, views: readonly EggView[], hint: string): ChoicePanel {
  const at = state.focused === null ? undefined : views[state.focused];
  if (state.phase === 'browsing' || at === undefined) {
    return { body: hint, actions: [{ target: 'look', label: eggCopy('m08.action.look'), tone: 'primary' }] };
  }
  if (state.phase === 'confirming') {
    return {
      heading: eggCopy('m08.confirm.title', { eggName: at.eggName }),
      body: eggCopy('m08.confirm.body'),
      actions: [
        { target: 'confirm-yes', label: eggCopy('m08.confirm.yes'), tone: 'primary' },
        { target: 'confirm-no', label: eggCopy('m08.confirm.no'), tone: 'secondary' },
      ],
    };
  }
  return {
    heading: at.eggName,
    meta: `${eggCopy('m08.card.number', { dexNumber: at.dexNumber })}  ${eggCopy('m08.card.bloodline', { bloodline: at.bloodline })}`,
    body: eggCopy('m08.card.body'),
    actions: [{ target: 'choose', label: eggCopy('m08.cta.choose', { eggName: at.eggName }), tone: 'primary' }],
  };
}

/**
 * M08's companion pane on tablets: the focused egg's name, number and
 * Bloodline, the only canon-settled facts before the hatch (08-handoff P3;
 * culture notes are not authored yet). Nothing focused: how to pick one.
 */
function MeetPane({ egg }: { egg: EggView | undefined }) {
  return (
    <CompanionPane
      title={egg?.eggName ?? eggCopy('pane.meet.title')}
      testID="m08-pane"
      empty={egg === undefined ? { title: eggCopy('pane.meet.empty.title'), description: eggCopy('pane.meet.empty.body') } : null}
    >
      {egg === undefined ? null : (
        <View className="gap-3" testID="m08-pane-facts">
          <View accessible accessibilityLabel={`${eggCopy('pane.meet.number')}, ${eggCopy('m08.card.number.a11y', { dexId: egg.dexId })}`} className="min-h-target justify-center gap-1 border-b border-border py-2">
            <Text className="text-xr-caption text-text-muted">{eggCopy('pane.meet.number')}</Text>
            <Text className="text-xr-body text-text" style={{ fontVariant: ['tabular-nums'] }}>{eggCopy('m08.card.number', { dexNumber: egg.dexNumber })}</Text>
          </View>
          <View accessible accessibilityLabel={`${eggCopy('pane.meet.bloodline')}, ${egg.bloodline}`} className="min-h-target justify-center gap-1 border-b border-border py-2">
            <Text className="text-xr-caption text-text-muted">{eggCopy('pane.meet.bloodline')}</Text>
            <Text className="text-xr-body text-text">{eggCopy('m08.card.bloodline', { bloodline: egg.bloodline })}</Text>
          </View>
          <Text className="text-xr-body text-text">{eggCopy('m08.card.body')}</Text>
          <Text className="text-xr-body text-text-muted">{eggCopy('m08.santoro.caption')}</Text>
        </View>
      )}
    </CompanionPane>
  );
}
