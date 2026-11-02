'use client';

import { useRouter } from 'expo-router';
import { Badge, Banner, SafeArea } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { systemCopy } from './copy';
import { bannerFor, queuedCount, syncStatus, unseenConflicts } from './sync-model';
import { useSyncStore } from './sync.store';

export const SYNC_PATH = '/(system)/sync';

/**
 * M21 banner, drawn at the top of the shell's content area: left of the rail
 * and under the header on rail hardware, under the status bar on phones
 * (SafeArea pads only by its own overlap, so each inset is consumed once).
 *
 * Offline: the full banner with the reassurance line and the waiting count.
 * Online with writes waiting, syncing, or a fresh server note: a one-line
 * chip. Online with nothing waiting: nothing. Every form opens M21.
 *
 * Width: the phone gutter on phones; on md+ a centred 560 pt column, the
 * same width as the onboarding forms, so it never runs under the rail and
 * never spans both halves of an open foldable's hinge as one long line.
 */
export function OfflineBanner() {
  const router = useRouter();
  const queued = useMonStore((s) => queuedCount(s.save?.queue));
  const status = useSyncStore((s) => syncStatus({ online: s.online, reconciling: s.reconciling, unseenConflicts: unseenConflicts(s.log, s.seenAt) }));
  const model = bannerFor(status, queued);
  if (model === null) return null;

  const title = systemCopy(model.titleId, { count: model.count });
  const description = model.bodyId === undefined ? undefined : systemCopy(model.bodyId);
  const label = [title, description, model.kind === 'offline' && model.count > 0 ? systemCopy(model.count === 1 ? 'm21.banner.pending.one' : 'm21.banner.pending', { count: model.count }) : undefined]
    .filter(Boolean)
    .join('. ');

  return (
    <SafeArea edges={['top']} className="absolute inset-x-0 top-0" style={{ pointerEvents: 'box-none' }} testID="m21-banner">
      <View className="mx-4 mt-2 md:mx-auto md:mt-4 md:w-[560px] md:max-w-full" style={{ pointerEvents: 'box-none' }}>
        <View testID={`m21-banner-${model.kind}`} className={model.kind === 'offline' ? '' : 'self-center'}>
        <Pressable
          role="button"
          accessibilityLabel={label}
          accessibilityHint={systemCopy('m21.banner.a11y.hint')}
          onPress={() => router.push(SYNC_PATH)}
          className="min-h-target focus-visible:ring-2 focus-visible:ring-focus"
        >
          {model.kind === 'offline' ? (
            <Banner
              tone="info"
              title={title}
              description={description}
              action={model.count > 0 ? <Badge label={systemCopy(model.count === 1 ? 'm21.banner.pending.one' : 'm21.banner.pending', { count: model.count })} size="sm" shape="pill" /> : undefined}
            />
          ) : (
            <View className="min-h-target items-center justify-center">
              <Badge label={title} size="md" shape="pill" dot={model.kind === 'pending' ? 'none' : 'solid'} />
            </View>
          )}
        </Pressable>
        </View>
      </View>
    </SafeArea>
  );
}
