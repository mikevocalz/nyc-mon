'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { eggHatchAssetForSpecies } from '@acme/assets/eggs';
import { bloodlines, eggs } from '@acme/content';
import {
  Button,
  Card,
  ChoiceRows,
  ChoiceTriptych,
  createChoiceScreen,
  DeviceStage,
  ErrorMessage,
  Heading,
  HLynkFit,
  HLynkShell,
  IconButton,
  SafeArea,
  StatusRow,
  Text,
  TrackpadActions,
  useInstanceStore,
  useIsHeadset,
  useReducedMotion,
  useStore,
  type ChoiceTriptychItem,
  type FitStep,
  type HLynkFitContext,
  type ShellTrackpadProps,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { ChevronLeft } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
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
   * The 3D H-Lynk stage: `starting` until its first frame, then `ready`;
   * `failed` when no GPU backend starts. Only `ready` covers the triptych.
   */
  readonly stage3d: 'starting' | 'ready' | 'failed';
}

/** The kit's convention for a model that does not exist yet (MonView, MonsModels3D, EggStill). */
const COMING_SOON = 'Coming Soon';

/** An egg's hatch GLB, if one is bundled for its species. */
function eggModel(view: EggView) {
  const speciesId = eggs.find((e) => e.bloodlineId === view.bloodlineId)?.speciesId;
  const asset = speciesId === undefined ? undefined : eggHatchAssetForSpecies(speciesId);
  return asset === undefined ? null : { eggId: asset.eggId, manifest: asset.manifest, glb: asset.glb };
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
  const headset = useIsHeadset();

  const store = useInstanceStore<MeetStore>(() => ({
    ...MEET_INITIAL,
    holding: false,
    loaded: loadEggs(),
    scheme: schemeForTime(Date.now()),
    stage3d: 'starting',
  }));
  const { phase, focused, holding, loaded, scheme, stage3d } = useStore(store);

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

  const onStageReady = useCallback(() => store.setState({ stage3d: 'ready' }), [store]);
  const onStageBackend = useCallback((backend: unknown) => {
    if (backend === null) store.setState({ stage3d: 'failed' });
  }, [store]);

  // The egg choice on the 3D H-Lynk's glass: the same DeviceStage the
  // website's H-LYNK section shows, with this screen's store as the focus.
  // A tap on an egg (or its slot) focuses it exactly as a tile press does.
  const eggScreen = useMemo(
    () => createChoiceScreen({
      title: titleText,
      hint: captionText,
      comingSoon: COMING_SOON,
      items: ('views' in loaded ? loaded.views : []).map((v) => ({
        target: v.bloodlineId, label: v.eggName, detail: v.bloodline, source: eggModel(v),
      })),
      focused: () => store.getState().focused,
      subscribe: (onChange) => store.subscribe((next, prev) => {
        if (next.focused !== prev.focused) onChange();
      }),
      onSelect: (i) => {
        haptics.selection();
        const next = meetFocus(store.getState(), i);
        store.setState({ phase: next.phase, focused: next.focused });
      },
    }),
    [loaded, store, titleText, captionText],
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
  // text size switched the choice to rows. Until its first frame the triptych
  // shows; after it, the stage covers the triptych and the card gets its own pane.
  const stageOn = !reducedMotion && !listLayout && stage3d !== 'failed' && views.length > 0;
  const stageCovers = stageOn && stage3d === 'ready';

  // The 3D H-Lynk REPLACES the 2D shell (it is the same device as the site's
  // DeviceStage, the eggs standing on its glass). The 2D shell below is only
  // the fallback: reduced motion, no GPU, large text (rows) or a load error.
  // The triptych stays mounted under the stage until its first frame, and
  // after it as the radio group screen readers use (hidden visually).
  if (stageOn && !('error' in loaded)) {
    return (
      <View className="flex-1 bg-bg" testID="m08-3d">
        <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
          <View className="flex-row items-center px-2 pt-1">
            <IconButton variant="ghost" tone="royal" aria-label={eggCopy('m08.back.a11y.label')} onPress={back} icon={<ChevronLeft size={26} />} />
          </View>
          {/* The title and Santoro's line are on the device's own screen, so they
              are not repeated here. Portrait: the device, then the card and
              actions. Landscape from md: the device left, card and actions right. */}
          <View className="flex-1 gap-4 px-4 pb-4 md:px-8 md:landscape:flex-row md:landscape:gap-10">
            <View className="relative min-h-0 flex-1">
              <View className="absolute inset-0" style={{ opacity: stageCovers ? 0 : 1 }} pointerEvents={stageCovers ? 'none' : 'auto'}>
                <ChoiceTriptych
                  items={tileItems}
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
                pointerEvents={stageCovers ? 'auto' : 'none'}
                className="absolute inset-0"
                style={{ opacity: stageCovers ? 1 : 0 }}
              >
                <DeviceStage
                  screen={eggScreen}
                  label={titleText}
                  className="h-full"
                  stageClassName="min-h-0 w-full flex-1"
                  onReady={onStageReady}
                  onBackendChange={onStageBackend}
                />
              </View>
            </View>
            <View className="gap-4 md:landscape:w-2/5 md:landscape:max-w-md md:landscape:justify-center">
              {card}
              {actions}
            </View>
          </View>
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
                  style={{ flexGrow: 1, minHeight: fit.mediaPt, ...(landscape && !stageCovers ? { maxWidth: TRIPTYCH_LANDSCAPE_MAX_DP, width: '100%', alignSelf: 'center' } : null) }}
                >
                  <View className="relative min-h-0 flex-1">
                    {/* The triptych stays mounted under the 3D stage: it is the radio group screen readers and keyboards use. */}
                    <ChoiceTriptych
                      items={tileItems}
                      focusedIndex={focused}
                      onFocusChange={(i) => set(meetFocus(store.getState(), i))}
                      accessibilityLabel={titleText}
                      focusedOverlay={stageCovers ? null : card}
                      overlayPlacement={landscape ? 'trailing' : 'bottom'}
                      holding={holding}
                      reducedMotion={reducedMotion}
                      testID="m08-triptych"
                      itemTestID={(item) => `m08-egg-${item.key}`}
                    />
                    {stageOn ? (
                      <View
                        testID="m08-device-stage"
                        aria-hidden
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        pointerEvents={stageCovers ? 'auto' : 'none'}
                        className="absolute inset-0"
                        // Computed: the stage covers the triptych only once its first frame is up.
                        style={{ opacity: stageCovers ? 1 : 0 }}
                      >
                        <DeviceStage
                          screen={eggScreen}
                          label={titleText}
                          className="h-full"
                          stageClassName="min-h-0 w-full flex-1"
                          onReady={onStageReady}
                          onBackendChange={onStageBackend}
                        />
                      </View>
                    ) : null}
                  </View>
                  {stageCovers && card !== null ? (
                    <View testID="m08-card-pane" className="md:landscape:w-2/5 md:landscape:max-w-sm md:landscape:justify-center">
                      {card}
                    </View>
                  ) : null}
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
