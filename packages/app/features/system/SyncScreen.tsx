'use client';

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Badge, Button, EmptyState, FadeIn, Heading, StatusRow, Text } from '@acme/ui';
import { Pressable, Section, View } from '@acme/ui/tw';
import { monIdentity } from '../companion/mon-identity';
import { ScreenPanes } from '../layout/ScreenPanes';
import { useMonStore } from '../mon/mon.store';
import { systemCopy } from './copy';
import { OUTCOME_COPY, queuedCount, queueRows, STATUS_COPY, syncStatus, unseenConflicts } from './sync-model';
import { markSyncLogSeen, syncNow, useSyncStore } from './sync.store';

const time = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

/** A Mon's display name for a log or queue line; the id when the Mon is no longer in the save. */
function useNameFor(): (monInstanceId: string | null) => string {
  const mons = useMonStore((s) => s.save?.mons);
  return (id) => {
    const mon = mons?.find((m) => m.monInstanceId === id);
    return mon === undefined ? (id ?? '') : monIdentity(mon).name;
  };
}

function Back() {
  const router = useRouter();
  return (
    <View className="px-4 pt-2 md:px-8">
      <View testID="m21-back" className="self-start">
      <Pressable
        role="button"
        accessibilityLabel={systemCopy('m21.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(home)'))}
        className="min-h-target min-w-target items-start justify-center self-start focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Text>{`‹ ${systemCopy('m21.back')}`}</Text>
      </Pressable>
      </View>
    </View>
  );
}

/** Title, connection status, the local-first line, the last result and Sync now. */
function SyncSummary() {
  const queued = useMonStore((s) => queuedCount(s.save?.queue));
  const online = useSyncStore((s) => s.online);
  const reconciling = useSyncStore((s) => s.reconciling);
  const outcome = useSyncStore((s) => s.lastOutcome);
  const unseen = useSyncStore((s) => unseenConflicts(s.log, s.seenAt));
  const status = syncStatus({ online, reconciling, unseenConflicts: unseen });
  return (
    <FadeIn>
      <View className="gap-4 md:gap-6">
        <Heading level={1} size="display-sm" className="md:text-display-md">{systemCopy('m21.title')}</Heading>
        <View testID={`m21-status-${status}`}>
          <StatusRow
            items={[{ id: 'sync', label: systemCopy(STATUS_COPY[status]), tone: status === 'offline' ? 'offline' : status === 'reconciling' ? 'pending' : 'neutral' }]}
          />
        </View>
        <Text tone="muted" className="md:text-lg">{systemCopy('m21.local_first')}</Text>
        {outcome !== null ? (
          <Text testID={`m21-result-${outcome}`} role="status" selectable>{systemCopy(OUTCOME_COPY[outcome])}</Text>
        ) : null}
        <Button
          testID="m21-retry"
          title={systemCopy('m21.retry')}
          accessibilityHint={systemCopy('m21.retry.a11y.hint')}
          variant="cta"
          size="lg"
          loading={reconciling}
          disabled={reconciling || queued === 0}
          onPress={() => void syncNow()}
        />
      </View>
    </FadeIn>
  );
}

/** The waiting writes, then the conflict log. */
function SyncDetails() {
  const queue = useMonStore((s) => s.save?.queue);
  const log = useSyncStore((s) => s.log);
  const nameFor = useNameFor();
  const rows = queueRows(queue);
  return (
    <>
      <Section className="gap-2" testID="m21-queue">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="label" tone="muted">{systemCopy('m21.queue.title')}</Text>
          {rows.length > 0 ? (
            <View testID="m21-queue-count">
              <Badge label={systemCopy(rows.length === 1 ? 'm21.queue.count.one' : 'm21.queue.count', { count: rows.length })} size="sm" shape="pill" />
            </View>
          ) : null}
        </View>
        {rows.length === 0 ? (
          <EmptyState title={systemCopy('m21.queue.empty.title')} description={systemCopy('m21.queue.empty.body')} />
        ) : (
          <View className="border-2 border-border bg-surface-raised">
            {rows.map((row, i) => {
              const label = systemCopy(row.copyId, { name: nameFor(row.monInstanceId) });
              return (
                <View key={row.key} accessible accessibilityLabel={`${label}, ${time(row.at)}`} className={`gap-0.5 px-4 py-3 ${i > 0 ? 'border-t-2 border-border' : ''}`}>
                  <Text>{label}</Text>
                  <Text variant="caption" tone="muted">{time(row.at)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>
      <Section className="gap-2" testID="m21-log">
        <Text variant="label" tone="muted">{systemCopy('m21.log.title')}</Text>
        {log.length === 0 ? (
          <Text tone="muted">{systemCopy('m21.log.empty')}</Text>
        ) : (
          <View className="border-2 border-border bg-surface-raised">
            {log.map((entry, i) => {
              const line = systemCopy(entry.count === 1 ? 'm21.log.server_kept.one' : 'm21.log.server_kept', { count: entry.count, name: nameFor(entry.monInstanceId) });
              return (
                <View key={entry.id} accessible accessibilityLabel={`${line}, ${time(entry.at)}`} className={`gap-0.5 px-4 py-3 ${i > 0 ? 'border-t-2 border-border' : ''}`}>
                  <Text selectable>{line}</Text>
                  <Text variant="caption" tone="muted">{time(entry.at)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>
    </>
  );
}

/**
 * M21 `/(system)/sync`. Shell: none. Lists what is waiting and what the
 * server changed, with Sync now.
 *
 * Layout (ScreenPanes, one tree):
 * - Phone: summary and Sync now, then the queue and the log.
 * - Tablet portrait (md+): the same order, top-aligned, 560 pt column.
 * - Landscape md+ / open foldable: summary on the left two fifths, queue
 *   and log on the right, inside the content box.
 */
export function SyncScreen() {
  useEffect(() => {
    markSyncLogSeen();
  }, []);
  return (
    <View className="flex-1 bg-surface" testID="m21-sync">
      <ScreenPanes testID="m21-panes" leading={<Back />} primary={<SyncSummary />} secondary={<SyncDetails />} />
    </View>
  );
}
