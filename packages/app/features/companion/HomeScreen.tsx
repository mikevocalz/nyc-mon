'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { MonInstance } from '@acme/core/types';
import {
  Button, CareMeterRing, CareMeterRingGroup, HLYNK_COPY, StatusRow, useInstanceStore, useReducedMotion, useStore,
  type DeviceKey, type GlassAction, type GlassView,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { announcePolitely } from '../onboarding/announce';
import { careLed, useCareNow } from './care-shared';
import { companionCopy } from './copy';
import { NEED_RING, askRoute, homeStatus, isLow } from './home-model';
import { GlassStage, glassRing, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { setHomeMenuOpen, useHomeStage, useHomeStageStore } from './home-stage.store';
import { useMinuteClock } from './minute-clock';

const NEEDS = ['energy', 'fullness', 'social'] as const;
/** The bar's four buttons in one row; the menu reuses the same row. */
const LAYOUT = { model: 'large', rings: true, lineRows: 0, actionRows: 1, perRow: 4 } as const;

/**
 * M13 Home (Baby) at `/(home)`. Shows in two seconds whether the Mon is
 * asking for something, answers the ask with one trackpad tap or one
 * labelled button, and never implies loss: a low meter is a request. Home
 * never calls `applyCare`; Feed, Rest and Play route to M14–M16, which do.
 */
export function HomeScreen({ mon }: { mon: MonInstance }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { care, identity, scheme: clockScheme } = useCareNow();
  const resumeCount = useMinuteClock((s) => s.resumeCount);
  const local = useInstanceStore(() => ({ reactionKey: 0, menu: false, failed: false }));
  const { reactionKey, menu, failed } = useStore(local);
  const glassOn = useGlassOn(failed);
  // The shell's H-LYNK tab asks for the device menu through the stage store.
  const menuRequested = useHomeStageStore((s) => s.menuOpen);
  useEffect(() => {
    if (!menuRequested || !glassOn) return;
    local.setState({ menu: true });
    setHomeMenuOpen(false);
  }, [menuRequested, glassOn, local]);

  const name = identity?.name ?? '';
  const status = care === undefined ? undefined : homeStatus(care);
  const asleep = care?.activity.kind === 'asleep';
  const scheme = asleep ? 'night' : clockScheme;

  // Background-resumed (≥ 60 s away): name the Mon and the state, never the time away.
  const lastResume = useRef(resumeCount);
  useEffect(() => {
    if (resumeCount === lastResume.current) return;
    lastResume.current = resumeCount;
    if (status) announcePolitely(companionCopy('m13.resumed.a11y', { name, status: status.text }));
  }, [resumeCount, status, name]);

  const sayHi = () => local.setState((st) => ({ reactionKey: st.reactionKey + 1 }));
  const answer = () => {
    const route = care === undefined ? undefined : askRoute(care);
    if (route === undefined) sayHi();
    else router.push(route);
  };
  const dexHref = `/(home)/mon/${mon.monInstanceId}` as const;

  const rings = care === undefined ? null : (
    <CareMeterRingGroup accessibilityLabel={companionCopy('m13.rings.a11y.label')} testID="m13-rings">
      {(['energy', 'fullness', 'social'] as const).map((need) => {
        const low = isLow(care[need]);
        return (
          <CareMeterRing
            key={need}
            testID={`m13-ring-${need}`}
            need={need}
            value={care[need]}
            label={companionCopy(NEED_RING[need])}
            low={low}
            lowLabel={companionCopy('m13.ring.low')}
            size="md"
            scheme={scheme}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </CareMeterRingGroup>
  );

  const nameBlock = (testID: string) => (
    <View testID={testID} className="gap-1">
      <Text className="text-xr-label text-signage-white">{name}</Text>
      {identity?.bloodlineLabel ? <Text className="text-xr-caption text-silver-300">{identity.bloodlineLabel}</Text> : null}
    </View>
  );

  const bar = (
    <View className="flex-row justify-between gap-target-gap">
      {([
        ['m13-bar-feed', 'm13.bar.feed', () => router.push('/(home)/feed')],
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
  const { model, monClips } = useMonGlass(identity?.dexId ?? null, care);
  const suggested = care === undefined ? undefined : askRoute(care);
  const formName = identity?.formName ?? '';
  const nicknamed = mon.nickname !== null;
  const subtitle = [nicknamed ? formName : '', identity?.bloodlineLabel ?? ''].filter((t) => t !== '').join(' · ');
  const tone = (route: string): GlassAction['tone'] => (route === suggested ? 'primary' : 'secondary');
  const actions: GlassAction[] = menu
    ? [
      { target: 'dex', label: companionCopy('m13.bar.dex'), tone: 'secondary' },
      { target: 'journal', label: companionCopy('m18.title'), tone: 'secondary' },
      { target: 'settings', label: companionCopy('m13.menu.settings'), tone: 'secondary' },
      { target: 'close', label: companionCopy('m14.close'), tone: 'primary' },
    ]
    : [
      { target: 'feed', label: companionCopy('m13.bar.feed'), tone: tone('/(home)/feed') },
      { target: 'rest', label: companionCopy(asleep ? 'm13.bar.wake' : 'm13.bar.rest'), tone: tone('/(home)/rest') },
      { target: 'play', label: companionCopy('m13.bar.play'), tone: tone('/(home)/social') },
      { target: 'dex', label: companionCopy('m13.bar.dex'), tone: 'secondary' },
    ];
  const view: GlassView = {
    status: status ? { text: status.text, tone: status.tone === 'request' ? 'request' : 'neutral' } : null,
    title: name,
    subtitle,
    rings: care === undefined ? [] : NEEDS.map((need) => glassRing(need, care[need])),
    lines: [],
    actions,
  };
  const go = (target: string) => {
    if (target === 'close') local.setState({ menu: false });
    else if (target === 'journal') {
      local.setState({ menu: false });
      router.push('/(home)/journal');
    } else if (target === 'settings') {
      local.setState({ menu: false });
      router.push('/(home)/settings');
    } else if (target === 'dex') {
      local.setState({ menu: false });
      router.push(dexHref);
    } else if (target === 'feed') router.push('/(home)/feed');
    else if (target === 'rest') router.push('/(home)/rest');
    else if (target === 'play') router.push('/(home)/social');
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view, nudge: reactionKey });
  useEffect(() => {
    glass.bind({ onAction: go, onModel: sayHi, monClips });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'activate') answer();
    else if (key === 'menu') local.setState({ menu: !local.getState().menu });
    else if (key === 'back') {
      if (local.getState().menu) local.setState({ menu: false });
      else router.back();
    }
  };
  const onFailed = useCallback(() => local.setState({ failed: true }), [local]);

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: careLed(care),
      scheme,
      testIDPrefix: 'm13',
      creature: true,
      framing: 'home',
      reaction: { kind: 'lift', key: reactionKey },
      trackpad: {
        label: companionCopy('m13.trackpad.label', { name }),
        hint: companionCopy(status?.hint ?? 'm13.trackpad.hint.idle', { name }),
        onActivate: answer,
        // Room pan lands with the renderer's camera; the 2D still has no room to pan yet.
        onPan: () => undefined,
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
          <View className="md:hidden">{nameBlock('m13-name')}</View>
          <View className="ml-auto">{rings}</View>
        </View>
        <View testID="m13-mon" className="flex-1">
          <Pressable
            role="button"
            accessibilityLabel={monLabel}
            aria-label={monLabel}
            accessibilityHint={companionCopy('m13.mon.a11y.hint')}
            onPress={sayHi}
            className="flex-1"
          />
        </View>
        <View className="px-4 pb-4">{bar}</View>
      </View>
    ),
    // The companion pane from md (HLynkStage): name card and the Dex link,
    // side by side in tablet portrait, stacked beside the device in landscape.
    leading: (
      <View className="gap-target-gap border-2 border-border bg-scrim-scene p-4 md:portrait:flex-row md:portrait:items-center">
        <View className="md:portrait:flex-1">{nameBlock('m13-pane-name')}</View>
        <View testID="m13-pane-dex" className="md:portrait:flex-1">
          <Button variant="outline" size="lg" fullWidth title={companionCopy('m13.bar.dex')} onPress={() => router.push(dexHref)} className="min-h-target" />
        </View>
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
      onFailed={onFailed}
      a11y={
        <>
          <Text testID="m13-name" accessibilityRole="header">{name}</Text>
          {subtitle !== '' ? <Text>{subtitle}</Text> : null}
          {status ? <Text testID="m13-status">{status.text}</Text> : null}
          {care === undefined ? null : (
            <View testID="m13-rings" accessibilityLabel={companionCopy('m13.rings.a11y.label')}>
              {NEEDS.map((need) => (
                <Text key={need} testID={`m13-ring-${need}`}>
                  {`${companionCopy(NEED_RING[need])} ${Math.round(care[need] * 100)}%${isLow(care[need]) ? `, ${companionCopy('m13.ring.low')}` : ''}`}
                </Text>
              ))}
            </View>
          )}
        </>
      }
      controls={[
        { key: 'mon', label: monLabel, hint: companionCopy('m13.mon.a11y.hint'), onPress: sayHi, testID: 'm13-mon' },
        ...actions.map((a) => ({
          key: a.target,
          label: a.label,
          onPress: () => go(a.target),
          testID: a.target === 'close' ? 'm13-menu-close' : a.target === 'journal' ? 'home-menu-journal' : `m13-bar-${a.target}`,
        })),
        { key: 'menu', label: HLYNK_COPY['hlynk.key.menu.label'], onPress: () => onKey('menu'), testID: 'm13-menu' },
      ]}
    />
  );
}
