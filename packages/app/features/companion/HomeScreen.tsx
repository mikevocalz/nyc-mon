'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { MonInstance } from '@acme/core/types';
import {
  Button, CareMeterRing, CareMeterRingGroup, StatusRow, useHLynkStageWide, useInstanceStore, useReducedMotion, useStore,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { announcePolitely } from '../onboarding/announce';
import { careLed, useCareNow } from './care-shared';
import { companionCopy } from './copy';
import { NEED_RING, askRoute, homeStatus, isLow } from './home-model';
import { useHomeStage } from './home-stage.store';
import { useMinuteClock } from './minute-clock';

/**
 * M13 Home (Baby) at `/(home)`. Shows in two seconds whether the Mon is
 * asking for something, answers the ask with one trackpad tap or one
 * labelled button, and never implies loss: a low meter is a request. Home
 * never calls `applyCare`; Feed, Rest and Play route to M14–M16, which do.
 */
export function HomeScreen({ mon }: { mon: MonInstance }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const wide = useHLynkStageWide();
  const { care, identity, scheme: clockScheme } = useCareNow();
  const resumeCount = useMinuteClock((s) => s.resumeCount);
  const local = useInstanceStore(() => ({ reactionKey: 0 }));
  const { reactionKey } = useStore(local);

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

  const nameBlock = (
    <View testID="m13-name" className="gap-1">
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

  useHomeStage({
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
          {wide ? <View /> : nameBlock}
          {rings}
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
    leading: wide ? (
      <View className="gap-target-gap border-2 border-border bg-surface-raised p-4">
        {nameBlock}
        <View testID="m13-pane-dex">
          <Button variant="outline" size="lg" fullWidth title={companionCopy('m13.bar.dex')} onPress={() => router.push(dexHref)} className="min-h-target" />
        </View>
      </View>
    ) : undefined,
  });

  return null;
}
