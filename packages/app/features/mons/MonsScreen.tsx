'use client';

import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { I18nManager, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LifecycleStage } from '@acme/core/types';
import { Button, EmptyState, Heading, SafeArea, SearchBar, SegmentedControl, useInstanceStore, useStore, VirtualList } from '@acme/ui';
import { useFoldLayout } from '@acme/ui/adaptive-panes/parts';
import { Pressable, Text, View } from '@acme/ui/tw';
import { useShallow } from 'zustand/react/shallow';
import { companionCopy } from '../companion/copy';
import { useHomeStage } from '../companion/home-stage.store';
import { monsCopy } from './copy';
import { DexThumb } from './dex-art';
import { monsArrangement, type FoldSplit } from './dex-layout';
import {
  bloodlineFilters, DEX_STAGES, dexDigits, entryName, filterDex, groupByBloodline, seenCount,
  type DexEntry, type DexFilter, type DexListItem,
} from './dex-model';
import { useDexBrowse } from './dex.store';
import { DexEntryView } from './DexEntryView';
import { useDex } from './use-dex';

const TABULAR = { fontVariant: ['tabular-nums' as const] };
const INDEX_PATH = '/(home)/mons';
const entryPath = (speciesId: string) => `/(home)/mons/${speciesId}`;

type StageFilter = 'all' | LifecycleStage;

/** One list row: thumbnail, number, name, stage and Bloodline. Unseen rows keep only the number. 72 pt tall. */
function Row({ entry, selected, onPress }: { entry: DexEntry; selected: boolean; onPress: () => void }) {
  const number = monsCopy('mons.number', { dex: dexDigits(entry.dexId) });
  const bloodline = companionCopy('m17.bloodline', { bloodlineName: entry.bloodlineName });
  const label = entry.seen
    ? monsCopy('mons.row.a11y', { name: entryName(entry), dexSpoken: entry.dexId ?? '', stage: entry.stage, bloodline })
    : monsCopy('mons.row.unseen.a11y', { dexSpoken: entry.dexId ?? '' });
  return (
    <View testID={`mons-row-${entry.speciesId}`}>
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={monsCopy('mons.row.hint')}
      accessibilityState={{ selected }}
      onPress={onPress}
      // The selected row carries the screen's one orange mark: its leading edge.
      className={`min-h-[72px] flex-row items-center gap-3 border-b border-l-4 border-b-border py-2 pl-3 pr-4 focus-visible:ring-2 focus-visible:ring-focus ${selected ? 'border-l-cta bg-surface-raised' : 'border-l-transparent'}`}
    >
      <DexThumb entry={entry} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-xr-caption text-text-muted" style={TABULAR}>{number}</Text>
        <Text numberOfLines={1} className={`font-display text-xr-label ${entry.seen ? 'text-text' : 'text-text-muted'}`}>{entryName(entry)}</Text>
        {entry.seen ? (
          <View className="flex-row flex-wrap gap-x-3">
            <Text className="text-xr-caption text-text">{entry.stage}</Text>
            <Text numberOfLines={1} className="text-xr-caption text-text-muted">{bloodline}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
    </View>
  );
}

/** A Bloodline heading: a short blue bar and the label. */
function BloodlineHeading({ name }: { name: string }) {
  return (
    <View className="flex-row items-center gap-2 px-4 pb-2 pt-6">
      <View aria-hidden className="h-5 w-1 bg-structure" />
      <Text accessibilityRole="header" className="text-xr-label text-text">{companionCopy('m17.bloodline', { bloodlineName: name })}</Text>
    </View>
  );
}

/** The filters: Bloodline, then stage. Two segmented rows, wrapping two by two on a phone. */
function Filters() {
  const { bloodline, stage } = useDexBrowse(useShallow((s) => ({ bloodline: s.query.bloodline, stage: s.query.stage })));
  const setQuery = useDexBrowse((s) => s.setQuery);
  const all = monsCopy('mons.filter.all');
  const bloodlineOptions = useMemo(
    () => [{ value: 'all' as DexFilter, label: all }, ...bloodlineFilters().map((b) => ({ value: b.id as DexFilter, label: b.label }))],
    [all],
  );
  const stageOptions = useMemo(
    () => [{ value: 'all' as StageFilter, label: all }, ...DEX_STAGES.map((st) => ({ value: st as StageFilter, label: st }))],
    [all],
  );
  return (
    <View className="gap-3">
      <SegmentedControl
        aria-label={monsCopy('mons.filter.bloodline.a11y')}
        options={bloodlineOptions}
        value={bloodline}
        onChange={(v) => setQuery({ bloodline: v })}
        segmentClassName="basis-[45%] grow"
      />
      <SegmentedControl
        aria-label={monsCopy('mons.filter.stage.a11y')}
        options={stageOptions}
        value={stage}
        onChange={(v) => setQuery({ stage: v })}
        segmentClassName="basis-[30%] grow sm:basis-auto"
      />
    </View>
  );
}

type ListItem = DexListItem | { readonly kind: 'top' };

/**
 * The master pane: title, count and search fixed at the top, then the
 * filters and the grouped list scrolling together. An empty save shows the
 * empty state above a list of "???" numbers; a search that matches nothing
 * says so and offers to clear it.
 */
function DexList({ selectedId, onOpen }: { selectedId: string | null; onOpen: (speciesId: string) => void }) {
  const { index } = useDex();
  const query = useDexBrowse((s) => s.query);
  const setQuery = useDexBrowse((s) => s.setQuery);
  const clearQuery = useDexBrowse((s) => s.clearQuery);
  const count = seenCount(index);
  const shown = useMemo(() => filterDex(index, query), [index, query]);
  const items: ListItem[] = useMemo(() => [{ kind: 'top' }, ...groupByBloodline(shown)], [shown]);

  const renderItem = ({ item }: { item: ListItem }): ReactNode => {
    if (item.kind === 'top') {
      return (
        <View className="gap-4 px-4 pb-2 pt-4">
          <Filters />
          {count.seen === 0 ? <EmptyState title={monsCopy('mons.empty.title')} description={monsCopy('mons.empty.body')} /> : null}
          {shown.length === 0 ? (
            <View testID="mons-nomatch">
              <EmptyState
                title={monsCopy('mons.nomatch.title')}
                description={monsCopy('mons.nomatch.body')}
                action={<Button variant="outline" size="lg" title={monsCopy('mons.nomatch.clear')} onPress={clearQuery} />}
              />
            </View>
          ) : null}
        </View>
      );
    }
    if (item.kind === 'heading') return <BloodlineHeading name={item.bloodlineName} />;
    const entry = item.entry;
    return <Row entry={entry} selected={entry.speciesId === selectedId} onPress={() => onOpen(entry.speciesId)} />;
  };
  const keyOf = (item: ListItem) => (item.kind === 'top' ? 'top' : item.kind === 'heading' ? `h-${item.bloodlineId}` : item.entry.speciesId);

  return (
    <View testID="mons-list" className="flex-1">
      <View className="gap-3 border-b-2 border-structure/40 px-4 pb-3 pt-2">
        <View className="flex-row items-end justify-between gap-3">
          <Heading level={1} className="font-display text-xr-heading">{monsCopy('mons.title')}</Heading>
          <Text testID="mons-count" accessibilityLabel={monsCopy('mons.count.a11y', count)} className="pb-1 text-xr-label text-text-muted" style={TABULAR}>
            {monsCopy('mons.count', count)}
          </Text>
        </View>
        <SearchBar
          value={query.text}
          onChangeText={(text) => setQuery({ text })}
          placeholder={monsCopy('mons.search.placeholder')}
          aria-label={monsCopy('mons.search.a11y')}
        />
      </View>
      <VirtualList data={items} renderItem={renderItem} keyExtractor={keyOf} estimatedItemSize={72} className="flex-1" />
    </View>
  );
}

/** The phone route's way back to the list (the (home) group has no stack header). */
function BackToList({ onPress }: { onPress: () => void }) {
  const label = monsCopy('mons.entry.back');
  return (
    <View testID="mons-back" className="self-start">
      <Pressable
        accessibilityLabel={label}
        onPress={onPress}
        className="min-h-target min-w-target items-start justify-center focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Text className="text-xr-label text-text">{`‹ ${label}`}</Text>
      </Pressable>
    </View>
  );
}

/**
 * MONS, the species index (Gameplay Bible v12, tab 4): "what is this Mon?",
 * not the care screen. A plain full screen in the (home) group under the
 * shell's header, rail, drawer and bottom tabs; no H-Lynk on it.
 *
 * One tree at every size, so search, filters, selection and scroll survive a
 * rotation or a fold (foldable skill §6). The arrangement is measured against
 * this screen's own box (inside the rail and header), never the window:
 *
 * - phone, tablet portrait, any narrow window: the list alone; a row opens
 *   the entry as its own screen (`/(home)/mons/[speciesId]`);
 * - landscape from md, and an open foldable: list on the physical left,
 *   entry on the right, with the boundary on a separating fold and no pane
 *   under the hinge (dex-layout.ts).
 *
 * `speciesId` is the entry route's param: on a split window that route shows
 * the same two panes with that entry open.
 */
export function MonsScreen({ routeSpeciesId }: { routeSpeciesId?: string }) {
  const router = useRouter();
  useHomeStage({});
  const frame = useInstanceStore(() => ({ width: 0, height: 0, x: null as number | null }));
  const { width, height, x } = useStore(frame);
  const host = useRef<HostInstance>(null);
  const fold = useFoldLayout(x);
  const foldSplit: FoldSplit | null =
    fold !== null && fold.separating && fold.orientation === 'vertical' ? { leadingWidth: fold.x, gapWidth: fold.width } : null;
  const arrangement = width === 0 ? { mode: 'single' as const } : monsArrangement({ width, height, fold: foldSplit });
  const split = arrangement.mode === 'split';

  const storeSelected = useDexBrowse((s) => s.selectedId);
  const select = useDexBrowse((s) => s.select);
  const { index } = useDex();
  const selectedId = routeSpeciesId ?? storeSelected ?? index.find((e) => e.seen)?.speciesId ?? null;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    frame.setState({ width: w, height: h });
    host.current?.measureInWindow((wx) => frame.setState({ x: wx }));
  }, [frame]);

  const open = (speciesId: string) => {
    select(speciesId);
    if (split) {
      // Beside the list, the entry swaps in place. On the entry route, keep the URL in step.
      if (routeSpeciesId !== undefined) router.setParams({ speciesId });
      return;
    }
    if (routeSpeciesId === undefined) router.push(entryPath(speciesId) as never);
    else router.replace(entryPath(speciesId) as never);
  };
  const backToList = () => {
    if (router.canGoBack()) router.back();
    else router.replace(INDEX_PATH as never);
  };

  const listOnly = !split && routeSpeciesId === undefined;
  const entryOnly = !split && routeSpeciesId !== undefined;

  return (
    <SafeArea edges={['top']} className="flex-1 bg-bg">
      <View
        ref={host as never}
        onLayout={onLayout}
        testID="mons-screen"
        // The list stays on the PHYSICAL left in RTL too (Yoga mirrors `row`); text still reads RTL.
        className={`flex-1 ${I18nManager.isRTL ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {entryOnly ? null : (
          <View
            testID="mons-master"
            style={split ? { width: arrangement.listWidth } : undefined}
            className={split ? 'border-r-2 border-structure/40' : 'flex-1'}
          >
            {/* Tablet portrait gets one wider centred column rather than a stretched list. */}
            <View className={listOnly ? 'mx-auto w-full max-w-content-detail flex-1' : 'flex-1'}>
              <DexList selectedId={split ? selectedId : null} onOpen={open} />
            </View>
          </View>
        )}
        {split && arrangement.gapWidth > 0 ? <View aria-hidden testID="mons-hinge" style={{ width: arrangement.gapWidth }} /> : null}
        {listOnly ? null : (
          <View testID="mons-detail" className="min-w-0 flex-1">
            {selectedId === null ? (
              <View className="flex-1 justify-center px-8">
                <EmptyState title={monsCopy('mons.detail.empty.title')} description={monsCopy('mons.detail.empty.body')} />
              </View>
            ) : (
              <DexEntryView
                speciesId={selectedId}
                onOpen={open}
                leading={entryOnly ? <BackToList onPress={backToList} /> : undefined}
              />
            )}
          </View>
        )}
      </View>
    </SafeArea>
  );
}

/** `/(home)/mons/[speciesId]`: one entry on a phone, or the split with it open. */
export function MonsEntryScreen() {
  const { speciesId } = useLocalSearchParams<{ speciesId: string }>();
  return <MonsScreen routeSpeciesId={typeof speciesId === 'string' ? speciesId : ''} />;
}
