'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { deriveMonMood, heartsFor } from '@acme/core/sim';
import type { MonInstance } from '@acme/core/types';
import {
  Badge, Button, EmptyState, HeartRow, HLYNK_COPY, SegmentedControl, SheetSurface, StatusRow, useInstanceStore,
  useStore, type DeviceKey, type GlassAction, type GlassView,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { announcePolitely } from '../onboarding/announce';
import { selectActiveMon, useMonStore } from '../mon/mon.store';
import {
  CHOOSE_CLOSE, CHOOSE_MORE, canChooseMon, chooserActions, chooserOptions, chosenFromTarget, closeMonChooser, nextChooserPage,
  openMonChooser, shouldAskOnOpen, useActiveMonChoice, type ChooserOption,
} from './active-mon-choice';
import { careLed, useCareNow } from './care-shared';
import { companionCopy } from './copy';
import { NEED_RING, askRoute, homeReaction, homeStatus, isLow, panRoom } from './home-model';
import { GlassStage, glassRing, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { setHomeMenuOpen, useHomeStage, useHomeStageStore } from './home-stage.store';
import { useMinuteClock } from './minute-clock';
import { monIdentity } from './mon-identity';
import { CompanionPane } from './CompanionPane';
import { JournalRows, PaneSection, useActiveJournal } from './pane-content';
import { MonCaption } from '../voice/MonCaption';
import { useMonVoice } from '../voice/use-mon-voice';

const NEEDS = ['energy', 'fullness', 'social'] as const;
/** M32 Mon Space: the care loop's home from Home (canon v12). */
const MON_SPACE = '/(home)/mon-space' as const;
/** How many journal moments the Home pane lists before pointing to the Journal. */
const RECENT = 5;
/** The bar's four buttons in one row; the menu and the chooser reuse the same row. */
const LAYOUT = { model: 'large', rings: true, lineRows: 0, actionRows: 1, perRow: 4 } as const;
const NO_MONS: readonly MonInstance[] = [];

/** Each chooser action's hidden-control testID. */
function chooserTestID(target: string): string {
  if (target === CHOOSE_CLOSE) return 'm13-choose-close';
  if (target === CHOOSE_MORE) return 'm13-choose-more';
  return `m13-choose-${chosenFromTarget(target) ?? target}`;
}

/**
 * M13 Home (Baby) at `/(home)`. Shows in two seconds whether the Mon is
 * asking for something, answers the ask with one trackpad tap or one
 * labelled button, and never implies loss: a low meter is a request. Home
 * never calls `applyCare`; Feed, Rest and Play route to M14–M16, which do.
 * With more than one Mon (Decision #18) it asks once per session which one
 * is with the Caller, and the Menu key (glass), the Switch button (2D) and
 * the companion pane (tablet) switch it any time.
 */
export function HomeScreen({ mon }: { mon: MonInstance }) {
  const router = useRouter();
  const { care, identity, nowMs, scheme: clockScheme } = useCareNow();
  const resumeCount = useMinuteClock((s) => s.resumeCount);
  const local = useInstanceStore(() => ({
    /** Taps that wobble the Baby (glass nudge) or lift the 2D still. */
    reactionKey: 0,
    /** A one-shot clip on the glass Baby (attention / approach). */
    clip: { key: 0, clips: [] as readonly string[] },
    /** Room pan, share of the glass width (home-model panRoom). */
    pan: 0,
    menu: false,
    failed: false,
  }));
  const { reactionKey, clip, pan, menu, failed } = useStore(local);
  const glassOn = useGlassOn(failed);
  // The shell's H-LYNK tab asks for the device menu with a counter, so a
  // route change's cleanup can't erase the request. A request made before
  // this screen mounted still counts; one is answered once.
  const menuRequest = useHomeStageStore((s) => s.menuRequest);
  const answered = useRef(0);
  useEffect(() => {
    if (menuRequest === answered.current) return;
    answered.current = menuRequest;
    if (glassOn) local.setState({ menu: true });
    else setHomeMenuOpen(true);
  }, [menuRequest, glassOn, local]);

  const name = identity?.name ?? '';
  const status = care === undefined ? undefined : homeStatus(care);
  const asleep = care?.activity.kind === 'asleep';
  const scheme = asleep ? 'night' : clockScheme;
  const dexId = identity?.dexId ?? null;
  // The Mon's voice (canon lines only); its caption takes the glass subtitle while it shows.
  const voice = useMonVoice(mon, care === undefined ? undefined : deriveMonMood(care));
  /** A line for a tap or a return, unless the Mon is asleep: asking for food gets "hungry". */
  const speak = (askingForFood: boolean) => {
    if (asleep) return;
    voice.sayLine(askingForFood ? 'hungry' : 'hello');
  };

  // ---- Decision #18: which Mon is with the Caller ----
  const mons = useMonStore((s) => s.save?.mons) ?? NO_MONS;
  const choosable = canChooseMon(mons.length);
  const choice = useActiveMonChoice();
  const choosing = choosable && choice.open;
  const options: ChooserOption[] = choosable ? chooserOptions(mons, (m) => monIdentity(m).name) : [];
  useEffect(() => {
    if (shouldAskOnOpen(mons.length, useActiveMonChoice.getState().answered) && !useActiveMonChoice.getState().open) openMonChooser();
  }, [mons.length]);
  const chooseMon = (id: string) => {
    if (id !== mon.monInstanceId) {
      useMonStore.getState().setActiveMon(id);
      const next = useMonStore.getState();
      const picked = selectActiveMon(next);
      if (picked) announcePolitely(companionCopy('m13.choose.done', { name: monIdentity(picked).name }));
    }
    closeMonChooser();
  };

  // Background-resumed (≥ 60 s away): name the Mon and the state, never the time away; the Baby comes to the glass.
  const lastResume = useRef(resumeCount);
  useEffect(() => {
    if (resumeCount === lastResume.current) return;
    lastResume.current = resumeCount;
    if (status) announcePolitely(companionCopy('m13.resumed.a11y', { name, status: status.text }));
    const r = homeReaction(dexId, care, 'resume', nowMs);
    if (r.kind === 'clip') local.setState((st) => ({ clip: { key: st.clip.key + 1, clips: r.clips } }));
    speak(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `speak` reads this render's Mon; the resume count is the trigger
  }, [resumeCount, status, name, dexId, care, nowMs, local]);

  // The status chip is a polite live region: announced when its words change, never on the minute tick.
  const statusText = status?.text;
  const lastStatus = useRef(statusText);
  useEffect(() => {
    if (statusText === lastStatus.current) return;
    const had = lastStatus.current !== undefined;
    lastStatus.current = statusText;
    if (had && statusText !== undefined) announcePolitely(statusText);
  }, [statusText]);

  // Tap the Baby: `attention` where its GLB has a clip for it, else the existing nudge (2D: the lift).
  const sayHi = () => {
    const r = homeReaction(dexId, care, 'tap', nowMs);
    if (glassOn && r.kind === 'clip') local.setState((st) => ({ clip: { key: st.clip.key + 1, clips: r.clips } }));
    else local.setState((st) => ({ reactionKey: st.reactionKey + 1 }));
    speak(care !== undefined && askRoute(care) === '/(home)/feed');
  };
  /** The trackpad answers the ask in Mon Space (M32), which holds the whole care loop; with nothing asked it says hi. */
  const answer = () => {
    const route = care === undefined ? undefined : askRoute(care);
    if (route === undefined) sayHi();
    else router.push(MON_SPACE);
  };
  const onPan = useCallback((dx: number) => local.setState((st) => ({ pan: panRoom(st.pan, dx) })), [local]);
  const dexHref = `/(home)/mon/${mon.monInstanceId}` as const;

  // Four hearts per meter (M32 D20a): one tint, no number, no red.
  const rings = care === undefined ? null : (
    <View testID="m13-rings" accessibilityLabel={companionCopy('m13.rings.a11y.label')} className="gap-1">
      {NEEDS.map((need) => {
        const low = isLow(care[need]);
        const hearts = heartsFor(care[need]);
        const meter = companionCopy(NEED_RING[need]);
        return (
          <HeartRow
            key={need}
            testID={`m13-ring-${need}`}
            filled={hearts}
            label={low ? `${meter} · ${companionCopy('m13.ring.low')}` : meter}
            accessibilityLabel={`${meter}, ${companionCopy('monspace.a11y.hearts', { count: hearts })}${low ? `, ${companionCopy('m13.ring.low')}` : ''}`}
            scheme={scheme}
            labelClassName="text-type-caption text-text"
          />
        );
      })}
    </View>
  );

  const nameBlock = (testID: string) => (
    <View testID={testID} className="gap-1">
      <Text className="text-xr-label text-signage-white">{name}</Text>
      {identity?.bloodlineLabel ? <Text className="text-xr-caption text-silver-300">{identity.bloodlineLabel}</Text> : null}
    </View>
  );

  /** The chooser as a segmented control (2D sheet and tablet pane share it). */
  const chooserControl = (
    <SegmentedControl
      options={options}
      value={mon.monInstanceId}
      onChange={chooseMon}
      tone="royal"
      aria-label={companionCopy('m13.choose.title')}
      segmentClassName="min-h-target"
    />
  );

  const bar = (
    <View className="flex-row justify-between gap-target-gap">
      {([
        ['m13-bar-space', 'monspace.title', () => router.push(MON_SPACE)],
        ['m13-bar-rest', asleep ? 'm13.bar.wake' : 'm13.bar.rest', () => router.push('/(home)/rest')],
        ['m13-bar-play', 'm13.bar.play', () => router.push('/(home)/social')],
        ['m13-bar-dex', 'm13.bar.dex', () => router.push(dexHref)],
      ] as const).map(([testID, label, onPress]) => (
        <View key={testID} testID={testID} className="flex-1">
          <Button variant="hlynk-care" size="lg" fullWidth title={companionCopy(label)} onPress={onPress} className="min-h-target" />
        </View>
      ))}
    </View>
  );

  const monLabel = status
    ? companionCopy('m13.mon.a11y', { name, bloodline: identity?.bloodlineLabel ?? '', status: status.text })
    : name;

  // ---- the 3D H-Lynk: the Baby on the glass, the rings and the bar drawn there (MonView's card) ----
  const { model, monClips } = useMonGlass(dexId, care);
  const suggested = care === undefined ? undefined : askRoute(care);
  const formName = identity?.formName ?? '';
  const nicknamed = mon.nickname !== null;
  const subtitle = [nicknamed ? formName : '', identity?.bloodlineLabel ?? ''].filter((t) => t !== '').join(' · ');
  const tone = (route: string): GlassAction['tone'] => (route === suggested ? 'primary' : 'secondary');
  // With two or more Mons the menu's first slot switches the Mon; Dex stays one tap away on the bar.
  const menuActions: GlassAction[] = [
    choosable
      ? { target: 'switch', label: companionCopy('m13.menu.switch'), tone: 'secondary' }
      : { target: 'dex', label: companionCopy('m13.bar.dex'), tone: 'secondary' },
    { target: 'journal', label: companionCopy('m18.title'), tone: 'secondary' },
    { target: 'settings', label: companionCopy('m13.menu.settings'), tone: 'secondary' },
    { target: 'close', label: companionCopy('m14.close'), tone: 'primary' },
  ];
  const actions: GlassAction[] = choosing
    ? chooserActions(options, mon.monInstanceId, choice.page)
    : menu
      ? menuActions
      : [
        { target: 'space', label: companionCopy('monspace.title'), tone: suggested !== undefined ? 'primary' : 'secondary' },
        { target: 'rest', label: companionCopy(asleep ? 'm13.bar.wake' : 'm13.bar.rest'), tone: tone('/(home)/rest') },
        { target: 'play', label: companionCopy('m13.bar.play'), tone: tone('/(home)/social') },
        { target: 'dex', label: companionCopy('m13.bar.dex'), tone: 'secondary' },
      ];
  const view: GlassView = choosing
    ? { status: null, title: companionCopy('m13.choose.title'), subtitle: companionCopy('m13.choose.body'), rings: [], lines: [], actions }
    : {
      status: status ? { text: status.text, tone: status.tone === 'request' ? 'request' : 'neutral' } : null,
      title: name,
      subtitle: voice.caption ?? subtitle,
      rings: care === undefined ? [] : NEEDS.map((need) => glassRing(need, care[need])),
      lines: [],
      actions,
    };
  const go = (target: string) => {
    if (useActiveMonChoice.getState().open && choosable) {
      const id = chosenFromTarget(target);
      if (id !== null) chooseMon(id);
      else if (target === CHOOSE_MORE) nextChooserPage(mons.length);
      else if (target === CHOOSE_CLOSE) closeMonChooser();
      return;
    }
    if (target === 'close') local.setState({ menu: false });
    else if (target === 'switch') {
      local.setState({ menu: false });
      openMonChooser();
    } else if (target === 'journal') {
      local.setState({ menu: false });
      router.push('/(home)/journal');
    } else if (target === 'settings') {
      local.setState({ menu: false });
      router.push('/(home)/settings');
    } else if (target === 'dex') {
      local.setState({ menu: false });
      router.push(dexHref);
    } else if (target === 'space') router.push(MON_SPACE);
    else if (target === 'feed') router.push('/(home)/feed');
    else if (target === 'rest') router.push('/(home)/rest');
    else if (target === 'play') router.push('/(home)/social');
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view, nudge: reactionKey, reaction: clip, modelOffset: pan, padPans: true });
  useEffect(() => {
    glass.bind({ onAction: go, onModel: sayHi, monClips });
  });
  const onKey = (key: DeviceKey) => {
    // The chooser is answered by any of these: the active Mon stays as it is.
    if (useActiveMonChoice.getState().open && choosable && (key === 'activate' || key === 'back' || key === 'menu')) {
      closeMonChooser();
      return;
    }
    if (key === 'activate') answer();
    else if (key === 'menu') local.setState({ menu: !local.getState().menu });
    else if (key === 'back') {
      if (local.getState().menu) local.setState({ menu: false });
      else router.back();
    }
  };
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  // ---- the companion pane (tablet / open foldable): the chooser, care summary, then recent moments ----
  const journal = useActiveJournal();
  const recent = journal.entries.slice(0, RECENT);
  const companion = (
    <CompanionPane
      title={companionCopy('pane.home.title', { name })}
      testID="m13-pane"
      loading={care === undefined}
    >
      {choosable ? (
        <View className="gap-2" testID="m13-pane-choose">
          <PaneSection title={companionCopy('m13.choose.title')} />
          {chooserControl}
        </View>
      ) : null}
      <View className="gap-2" testID="m13-pane-care">
        <PaneSection title={companionCopy('pane.home.care', { name })} />
        {status ? <Text className="text-xr-body text-text" testID="m13-pane-status">{status.text}</Text> : null}
        {care === undefined ? null : NEEDS.map((need) => {
          const meter = companionCopy(NEED_RING[need]);
          const hearts = heartsFor(care[need]);
          const low = isLow(care[need]);
          return (
            <View key={need} className="min-h-target flex-row items-center justify-between border-b border-border py-2">
              <HeartRow
                filled={hearts}
                label={meter}
                accessibilityLabel={`${meter}, ${companionCopy('monspace.a11y.hearts', { count: hearts })}${low ? `, ${companionCopy('m13.ring.low')}` : ''}`}
                labelClassName="text-xr-body text-text"
                cell={4}
              />
              {low ? <Badge label={companionCopy('m13.ring.low')} size="sm" tone="accent" /> : null}
            </View>
          );
        })}
      </View>
      <View className="gap-2" testID="m13-pane-recent">
        <PaneSection title={companionCopy('pane.home.recent')} />
        {recent.length === 0 ? (
          <EmptyState
            title={companionCopy('pane.home.recent.empty.title')}
            description={companionCopy('pane.home.recent.empty.body', { name })}
          />
        ) : (
          <JournalRows entries={recent} name={journal.name} testID="m13-pane-entry" />
        )}
        <View testID="m13-pane-journal">
          <Button variant="outline" size="lg" fullWidth title={companionCopy('pane.home.journal')} onPress={() => router.push('/(home)/journal')} className="min-h-target" />
        </View>
      </View>
    </CompanionPane>
  );

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: careLed(care),
      scheme,
      testIDPrefix: 'm13',
      creature: true,
      framing: 'home',
      reaction: { kind: 'lift', key: reactionKey },
      // No onPan on the 2D fallback: its still is drawn by the layout's creature layer, which has no
      // room or offset to pan. The 3D glass pans (GlassStage onPan).
      trackpad: {
        label: companionCopy('m13.trackpad.label', { name }),
        hint: companionCopy(status?.hint ?? 'm13.trackpad.hint.idle', { name }),
        onActivate: answer,
      },
      keys: { home: { disabled: true }, forward: { disabled: true } },
      statusRow: status ? (
        <View testID="m13-status">
          <StatusRow items={[{ id: 'm13-status', label: status.text, tone: status.tone }]} />
        </View>
      ) : undefined,
    },
    screen: (
      <View className="flex-1 justify-between">
        <View className="flex-row items-start justify-between gap-3 bg-scrim-scene p-4">
          {/* From md the name moves to the stage's companion pane; the rings stay on the device. */}
          <View className="gap-2 md:hidden">
            {nameBlock('m13-name')}
            {choosable ? (
              <View testID="m13-switch">
                <Button variant="outline" size="sm" title={companionCopy('m13.menu.switch')} onPress={openMonChooser} className="min-h-target" />
              </View>
            ) : null}
          </View>
          <View className="ml-auto">{rings}</View>
        </View>
        <View testID="m13-mon" className="flex-1">
          <MonCaption testID="m13-mon-caption" className="px-4 pt-2 text-center" />
          <Pressable
            role="button"
            accessibilityLabel={monLabel}
            aria-label={monLabel}
            accessibilityHint={companionCopy('m13.mon.a11y.hint')}
            onPress={sayHi}
            className="flex-1"
          />
        </View>
        {choosing ? (
          <View className="absolute inset-x-0 bottom-0">
            <SheetSurface
              placement="in-screen"
              scheme="night"
              title={companionCopy('m13.choose.title')}
              onClose={closeMonChooser}
              closeLabel={companionCopy('m14.close')}
              testID="m13-choose"
            >
              <View className="gap-target-gap">
                <Text className="text-xr-caption text-silver-300">{companionCopy('m13.choose.body')}</Text>
                {chooserControl}
              </View>
            </SheetSurface>
          </View>
        ) : (
          <View className="px-4 pb-4">{bar}</View>
        )}
      </View>
    ),
    // The companion pane from md (HLynkStage): name card, the Dex link and the chooser,
    // side by side in tablet portrait, stacked beside the device in landscape.
    leading: (
      <View className="gap-target-gap border-2 border-border bg-scrim-scene p-4 md:portrait:flex-row md:portrait:items-center">
        <View className="md:portrait:flex-1">{nameBlock('m13-pane-name')}</View>
        <View testID="m13-pane-dex" className="md:portrait:flex-1">
          <Button variant="outline" size="lg" fullWidth title={companionCopy('m13.bar.dex')} onPress={() => router.push(dexHref)} className="min-h-target" />
        </View>
        {choosable ? <View testID="m13-pane-choose" className="md:portrait:flex-1">{chooserControl}</View> : null}
      </View>
    ),
  });

  if (!glassOn) return null;

  return (
    <GlassStage
      screen={glass.screen}
      label={monLabel}
      testIDPrefix="m13"
      onKey={onKey}
      onPan={onPan}
      onFailed={onFailed}
      companion={companion}
      a11y={
        choosing ? (
          <View testID="m13-choose">
            <Text accessibilityRole="header">{companionCopy('m13.choose.title')}</Text>
            <Text>{companionCopy('m13.choose.body')}</Text>
          </View>
        ) : (
          <>
            <Text testID="m13-name" accessibilityRole="header">{name}</Text>
            {subtitle !== '' ? <Text>{subtitle}</Text> : null}
            {status ? <Text testID="m13-status">{status.text}</Text> : null}
            {care === undefined ? null : (
              <View testID="m13-rings" accessibilityLabel={companionCopy('m13.rings.a11y.label')}>
                {NEEDS.map((need) => (
                  <Text key={need} testID={`m13-ring-${need}`}>
                    {`${companionCopy(NEED_RING[need])}, ${companionCopy('monspace.a11y.hearts', { count: heartsFor(care[need]) })}${isLow(care[need]) ? `, ${companionCopy('m13.ring.low')}` : ''}`}
                  </Text>
                ))}
              </View>
            )}
          </>
        )
      }
      controls={[
        ...(choosing ? [] : [{ key: 'mon', label: monLabel, hint: companionCopy('m13.mon.a11y.hint'), onPress: sayHi, testID: 'm13-mon' }]),
        ...actions.map((a) => ({
          key: a.target,
          label: a.tone === 'selected' ? `${a.label}, ${companionCopy('m13.choose.selected')}` : a.label,
          onPress: () => go(a.target),
          testID: choosing
            ? chooserTestID(a.target)
            : a.target === 'space' ? 'm13-bar-space' : a.target === 'close' ? 'm13-menu-close' : a.target === 'journal' ? 'home-menu-journal' : a.target === 'switch' ? 'm13-menu-switch' : `m13-bar-${a.target}`,
        })),
        { key: 'menu', label: HLYNK_COPY['hlynk.key.menu.label'], onPress: () => onKey('menu'), testID: 'm13-menu' },
      ]}
    />
  );
}
