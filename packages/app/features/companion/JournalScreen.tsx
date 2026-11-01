'use client';

import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { JournalEntry } from '@acme/core/types';
import {
  Badge, Button, DaysCalendar, Heading, SafeArea, VirtualList, monthOf, shiftMonth, useInstanceStore,
  useReducedMotion, useStore, type DeviceKey, type GlassLine, type GlassView, type YearMonth,
} from '@acme/ui';
import { ScrollView, Text, View } from '@acme/ui/tw';
import { localDayKey, selectActiveMon, selectDaysTogether, selectJournal, useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { GlassStage, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { useHomeStage } from './home-stage.store';
import { CompanionPane } from './CompanionPane';
import { groupJournalByDay, journalDays, journalEntryCopyId, showsFirstBadge, type DayHeading } from './journal-model';
import { useMinuteClock } from './minute-clock';
import { monIdentity } from './mon-identity';
import { ScreenBack } from '../navigation/use-header-back';

type Row =
  | { readonly type: 'top' }
  | { readonly type: 'day'; readonly iso: string; readonly heading: DayHeading }
  | { readonly type: 'entry'; readonly entry: JournalEntry };

const EMPTY: readonly JournalEntry[] = [];
/** The Baby small at the top, seven timeline rows, then Newer / Older / Back. */
const LAYOUT = { model: 'small', rings: false, lineRows: 7, actionRows: 1, perRow: 3 } as const;
const PAGE = 7;

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

/**
 * M18 Journal: "{name} and you", the days-together count (D-15a: days with
 * any entry, so it only rises; gaps look like future days), the calendar and
 * the timeline grouped by local day, newest first. Shell: none. Writes nothing.
 * Tapping a day with entries narrows the timeline to it; tapping it again
 * shows every day.
 */
export function JournalScreen() {
  const router = useRouter();
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

  // ---- the 3D H-Lynk: the Baby on the glass over the timeline, a page of rows at a time ----
  const glassUi = useInstanceStore(() => ({ failed: false, page: 0, nudge: 0 }));
  const { failed, page, nudge } = useStore(glassUi);
  const glassOn = useGlassOn(failed) && mon !== undefined;
  const { model, monClips } = useMonGlass(mon === undefined ? null : monIdentity(mon).dexId, undefined);
  const glassName = mon === undefined ? '' : monIdentity(mon).name;
  // The pane's calendar narrows the glass timeline to one day, as it does the 2D list.
  const glassGroups = selected === undefined ? groups : groups.filter((g) => g.iso === selected);
  const rows: GlassLine[] = glassGroups.flatMap((g) => [
    { text: headingText(g.heading), size: 'caption' as const, tone: 'dim' as const, align: 'left' as const },
    ...g.entries.map((entry): GlassLine => ({
      text: companionCopy(journalEntryCopyId(entry), { name: glassName }),
      align: 'left',
      ...(showsFirstBadge(entry) ? { badge: companionCopy('m18.first') } : {}),
    })),
  ]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages - 1);
  const turn = (by: -1 | 1) => glassUi.setState({ page: Math.min(pages - 1, Math.max(0, at + by)) });
  const glassView: GlassView = {
    status: { text: daysTogether === 1 ? companionCopy('m18.days.one') : companionCopy('m18.days.other', { n: daysTogether }), tone: 'neutral' },
    title: companionCopy('m18.heading', { name: glassName }),
    subtitle: '',
    rings: [],
    lines: rows.slice(at * PAGE, at * PAGE + PAGE),
    actions: [
      { target: 'newer', label: companionCopy('m18.page.newer'), tone: 'secondary', disabled: at === 0 },
      { target: 'older', label: companionCopy('m18.page.older'), tone: 'secondary', disabled: at >= pages - 1 },
      { target: 'back', label: companionCopy('m17.back.a11y'), tone: 'primary' },
    ],
  };
  const onAction = (target: string) => {
    if (target === 'newer') turn(-1);
    else if (target === 'older') turn(1);
    else if (target === 'back') router.back();
  };
  const glass = useGlassScreen({ layout: LAYOUT, model, view: glassView, nudge });
  useEffect(() => {
    glass.bind({ onAction, monClips, onModel: () => glassUi.setState({ nudge: glassUi.getState().nudge + 1 }) });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'prev') turn(-1);
    else if (key === 'next') turn(1);
    else if (key === 'back') router.back();
    else if (key === 'home') router.replace('/(home)');
  };
  const onFailed = useCallback(() => glassUi.setState({ failed: true }), [glassUi]);
  const selectDay = (iso: string) => {
    if (!days.has(iso)) return;
    ui.setState({ selected: ui.getState().selected === iso ? undefined : iso });
    glassUi.setState({ page: 0 });
  };
  const calendarLabels = {
    together: companionCopy('m18.cal.day.together', { date: '' }).replace(/^,\s*/, ''),
    previousMonth: companionCopy('m18.cal.prev'),
    nextMonth: companionCopy('m18.cal.next'),
  };
  const selectedLabel = selected === undefined
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(`${selected}T12:00:00`));
  const companion = mon === undefined ? undefined : (
    <CompanionPane
      title={companionCopy('pane.journal.title')}
      testID="m18-pane"
      empty={entries.length === 0 ? { title: companionCopy('pane.home.recent.empty.title'), description: companionCopy('pane.home.recent.empty.body', { name: glassName }) } : null}
    >
      <Text testID="m18-pane-days" className="text-xr-body text-text-muted">{glassView.status?.text ?? ''}</Text>
      <DaysCalendar
        testID="m18-pane-calendar"
        month={month}
        daysTogether={days}
        today={today}
        selected={selected}
        onSelectDay={selectDay}
        onMonthChange={(direction) => ui.setState({ month: shiftMonth(ui.getState().month, direction) })}
        minMonth={monthOf(localDayKey(mon.hatchedAt))}
        reducedMotion={reducedMotion}
        labels={calendarLabels}
      />
      {selectedLabel === null ? null : (
        <View className="gap-2" testID="m18-pane-filter">
          <Text accessibilityLiveRegion="polite" className="text-xr-body text-text">{companionCopy('pane.journal.filtered', { date: selectedLabel })}</Text>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            title={companionCopy('pane.journal.all')}
            onPress={() => { ui.setState({ selected: undefined }); glassUi.setState({ page: 0 }); }}
            className="min-h-target"
          />
        </View>
      )}
    </CompanionPane>
  );
  useHomeStage(glassOn ? {} : {});
  if (glassOn) {
    return (
      <GlassStage
        screen={glass.screen}
        label={glassView.title}
        testIDPrefix="m18"
        onKey={onKey}
        onFailed={onFailed}
        companion={companion}
        a11y={
          <View testID="m18-timeline" accessibilityLabel={companionCopy('m18.timeline.a11y')}>
            <Text testID="m18-heading" accessibilityRole="header">{glassView.title}</Text>
            <Text testID="m18-days">{glassView.status?.text ?? ''}</Text>
            {rows.map((r, i) => <Text key={`${i}-${r.text}`}>{r.badge ? `${r.text}, ${r.badge}` : r.text}</Text>)}
          </View>
        }
        controls={glassView.actions.map((a) => ({
          key: a.target, label: a.label, disabled: a.disabled, onPress: () => onAction(a.target), testID: `m18-${a.target}`,
        }))}
      />
    );
  }

  // Before the hatch the Menu never offers Journal (M18 States); a direct link gets the back control only.
  if (mon === undefined) {
    return (
      <SafeArea className="flex-1 bg-bg">
        <ScreenBack testID="m18-back" />
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
      <Heading level={1} testID="m18-heading" className="text-xr-title">{companionCopy('m18.heading', { name })}</Heading>
      <Text testID="m18-days" className="text-xr-body text-text-muted">
        {daysTogether === 1 ? companionCopy('m18.days.one') : companionCopy('m18.days.other', { n: daysTogether })}
      </Text>
    </View>
  );

  const calendar = (
    <View className="mt-6 md:portrait:mt-0">
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

  const timelineLabel = companionCopy('m18.timeline.a11y');
  return (
    <SafeArea className="flex-1 bg-bg">
      <ScreenBack testID="m18-back" />
      {/* Below md (phones in portrait): one list, the header and calendar as its first row. As before. */}
      <View testID="m18-timeline" accessibilityLabel={timelineLabel} className="flex-1 px-4 md:hidden">
        <VirtualList data={[{ type: 'top' }, ...timeline]} renderItem={renderRow} keyExtractor={key} estimatedItemSize={52} className="flex-1" />
      </View>
      {/*
        From md, two panes that each scroll on their own. Portrait: the header
        and the calendar side by side at the top, the timeline under them.
        Landscape (the open foldable): calendar left, timeline right.
      */}
      <View className="hidden flex-1 gap-6 px-8 md:flex md:landscape:flex-row md:landscape:gap-10">
        <ScrollView
          testID="m18-calendar-pane"
          className="grow-0 md:portrait:max-h-[55%] md:landscape:w-5/12"
          contentContainerClassName="pb-6 md:portrait:flex-row md:portrait:gap-8"
        >
          <View className="md:portrait:flex-1">{header}</View>
          <View className="md:portrait:flex-1">{calendar}</View>
        </ScrollView>
        <View testID="m18-timeline" accessibilityLabel={timelineLabel} className="w-full flex-1 md:portrait:max-w-content-detail md:portrait:self-center">
          <VirtualList data={timeline} renderItem={renderRow} keyExtractor={key} estimatedItemSize={52} className="flex-1" />
        </View>
      </View>
    </SafeArea>
  );
}
