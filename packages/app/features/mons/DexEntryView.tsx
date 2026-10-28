'use client';

import type { ReactNode } from 'react';
import { Badge, Button, EmptyState, Heading } from '@acme/ui';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { companionCopy } from '../companion/copy';
import { monsCopy } from './copy';
import { DexHero } from './dex-art';
import {
  adjacentEntry, dexDigits, dexEntry, entryFacts, entryName, evolutionLine, evolutionTrigger,
  type DexEntry, type EvolutionColumn, type EvolutionStep,
} from './dex-model';
import { useDex } from './use-dex';

const TABULAR = { fontVariant: ['tabular-nums' as const] };

/** One form on the line: a 48 pt button. The entry being read carries the one orange edge on the screen. */
function Step({ step, branch, onOpen }: { step: EvolutionStep; branch: boolean; onOpen: (speciesId: string) => void }) {
  const name = step.label ?? monsCopy('mons.unseen');
  const spoken = step.seen ? name : monsCopy('mons.unseen.a11y');
  const trigger = branch ? evolutionTrigger(step.speciesId) : null;
  const frame = step.current
    ? 'border-cta bg-cta/10'
    : step.seen
      ? 'border-structure bg-surface-raised'
      : 'border-dashed border-border bg-surface-sunken';
  return (
    <View className="gap-1" testID={`mons-step-${step.speciesId}`}>
      <Pressable
        accessibilityLabel={monsCopy(step.current ? 'mons.entry.step.current.a11y' : 'mons.entry.step.a11y', { stage: step.stage, name: spoken })}
        accessibilityHint={step.current ? undefined : monsCopy('mons.row.hint')}
        accessibilityState={{ selected: step.current }}
        disabled={step.current}
        onPress={() => onOpen(step.speciesId)}
        className={`min-h-target min-w-[104px] justify-center gap-0.5 border-2 px-3 py-2 focus-visible:ring-2 focus-visible:ring-focus ${frame}`}
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-xr-caption text-text-muted" style={TABULAR}>{monsCopy('mons.number', { dex: dexDigits(step.dexId) })}</Text>
        <Text className={`text-xr-label ${step.seen ? 'text-text' : 'text-text-muted'}`}>{name}</Text>
      </Pressable>
      {branch ? (
        trigger === null ? (
          <Text className="text-xr-caption text-text-muted">{monsCopy('mons.entry.trigger.unknown')}</Text>
        ) : (
          <Text className="text-xr-caption text-text" accessibilityLabel={monsCopy('mons.entry.trigger.a11y', { trigger: trigger.name })}>{trigger.name}</Text>
        )
      ) : null}
    </View>
  );
}

/**
 * The evolution line as a diagram: one row per stage, Egg at the top, Max at
 * the bottom with every branch side by side and what triggers each one.
 * Every step opens its entry; unseen steps stay "???".
 */
function EvolutionLine({ columns, onOpen }: { columns: readonly EvolutionColumn[]; onOpen: (speciesId: string) => void }) {
  return (
    <View className="gap-3" testID="mons-line">
      <Heading level={2} className="text-xr-title">{monsCopy('mons.entry.line')}</Heading>
      <View accessibilityRole="list" accessibilityLabel={monsCopy('mons.entry.line.a11y')} className="gap-1">
        {columns.map((column, i) => (
          <View key={column.stage} className="flex-row gap-3">
            {/* The stage rail: the stage name and a blue spine joining the stages. */}
            <View className="w-14 items-start">
              <Text className="pt-3 text-xr-caption text-text-muted">{column.stage}</Text>
              {i < columns.length - 1 ? <View aria-hidden className="ml-2 mt-1 w-0.5 flex-1 bg-structure/40" /> : null}
            </View>
            <View className="flex-1 gap-2 pb-3">
              {column.branches ? (
                <Text className="text-xr-caption text-text-muted">
                  {`${monsCopy('mons.entry.branch')}. ${monsCopy('mons.entry.branch.why')}`}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2">
                {column.steps.map((step) => <Step key={step.speciesId} step={step} branch={column.branches} onOpen={onOpen} />)}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Previous and Next by Dex number. */
function Neighbours({ entry, index, onOpen }: { entry: DexEntry; index: readonly DexEntry[]; onOpen: (speciesId: string) => void }) {
  const prev = adjacentEntry(index, entry.speciesId, -1);
  const next = adjacentEntry(index, entry.speciesId, 1);
  return (
    <View className="flex-row gap-target-gap">
      <View className="flex-1">
        {prev ? (
          <Button
            variant="outline" size="lg" fullWidth testID="mons-prev"
            title={`‹ ${monsCopy('mons.number', { dex: dexDigits(prev.dexId) })}`}
            aria-label={monsCopy('mons.entry.previous.a11y', { dexSpoken: prev.dexId ?? '' })}
            onPress={() => onOpen(prev.speciesId)}
          />
        ) : null}
      </View>
      <View className="flex-1">
        {next ? (
          <Button
            variant="outline" size="lg" fullWidth testID="mons-next"
            title={`${monsCopy('mons.number', { dex: dexDigits(next.dexId) })} ›`}
            aria-label={monsCopy('mons.entry.next.a11y', { dexSpoken: next.dexId ?? '' })}
            onPress={() => onOpen(next.speciesId)}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * One MONS entry, Pokédex style: the Mon big on a plain stage with its Dex
 * number set huge behind it, then the number, name, stage and Bloodline, the
 * lore line when canon has one, and the evolution line. Unseen forms keep
 * only their number. Every fact is read from `@acme/content`; a null field
 * is left out (dex-model `MISSING_CANON_FIELDS`). `leading` sits above the
 * stage (the phone route's back control).
 */
export function DexEntryView({ speciesId, onOpen, leading, testID = 'mons-entry' }: {
  speciesId: string;
  onOpen: (speciesId: string) => void;
  leading?: ReactNode;
  testID?: string;
}) {
  const { seen, index } = useDex();
  const entry = dexEntry(speciesId, seen);

  if (entry === undefined) {
    return (
      <View testID={`${testID}-notfound`} className="flex-1 gap-6 px-4 py-6">
        {leading}
        <EmptyState title={monsCopy('mons.notfound.title')} description={monsCopy('mons.notfound.body')} />
      </View>
    );
  }

  const name = entryName(entry);
  const number = monsCopy('mons.number', { dex: dexDigits(entry.dexId) });
  const numberSpoken = monsCopy('mons.number.a11y', { dexSpoken: entry.dexId ?? '' });
  const facts = entry.seen ? entryFacts(entry.speciesId) : [];

  return (
    <ScrollView testID={testID} className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-content-detail gap-6 px-4 pt-2 md:px-8">
        {leading}
        {/* The stage: the Mon owns it. The number sits huge behind, in the structure blue, and the Mon stands in front of it. */}
        <View className="relative w-full max-w-[520px] self-center overflow-hidden" style={{ aspectRatio: 1 }} testID={`${testID}-stage`}>
          <Text
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={1}
            className="absolute inset-x-0 top-0 text-center font-display text-[132px] leading-[140px] text-structure opacity-10 md:text-[200px] md:leading-[210px]"
            style={TABULAR}
          >
            {dexDigits(entry.dexId)}
          </Text>
          <View className="absolute inset-x-[8%] bottom-6 top-10">
            <DexHero entry={entry} name={name} />
          </View>
          <View aria-hidden className="absolute inset-x-0 bottom-4 h-0.5 bg-structure/40" />
        </View>

        <View className="gap-2" testID={`${testID}-title`}>
          <Text accessibilityLabel={numberSpoken} selectable className="text-xr-label text-tone-royal-text" style={TABULAR}>{number}</Text>
          <Heading level={1} className="font-display text-xr-heading">{name}</Heading>
          {entry.seen ? (
            <View className="flex-row flex-wrap items-center gap-3">
              <Badge label={entry.stage} tone="neutral" size="sm" />
              <Text className="text-xr-body text-text-muted">{companionCopy('m17.bloodline', { bloodlineName: entry.bloodlineName })}</Text>
            </View>
          ) : (
            <Text className="text-xr-body text-text-muted">{monsCopy('mons.entry.unseen.body')}</Text>
          )}
        </View>

        {facts.map((fact) => (
          <View key={fact.id} className="gap-1 border-t border-border pt-4">
            <Text className="text-xr-caption text-text-muted">{monsCopy('mons.entry.lore')}</Text>
            <Text selectable className="text-xr-body text-text">{fact.value}</Text>
          </View>
        ))}

        <EvolutionLine columns={evolutionLine(entry.speciesId, seen)} onOpen={onOpen} />
        <Neighbours entry={entry} index={index} onOpen={onOpen} />
      </View>
    </ScrollView>
  );
}
