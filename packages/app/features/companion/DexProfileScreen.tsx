'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { allSpecies, bloodlines } from '@acme/content';
import { LIFECYCLE_STAGES } from '@acme/core/schemas';
import type { EvolutionNode, MonInstance } from '@acme/core/types';
import {
  Button, HLYNK_COPY, Heading, Image, LifecycleTrack, SafeArea, SignagePlate, lifecycleSlots, useHLynkStageWide, type ImageProps,
} from '@acme/ui';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { useHomeStage } from './home-stage.store';
import { dexNumber, monIdentity } from './mon-identity';

/** Chain nodes from the Egg down to `speciesId`, or empty when the species is not in the chain. */
function pathTo(node: EvolutionNode, speciesId: string): readonly EvolutionNode[] {
  if (node.speciesId === speciesId) return [node];
  for (const child of node.evolvesTo) {
    const rest = pathTo(child, speciesId);
    if (rest.length > 0) return [node, ...rest];
  }
  return [];
}

/**
 * The life-stage slots for a Mon (D-15i): every reached form by name, the
 * current one last, then one unnamed slot per stage still ahead. A branching
 * stage counts once; no later stage is ever named here.
 */
function slotsFor(mon: MonInstance) {
  const species = allSpecies.find((s) => s.speciesId === mon.speciesId);
  const bloodline = species === undefined ? undefined : bloodlines.find((b) => b.bloodlineId === species.bloodlineId);
  const reached = bloodline === undefined ? [] : pathTo(bloodline.chain, mon.speciesId);
  const labels = reached.map((n) => n.formName).filter((n): n is string => n !== null);
  const later = LIFECYCLE_STAGES.length - 1 - LIFECYCLE_STAGES.indexOf(mon.stage);
  return lifecycleSlots(labels, later);
}

function BackButton() {
  const router = useRouter();
  return (
    <View testID="m17-back" className="self-start">
    <Pressable
      accessibilityLabel={companionCopy('m17.back.a11y')}
      onPress={() => router.back()}
      className="min-h-target min-w-target items-start justify-center self-start focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Text className="text-xr-label text-text">{`‹ ${companionCopy('m17.back.a11y')}`}</Text>
    </Pressable>
    </View>
  );
}

function Fact({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}, ${value}`} className="gap-1 border-b border-border py-3">
      <Text className="text-xr-caption text-text-muted">{label}</Text>
      <Text className="text-xr-body text-text">{value}</Text>
    </View>
  );
}

/**
 * M17 Dex entry for one of the Caller's Mons (Decision #18: any Mon, not
 * only the active one). Shell: none. Bond, likes and the culture note are not
 * rendered until Q26, Q24 and Q12/Q13 are answered, and photo mode stays
 * hidden until transparent capture exists (D-15i). Writes nothing.
 */
export function DexProfileScreen() {
  useHomeStage({});
  const router = useRouter();
  const wide = useHLynkStageWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mon = useMonStore((s) => s.save?.mons.find((m) => m.monInstanceId === id));
  const caller = useMonStore((s) => s.save?.caller);

  if (mon === undefined) {
    // M22's not-found recovery is not built; the honest route is home.
    return (
      <SafeArea className="flex-1 bg-bg">
        <View className="flex-1 gap-6 px-4 py-6">
          <BackButton />
          <View testID="m17-home"><Button title={HLYNK_COPY['hlynk.key.home.label']} variant="cta" size="lg" onPress={() => router.replace('/(home)')} /></View>
        </View>
      </SafeArea>
    );
  }

  const who = monIdentity(mon);
  const hatched = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(mon.hatchedAt));
  const portrait = who.art ? (
    <View testID="m17-portrait" className="w-full" style={{ aspectRatio: 4 / 5 }}>
      <Image src={who.art.source as ImageProps['src']} alt={who.art.alt} fill unoptimized className="h-full w-full" />
    </View>
  ) : (
    <View testID="m17-portrait" className="w-full bg-surface-raised" style={{ aspectRatio: 4 / 5 }} />
  );

  const text = (
    <View className="gap-6">
      <View className="gap-2">
        {who.dexId !== null ? (
          <View accessible accessibilityLabel={companionCopy('m17.dex.a11y', { dexSpoken: who.dexId })}>
            <SignagePlate testID="m17-dex" text={companionCopy('m17.dex', { dex: dexNumber(who.dexId) })} accessibilityLabel={companionCopy('m17.dex.a11y', { dexSpoken: who.dexId })} />
          </View>
        ) : null}
        {who.formName !== null ? (
          <SignagePlate testID="m17-form" text={who.formName} accessibilityLabel={who.formName} />
        ) : null}
        {who.bloodlineName !== null ? (
          <Text testID="m17-bloodline" className="text-xr-label text-text">
            {companionCopy('m17.bloodline', { bloodlineName: who.bloodlineName })}
          </Text>
        ) : null}
      </View>
      <LifecycleTrack
        testID="m17-life"
        slots={slotsFor(mon)}
        accessibilityLabel={companionCopy('m17.life.a11y')}
        stateWords={{ done: 'done', current: 'now', later: companionCopy('m17.life.later.a11y') }}
      />
      <View>
        <Fact testID="m17-fact-name" label={companionCopy('m17.fact.name')} value={who.name} />
        <Fact testID="m17-fact-hatched" label={companionCopy('m17.fact.hatched')} value={hatched} />
        {caller != null ? <Fact testID="m17-fact-caller" label={companionCopy('m17.fact.caller')} value={caller.callerName} /> : null}
      </View>
    </View>
  );

  return (
    <SafeArea className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-12 pt-2">
        <View className="mx-auto w-full max-w-content-screen gap-4">
          <BackButton />
          <Heading level={1} className="text-xr-title">{who.name}</Heading>
          {wide ? (
            <View className="flex-row gap-8">
              <View style={{ width: '41.6667%' }}>{portrait}</View>
              <View className="flex-1">{text}</View>
            </View>
          ) : (
            <View className="gap-4">
              {portrait}
              {text}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeArea>
  );
}
