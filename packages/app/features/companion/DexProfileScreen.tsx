'use client';

import { useCallback, useEffect } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { allSpecies, bloodlines } from '@acme/content';
import { LIFECYCLE_STAGES } from '@acme/core/schemas';
import type { EvolutionNode, MonInstance } from '@acme/core/types';
import {
  BackButton, HLYNK_COPY, Heading, Image, LifecycleTrack, SafeArea, SignagePlate, lifecycleSlots, useInstanceStore, useStore,
  type DeviceKey, type GlassLine, type GlassView, type ImageProps,
} from '@acme/ui';
import { ScrollView, Text, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { GlassStage, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { useHomeStage } from './home-stage.store';
import { CompanionPane } from './CompanionPane';
import { dexNumber, monIdentity } from './mon-identity';
import { recoveryHref } from '../system/recovery-model';

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

/** The Baby, then the Dex facts as lines, then Back. */
const LAYOUT = { model: 'medium', rings: false, lineRows: 7, actionRows: 1, perRow: 1 } as const;

/** The kit's back tile, top left under the safe area: the same place on every screen. */
function Back() {
  const router = useRouter();
  return (
    <View testID="m17-back" className="flex-row px-4 pt-4">
      <BackButton label={companionCopy('m17.back.a11y')} onPress={() => router.back()} />
    </View>
  );
}

function Fact({ label, value, testID }: { label: string; value: string; testID: string }) {
  // Tablet portrait sets the facts two to a row (md:portrait:w-1/2 on the set's grid below).
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}, ${value}`} className="gap-1 border-b border-border py-3 md:portrait:w-1/2 md:portrait:pr-6">
      <Text className="text-xr-caption text-text-muted">{label}</Text>
      <Text className="text-xr-body text-text">{value}</Text>
    </View>
  );
}

/**
 * The Dex facts for one Mon: number, form, Bloodline, life stages, then name,
 * hatch date and Caller. The 2D entry shows them under the portrait; on the
 * 3D H-Lynk they are the companion pane on tablet-class windows.
 */
function DexFacts({ mon, callerName }: { mon: MonInstance; callerName: string | null }) {
  const who = monIdentity(mon);
  const hatched = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(mon.hatchedAt));
  return (
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
      <View className="md:portrait:flex-row md:portrait:flex-wrap">
        <Fact testID="m17-fact-name" label={companionCopy('m17.fact.name')} value={who.name} />
        <Fact testID="m17-fact-hatched" label={companionCopy('m17.fact.hatched')} value={hatched} />
        {callerName !== null ? <Fact testID="m17-fact-caller" label={companionCopy('m17.fact.caller')} value={callerName} /> : null}
      </View>
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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mon = useMonStore((s) => s.save?.mons.find((m) => m.monInstanceId === id));
  const caller = useMonStore((s) => s.save?.caller);

  // ---- the 3D H-Lynk: this Mon as its 3D model on the glass, the Dex facts drawn under it ----
  const ui = useInstanceStore(() => ({ failed: false, nudge: 0 }));
  const { failed, nudge } = useStore(ui);
  const glassOn = useGlassOn(failed) && mon !== undefined;
  const who0 = mon === undefined ? undefined : monIdentity(mon);
  const { model, monClips } = useMonGlass(who0?.dexId ?? null, undefined);
  const lines: GlassLine[] = [];
  if (mon !== undefined && who0 !== undefined) {
    if (who0.bloodlineName !== null) lines.push({ text: companionCopy('m17.bloodline', { bloodlineName: who0.bloodlineName }), tone: 'dim' });
    lines.push({
      text: slotsFor(mon).map((slot) => (slot.state === 'later' ? '?' : slot.state === 'current' ? `[${slot.label}]` : slot.label)).join('  ›  '),
      tone: 'amber',
    });
    lines.push({ text: `${companionCopy('m17.fact.name')}: ${who0.name}`, align: 'left' });
    lines.push({
      text: `${companionCopy('m17.fact.hatched')}: ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(mon.hatchedAt))}`,
      align: 'left',
    });
    if (caller != null) lines.push({ text: `${companionCopy('m17.fact.caller')}: ${caller.callerName}`, align: 'left' });
  }
  const view: GlassView = {
    status: who0?.dexId != null ? { text: companionCopy('m17.dex', { dex: dexNumber(who0.dexId) }), tone: 'neutral' } : null,
    title: who0?.name ?? '',
    subtitle: who0?.formName ?? '',
    rings: [],
    lines,
    actions: [{ target: 'back', label: companionCopy('m17.back.a11y'), tone: 'secondary' }],
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view, nudge });
  useEffect(() => {
    glass.bind({ monClips, onAction: () => router.back(), onModel: () => ui.setState({ nudge: ui.getState().nudge + 1 }) });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'back') router.back();
    else if (key === 'home') router.replace('/(home)');
  };
  const onFailed = useCallback(() => ui.setState({ failed: true }), [ui]);
  useHomeStage(glassOn ? {} : {});

  if (glassOn && who0 !== undefined && mon !== undefined) {
    return (
      <GlassStage
        screen={glass.screen}
        label={who0.name}
        testIDPrefix="m17"
        onKey={onKey}
        onFailed={onFailed}
        companion={
          <CompanionPane title={companionCopy('pane.dex.title', { name: who0.name })} testID="m17-pane">
            <DexFacts mon={mon} callerName={caller?.callerName ?? null} />
          </CompanionPane>
        }
        a11y={
          <>
            <Text accessibilityRole="header">{who0.name}</Text>
            {who0.dexId !== null ? <Text testID="m17-dex">{companionCopy('m17.dex.a11y', { dexSpoken: who0.dexId })}</Text> : null}
            {who0.formName !== null ? <Text testID="m17-form">{who0.formName}</Text> : null}
            {lines.map((l) => <Text key={l.text}>{l.text}</Text>)}
          </>
        }
        controls={[
          { key: 'back', label: companionCopy('m17.back.a11y'), onPress: () => router.back(), testID: 'm17-back' },
          { key: 'home', label: HLYNK_COPY['hlynk.key.home.label'], onPress: () => router.replace('/(home)'), testID: 'm17-home-key' },
        ]}
      />
    );
  }

  if (mon === undefined) {
    // An id that is not in the save: M22 says so and offers Home (and Back when there is one).
    return <Redirect href={recoveryHref('dex-not-found')} />;
  }

  const who = monIdentity(mon);
  const portrait = who.art ? (
    <View testID="m17-portrait" className="w-full" style={{ aspectRatio: 4 / 5 }}>
      <Image src={who.art.source as ImageProps['src']} alt={who.art.alt} fill unoptimized className="h-full w-full" />
    </View>
  ) : (
    <View testID="m17-portrait" className="w-full bg-surface-raised" style={{ aspectRatio: 4 / 5 }} />
  );

  const text = <DexFacts mon={mon} callerName={caller?.callerName ?? null} />;

  const heading = <Heading level={1} className="text-xr-title">{who.name}</Heading>;
  return (
    <SafeArea className="flex-1 bg-bg">
      <Back />
      {/*
        One scroll below md and in tablet portrait: top-aligned and stacked.
        Phones keep the full-width portrait; tablet portrait caps it at half
        the content width so the facts start on the first screen.
      */}
      <ScrollView className="flex-1 md:landscape:hidden" contentContainerClassName="px-4 pb-12 pt-2 md:px-8">
        <View className="mx-auto w-full max-w-content-screen gap-4">
          {heading}
          <View className="gap-4 md:gap-8">
            <View className="w-full md:w-1/2 md:self-center">{portrait}</View>
            {text}
          </View>
        </View>
      </ScrollView>
      {/* Landscape from md (the open foldable): portrait left, facts right, each pane scrolling on its own. */}
      <View className="hidden flex-1 flex-row gap-10 px-8 md:landscape:flex">
        <ScrollView className="w-5/12 grow-0" contentContainerClassName="gap-4 pb-12 pt-2">
          {portrait}
        </ScrollView>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 pb-12 pt-2">
          {heading}
          {text}
        </ScrollView>
      </View>
    </SafeArea>
  );
}
