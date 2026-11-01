'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { EggRecord, MonInstance } from '@acme/core/types';
import { Button, EmptyState, FadeIn, Heading, Image, LoadingSkeleton, PressScale, ScaleIn, Text, type ImageProps } from '@acme/ui';
import { ChevronRight, Play, Smartphone } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import { monIdentity, eggIdentity } from '../companion/mon-identity';
import { useAdminStills } from '../mons/use-admin-stills';
import { tickMinuteClock, useMinuteClock } from '../companion/minute-clock';
import { useLobbyResume } from '../game/lobby/use-lobby-resume';
import { toResumeSummary } from '../game/lobby/resume-summary';
import { ScreenPanes } from '../layout/ScreenPanes';
import { selectActiveMon, selectCareNow, selectPendingEgg, useMonStore, type PendingEgg } from '../mon/mon.store';
import { resolveBootPath } from '../onboarding/boot';
import { hubCopy } from './copy';
import { careNeedNow, gameEntry, hatchReminder } from './hub-model';

/*
  HOME (canon tab 1): the Mon owns the screen. One tree (ScreenPanes),
  switched by class only, measured against the content box (left of the
  rail, under the header on rail hardware):

  - Phone: one column. The Mon (still, name, stage, the one care need and
    its action), then the hatch reminder, Continue game, and Your H-Lynk.
  - Tablet portrait (md+): the same order, top-aligned, the column widened to
    560, the Mon still larger and the type one rung up (Heading/Text step at md).
  - Landscape (md+, an open foldable): the Mon on the left half, the entries
    on the right half. A separating vertical hinge becomes the seam between
    them (ScreenPanes, screen-panes-fold.ts), so nothing straddles it.

  Phase 1 only: no Stories, events, tournaments or friends here (canon build
  order puts them later), and no placeholder for them either.
*/

/** The hub reads the minute clock the (home) layout drives; this keeps it fresh when that layout is not mounted. */
function useHubClock(): number {
  useEffect(() => {
    tickMinuteClock();
    const timer = setInterval(tickMinuteClock, 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMinuteClock((s) => s.nowMs);
}

function Still({ art, testID }: { art: ReturnType<typeof monIdentity>['art']; testID: string }) {
  if (art === undefined) return <View testID={testID} className="aspect-square w-full bg-surface-raised" />;
  return (
    <View testID={testID} className="w-full self-center md:portrait:max-w-[420px]" style={{ aspectRatio: art.width / art.height }}>
      <Image src={art.source as ImageProps['src']} alt={art.alt} fill framed={false} unoptimized className="h-full w-full" />
    </View>
  );
}

/** The active Mon: still, name, stage, the one need now and the action that answers it. */
function MonCard({ mon, nowMs }: { mon: MonInstance; nowMs: number }) {
  const router = useRouter();
  const care = useMonStore(useMemo(() => selectCareNow(nowMs), [nowMs]));
  const who = monIdentity(mon, useAdminStills());
  const need = care === undefined ? undefined : careNeedNow(care);
  const stage = hubCopy('hub.mon.stage', { stage: mon.stage });
  const status = need?.status ?? '';
  return (
    <View testID="hub-mon" className="gap-4 md:gap-6">
      <View accessible accessibilityLabel={hubCopy('hub.mon.a11y', { name: who.name, stage: mon.stage, status })} className="gap-3">
        <Text variant="label" tone="muted">{hubCopy('hub.mon.label')}</Text>
        <ScaleIn>
          <Still art={who.art} testID="hub-mon-still" />
        </ScaleIn>
        <Heading level={1} size="display-lg">{who.name}</Heading>
        <Text tone="muted">{who.bloodlineLabel === null ? stage : `${stage} · ${who.bloodlineLabel}`}</Text>
        {need !== undefined ? (
          <Text testID="hub-need-status" className="text-text">{need.status}</Text>
        ) : null}
      </View>
      {need !== undefined ? (
        <Button
          testID="hub-need-action"
          title={hubCopy(need.action, { name: who.name })}
          accessibilityHint={hubCopy('hub.need.hint')}
          variant={need.asking ? 'cta' : 'outline'}
          size="lg"
          fullWidth
          onPress={() => router.navigate(need.href as never)}
        />
      ) : null}
    </View>
  );
}

/** Before the hatch, the egg holds the Mon's place. */
function EggCard({ egg }: { egg: EggRecord }) {
  const who = eggIdentity(egg, useAdminStills());
  return (
    <View testID="hub-egg" className="gap-3" accessible accessibilityLabel={who.eggName}>
      <Text variant="label" tone="muted">{hubCopy('hub.egg.label')}</Text>
      <ScaleIn>
        <Still art={who.eggArt} testID="hub-egg-still" />
      </ScaleIn>
      <Heading level={1} size="display-lg">{who.eggName}</Heading>
    </View>
  );
}

function HatchReminder({ pending, nowMs }: { pending: PendingEgg; nowMs: number }) {
  const router = useRouter();
  const r = hatchReminder(pending.hatch, pending.egg, nowMs);
  if (r === null) return null;
  return (
    <View testID="hub-hatch" className="gap-3 border-2 border-border bg-surface-raised p-4 md:p-6">
      <Text variant="heading">{hubCopy(r.title)}</Text>
      <Text testID="hub-hatch-line" className={r.ready ? 'text-text' : 'text-text-muted'}>{r.line}</Text>
      <Button
        testID="hub-hatch-action"
        title={hubCopy(r.action)}
        variant={r.ready ? 'cta' : 'outline'}
        size="lg"
        fullWidth
        onPress={() => router.navigate('/(home)' as never)}
      />
    </View>
  );
}

/** A full-width entry row: icon, title, one line of detail, chevron. 44pt minimum. */
function EntryRow({ testID, icon, title, detail, label, onPress }: {
  testID: string; icon: ReactNode; title: string; detail: string; label: string; onPress: () => void;
}) {
  return (
    <View testID={testID}>
      <PressScale
        aria-label={label}
        onPress={onPress}
        className="min-h-target w-full flex-row items-center gap-3 border-2 border-border bg-surface-raised p-4 shadow-card md:gap-4 md:p-5"
        outerClassName="w-full"
      >
        <View className="h-10 w-10 items-center justify-center bg-primary/10 md:h-12 md:w-12">{icon}</View>
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{title}</Text>
          <Text variant="caption" tone="muted">{detail}</Text>
        </View>
        <ChevronRight size={18} className="text-text-muted" />
      </PressScale>
    </View>
  );
}

function GameRow({ monName }: { monName: string | null }) {
  const router = useRouter();
  const entry = gameEntry(toResumeSummary(useLobbyResume()));
  const detail =
    entry.kind === 'continue' && entry.savedAtMs !== null
      ? hubCopy('hub.game.continue.detail', {
          when: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.savedAtMs)),
        })
      : entry.kind === 'failed'
        ? hubCopy('hub.game.failed.detail')
        : monName === null
          ? hubCopy('hub.game.start.detail.solo')
          : hubCopy('hub.game.start.detail', { name: monName });
  return (
    <EntryRow
      testID={`hub-game-${entry.kind}`}
      icon={<Play size={20} className="text-text" />}
      title={hubCopy(entry.title)}
      detail={detail}
      label={hubCopy(entry.title)}
      onPress={() => router.navigate('/game' as never)}
    />
  );
}

function HLynkRow({ monName }: { monName: string | null }) {
  const router = useRouter();
  return (
    <EntryRow
      testID="hub-hlynk"
      icon={<Smartphone size={20} className="text-text" />}
      title={hubCopy('hub.hlynk.title')}
      detail={monName === null ? hubCopy('hub.hlynk.detail.egg') : hubCopy('hub.hlynk.detail', { name: monName })}
      label={hubCopy('hub.hlynk.a11y')}
      onPress={() => router.navigate('/(home)' as never)}
    />
  );
}

function Loading() {
  return (
    <View testID="hub-loading" accessible accessibilityLabel={hubCopy('hub.loading.a11y')} className="gap-4">
      <LoadingSkeleton variant="card" className="h-72 md:h-96" />
      <LoadingSkeleton variant="line" count={2} />
    </View>
  );
}

function NoMonYet({ nowMs }: { nowMs: number }) {
  const router = useRouter();
  return (
    <EmptyState
      title={hubCopy('hub.empty.title')}
      description={hubCopy('hub.empty.body')}
      action={
        <Button
          testID="hub-empty-action"
          title={hubCopy('hub.empty.action')}
          variant="cta"
          size="lg"
          onPress={() => router.navigate(resolveBootPath(nowMs).path as never)}
        />
      }
    />
  );
}

/** HOME: the Caller's way back in. Reads the save; writes nothing. */
export function HubScreen() {
  const nowMs = useHubClock();
  const hydrated = useMonStore((s) => s.save !== undefined);
  const mon = useMonStore(selectActiveMon);
  const pending = useMonStore(selectPendingEgg);
  const monName = mon === undefined ? null : monIdentity(mon).name;

  let primary: ReactNode;
  if (!hydrated) primary = <Loading />;
  else if (mon !== undefined) primary = <MonCard mon={mon} nowMs={nowMs} />;
  else if (pending !== undefined) primary = <EggCard egg={pending.egg} />;
  else primary = <NoMonYet nowMs={nowMs} />;

  const secondary = (
    <FadeIn delay={120}>
      <View className="gap-4 md:gap-6">
        {pending !== undefined ? <HatchReminder pending={pending} nowMs={nowMs} /> : null}
        <GameRow monName={monName} />
        {mon !== undefined || pending !== undefined ? <HLynkRow monName={monName} /> : null}
      </View>
    </FadeIn>
  );

  return <ScreenPanes testID="hub" balance="even" primary={primary} secondary={secondary} />;
}
