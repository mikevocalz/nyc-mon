'use client';

import { useMemo } from 'react';
import type { JournalEntry } from '@acme/core/types';
import { Badge, EmptyState, Heading } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { selectActiveMon, selectJournal, useMonStore } from '../mon/mon.store';
import { CompanionPane } from './CompanionPane';
import { companionCopy, type CompanionCopyId } from './copy';
import { journalEntryCopyId, showsFirstBadge } from './journal-model';
import { monIdentity } from './mon-identity';

const NO_ENTRIES: readonly JournalEntry[] = [];

/** The active Mon's name and its journal, newest first; `ready` is false until the save has a Mon. */
export function useActiveJournal(): { ready: boolean; name: string; entries: readonly JournalEntry[] } {
  const mon = useMonStore(selectActiveMon);
  const selector = useMemo(() => (mon === undefined ? () => NO_ENTRIES : selectJournal(mon.monInstanceId)), [mon]);
  const entries = useMonStore(selector);
  return { ready: mon !== undefined, name: mon === undefined ? '' : monIdentity(mon).name, entries };
}

const TIME = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Journal entries as rows: what happened, when, and the First badge (M18's wording). */
export function JournalRows({ entries, name, testID }: { entries: readonly JournalEntry[]; name: string; testID: string }) {
  return (
    <View testID={testID} accessibilityLabel={companionCopy('m18.timeline.a11y')}>
      {entries.map((entry) => {
        const text = companionCopy(journalEntryCopyId(entry), { name });
        const when = TIME.format(new Date(entry.at));
        const first = showsFirstBadge(entry);
        return (
          <View
            key={entry.entryId}
            testID={`${testID}-${entry.entryId}`}
            accessible
            accessibilityLabel={first ? `${text}, ${companionCopy('m18.first')}, ${when}` : `${text}, ${when}`}
            className="min-h-target flex-row items-center gap-3 border-b border-border py-2"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-xr-body text-text">{text}</Text>
              <Text className="text-xr-caption text-text-muted">{when}</Text>
            </View>
            {first ? <Badge label={companionCopy('m18.first')} size="sm" tone="neutral" /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** A short list of plain tips under a "Good to know" heading. */
export function TipList({ tips, testID }: { tips: readonly string[]; testID: string }) {
  return (
    <View testID={testID} className="gap-2">
      <Heading level={3} className="text-xr-label">{companionCopy('pane.tips')}</Heading>
      {tips.map((tip) => (
        <View key={tip} className="flex-row gap-2">
          <Text aria-hidden className="text-xr-body text-text-muted">•</Text>
          <Text className="flex-1 text-xr-body text-text">{tip}</Text>
        </View>
      ))}
    </View>
  );
}

/** A section heading inside a pane. */
export function PaneSection({ title }: { title: string }) {
  return <Heading level={3} className="text-xr-label">{title}</Heading>;
}

/** What each care route's pane lists, and the copy it uses. */
const HISTORY = {
  feed: { kinds: ['fed'], title: 'pane.feed.title', history: 'pane.feed.history', emptyTitle: 'pane.feed.empty.title', emptyBody: 'pane.feed.empty.body' },
  rest: { kinds: ['rested', 'woke-rested'], title: 'pane.rest.title', history: 'pane.rest.history', emptyTitle: 'pane.rest.empty.title', emptyBody: 'pane.rest.empty.body' },
  social: { kinds: ['played'], title: 'pane.social.title', history: 'pane.social.history', emptyTitle: 'pane.social.empty.title', emptyBody: 'pane.social.empty.body' },
} as const satisfies Record<string, {
  kinds: readonly JournalEntry['kind'][];
  title: CompanionCopyId; history: CompanionCopyId; emptyTitle: CompanionCopyId; emptyBody: CompanionCopyId;
}>;

/** How many past rounds or meals a care pane lists. */
const HISTORY_ROWS = 8;

/**
 * M14 to M16's companion pane: the route's own history from the journal
 * (meals, naps, games) and plain tips. `tips` come from the route, which
 * knows the Mon's state; the pane only lists them.
 */
export function CareHistoryPane({ route, tips, loading }: { route: keyof typeof HISTORY; tips: readonly string[]; loading: boolean }) {
  const spec = HISTORY[route];
  const journal = useActiveJournal();
  const kinds: readonly string[] = spec.kinds;
  const rows = journal.entries.filter((e) => kinds.includes(e.kind)).slice(0, HISTORY_ROWS);
  const testID = `pane-${route}`;
  return (
    <CompanionPane title={companionCopy(spec.title)} testID={testID} loading={loading || !journal.ready}>
      <View className="gap-2">
        <PaneSection title={companionCopy(spec.history)} />
        {rows.length === 0 ? (
          <View testID={`${testID}-empty`}>
            <EmptyState title={companionCopy(spec.emptyTitle)} description={companionCopy(spec.emptyBody, { name: journal.name })} />
          </View>
        ) : (
          <JournalRows entries={rows} name={journal.name} testID={`${testID}-entry`} />
        )}
      </View>
      {tips.length > 0 ? <TipList tips={tips} testID={`${testID}-tips`} /> : null}
    </CompanionPane>
  );
}
