'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { JournalEntry } from '@acme/core/types';
import {
  Badge, DaysCalendar, Heading, SafeArea, VirtualList, monthOf, shiftMonth, useHLynkStageWide, useInstanceStore,
  useReducedMotion, useStore, type YearMonth,
} from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { localDayKey, selectActiveMon, selectDaysTogether, selectJournal, useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { useHomeStage } from './home-stage.store';
import { groupJournalByDay, journalDays, journalEntryCopyId, showsFirstBadge, type DayHeading } from './journal-model';
import { useMinuteClock } from './minute-clock';
import { monIdentity } from './mon-identity';

type Row =
  | { readonly type: 'top' }
  | { readonly type: 'day'; readonly iso: string; readonly heading: DayHeading }
  | { readonly type: 'entry'; readonly entry: JournalEntry };

const EMPTY: readonly JournalEntry[] = [];

function headingText(heading: DayHeading): string {
  switch (heading.kind) {
    case 'today':
      return companionCopy('m18.day.today');
    case 'yesterday':
      return companionCopy('m18.day.yesterday');
    case 'date':
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(heading.atMs));
  }
}

function BackButton() {
  const router = useRouter();
  const label = companionCopy('m17.back.a11y');
  return (
    <View testID="m18-back" className="self-start">
    <Pressable
      accessibilityLabel={label}
      onPress={() => router.back()}
      className="min-h-target min-w-target items-start justify-center self-start focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Text className="text-xr-label text-text">{`‹ ${label}`}</Text>
    </Pressable>
    </View>
  );
}

/**
 * M18 Journal: "{name} and you", the days-together count (D-15a: days with
 * any entry, so it only rises; gaps look like future days), the calendar and
 * the timeline grouped by local day, newest first. Shell: none. Writes nothing.
 * Tapping a day with entries narrows the timeline to it; tapping it again
 * shows every day.
 */
export function JournalScreen() {
  useHomeStage({});
  const wide = useHLynkStageWide();
  const reducedMotion = useReducedMotion();
  const nowMs = useMinuteClock((s) => s.nowMs);
  const mon = useMonStore(selectActiveMon);
  const journalSelector = useMemo(() => (mon === undefined ? () => EMPTY : selectJournal(mon.monInstanceId)), [mon]);
  const entries = useMonStore(journalSelector);
  const daysSelector = useMemo(() => selectDaysTogether(nowMs), [nowMs]);
  const daysTogether = useMonStore(daysSelector) ?? 0;

  const today = localDayKey(nowMs);
  const ui = useInstanceStore(() => ({ month: monthOf(today) as YearMonth, selected: undefined as string | undefined }));
  const month = useStore(ui, (s) => s.month);
  const selected = useStore(ui, (s) => s.selected);

  const days = useMemo(() => journalDays(entries), [entries]);
  const groups = useMemo(() => groupJournalByDay(entries, nowMs), [entries, nowMs]);

  // Before the hatch the Menu never offers Journal (M18 States); a direct link gets the back control only.
  if (mon === undefined) {
    return (
      <SafeArea className="flex-1 bg-bg">
        <View className="px-4 py-2"><BackButton /></View>
      </SafeArea>
    );
  }
  const name = monIdentity(mon).name;
  const shown = selected === undefined ? groups : groups.filter((g) => g.iso === selected);
  const timeline: Row[] = shown.flatMap((g) => [
    { type: 'day', iso: g.iso, heading: g.heading } as const,
    ...g.entries.map((entry) => ({ type: 'entry', entry }) as const),
  ]);

  const header = (
    <View className="gap-2">
      <BackButton />
      <Heading level={1} testID="m18-heading" className="text-xr-title">{companionCopy('m18.heading', { name })}</Heading>
      <Text testID="m18-days" className="text-xr-body text-text-muted">
        {daysTogether === 1 ? companionCopy('m18.days.one') : companionCopy('m18.days.other', { n: daysTogether })}
      </Text>
    </View>
  );

  const calendar = (
    <View className="mt-6">
      <DaysCalendar
        testID="m18-calendar"
        month={month}
        daysTogether={days}
        today={today}
        selected={selected}
        onSelectDay={(iso) => {
          if (!days.has(iso)) return;
          ui.setState({ selected: ui.getState().selected === iso ? undefined : iso });
        }}
        onMonthChange={(direction) => ui.setState({ month: shiftMonth(ui.getState().month, direction) })}
        minMonth={monthOf(localDayKey(mon.hatchedAt))}
        reducedMotion={reducedMotion}
        labels={{
          together: companionCopy('m18.cal.day.together', { date: '' }).replace(/^,\s*/, ''),
          previousMonth: companionCopy('m18.cal.prev'),
          nextMonth: companionCopy('m18.cal.next'),
        }}
      />
    </View>
  );

  const renderRow = ({ item }: { item: Row }): ReactNode => {
    switch (item.type) {
      case 'top':
        return <View className="pb-8">{header}{calendar}</View>;
      case 'day':
        return (
          <Text role="heading" accessibilityRole="header" className="pb-2 pt-6 text-xr-label text-text">
            {headingText(item.heading)}
          </Text>
        );
      case 'entry':
        return (
          <View testID={`m18-entry-${item.entry.entryId}`} className="min-h-target flex-row items-center gap-3 border-b border-border py-2">
            <Text className="flex-1 text-xr-body text-text">{companionCopy(journalEntryCopyId(item.entry), { name })}</Text>
            {showsFirstBadge(item.entry) ? <Badge label={companionCopy('m18.first')} size="sm" tone="neutral" /> : null}
          </View>
        );
    }
  };
  const key = (row: Row, i: number) => (row.type === 'entry' ? row.entry.entryId : row.type === 'day' ? `day-${row.iso}` : `top-${i}`);

  if (wide) {
    return (
      <SafeArea className="flex-1 bg-bg">
        <View className="mx-auto w-full max-w-content-screen flex-1 flex-row gap-8 px-4">
          <View style={{ width: '41.6667%' }}>{header}{calendar}</View>
          <View testID="m18-timeline" accessibilityLabel={companionCopy('m18.timeline.a11y')} className="flex-1">
            <VirtualList data={timeline} renderItem={renderRow} keyExtractor={key} estimatedItemSize={52} className="flex-1" />
          </View>
        </View>
      </SafeArea>
    );
  }
  return (
    <SafeArea className="flex-1 bg-bg">
      <View testID="m18-timeline" accessibilityLabel={companionCopy('m18.timeline.a11y')} className="flex-1 px-4">
        <VirtualList data={[{ type: 'top' }, ...timeline]} renderItem={renderRow} keyExtractor={key} estimatedItemSize={52} className="flex-1" />
      </View>
    </SafeArea>
  );
}
