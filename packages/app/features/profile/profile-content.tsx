'use client';
// The Caller's own page (canon tab 5), Phase 1: identity, the Mons raised,
// eggs hatched, the journal's highlights, and the ways into Settings and
// Account. Reputation, rankings, achievements, friends/rivals and battle
// history belong to later canon phases and are not drawn, not even as stubs.
import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import { Avatar, Heading, Image, LoadingSkeleton, PressScale, Text, FadeIn, ScaleIn, type ImageProps } from '@acme/ui';
import { ChevronRight, KeyRound, Settings as SettingsIcon } from '@acme/ui/icons';
import { copy } from '../onboarding/copy';
import { monIdentity } from '../companion/mon-identity';
import { useAdminStills } from '../mons/use-admin-stills';
import { tickMinuteClock, useMinuteClock } from '../companion/minute-clock';
import { useMonStore } from '../mon/mon.store';
import { callerSummary } from './caller-model';
import { callerCopy, daysTogetherLine } from './copy';
import { useProfile } from './profile.store';

// STRUCK 2026-10-17: the starter's tags (Design/Mobile/Web), stats
// (Projects/Followers/Following), @handle, "Edit profile" (onPress did
// nothing) and the editable Name/Email card (edits never reached the save).
// None had a backing source. They return with one, not as placeholders.

/** The save, summarised for this page; recomputed only when the save or the minute changes. */
function useCallerSummary() {
  // The (home) layout drives the clock; read it fresh here too, in case that layout is not mounted.
  useEffect(tickMinuteClock, []);
  const save = useMonStore((s) => s.save);
  const nowMs = useMinuteClock((s) => s.nowMs);
  return useMemo(() => ({ hydrated: save !== undefined, summary: callerSummary(save, nowMs) }), [save, nowMs]);
}

/**
 * Avatar, name and "Caller since". `surface="night"` styles it for the ink
 * plate the web hero lays it on (explicit palette steps: themed tokens follow
 * the page's scheme). Measured in packages/theme/contrast.ts ('profile
 * identity on ink plate').
 */
export function ProfileIdentity({ surface = 'page' }: { surface?: 'page' | 'night' }) {
  const p = useProfile();
  const createdAt = useMonStore((s) => s.save?.caller?.createdAt);
  const night = surface === 'night';
  // An empty heading reads as a broken page; say the name is missing instead.
  const name = p.name || copy('profile.name.empty');
  const since =
    createdAt === undefined
      ? null
      : callerCopy('caller.since', { date: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(createdAt)) });
  return (
    <View testID="caller-identity" className="flex-row flex-wrap items-center gap-5 md:gap-6">
      <ScaleIn delay={60}>
        <Avatar name={p.name} size="xl" />
      </ScaleIn>
      <View className="min-w-40 flex-1 gap-1">
        {night ? (
          <>
            <Text variant="label" className="text-silver-300">{callerCopy('caller.label')}</Text>
            <Heading level={1} size="display-sm" className="text-orange-500">{name}</Heading>
            {since !== null ? <Text className="text-silver-300">{since}</Text> : null}
          </>
        ) : (
          <>
            <Text variant="label" tone="muted">{callerCopy('caller.label')}</Text>
            <Heading level={1} size="display-sm">{name}</Heading>
            {since !== null ? <Text testID="caller-since" tone="muted">{since}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

/** One count as a quiet line, figures aligned: no KPI cards. */
function RecordLine({ label, count, testID }: { label: string; count: number; testID: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={callerCopy('caller.record.a11y', { label, count })}
      className="min-h-target flex-row items-center justify-between border-b border-border py-3"
    >
      <Text>{label}</Text>
      <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{String(count)}</Text>
    </View>
  );
}

/** Eggs hatched and the journal's highlights. */
export function CallerRecord() {
  const { hydrated, summary } = useCallerSummary();
  if (!hydrated) return <LoadingSkeleton variant="line" count={2} />;
  return (
    <Section className="gap-1">
      <Text variant="label" tone="muted" accessibilityRole="header">{callerCopy('caller.record.title')}</Text>
      <RecordLine testID="caller-hatched" label={callerCopy('caller.record.hatched')} count={summary.eggsHatched} />
      <RecordLine testID="caller-highlights" label={callerCopy('caller.record.highlights')} count={summary.journalHighlights} />
    </Section>
  );
}

/** Each Mon in the save: still, name, stage, days together. Opens its Dex page. */
export function MonsRaised() {
  const router = useRouter();
  const { hydrated, summary } = useCallerSummary();
  const stills = useAdminStills();
  let body: ReactNode;
  if (!hydrated) {
    body = (
      <View accessible accessibilityLabel={callerCopy('caller.loading.a11y')}>
        <LoadingSkeleton variant="card" />
      </View>
    );
  } else if (summary.mons.length === 0) {
    body = (
      <Text testID="caller-mons-empty" tone="muted">
        {callerCopy(summary.eggPending ? 'caller.mons.empty.egg' : 'caller.mons.empty')}
      </Text>
    );
  } else {
    body = summary.mons.map(({ mon, daysTogether }) => {
      const who = monIdentity(mon, stills);
      const stage = callerCopy('caller.mons.stage', { stage: mon.stage });
      const days = daysTogetherLine(daysTogether);
      return (
        <View key={mon.monInstanceId} testID={`caller-mon-${mon.monInstanceId}`}>
          <PressScale
            aria-label={callerCopy('caller.mons.row.a11y', { name: who.name, stage: mon.stage, days })}
            onPress={() => router.push(`/mon/${mon.monInstanceId}`)}
            className="min-h-target w-full flex-row items-center gap-4 border-2 border-border bg-surface-raised p-3 md:p-4"
            outerClassName="w-full"
          >
            <View className="h-16 w-16 overflow-hidden bg-surface md:h-20 md:w-20">
              {who.art !== undefined ? (
                <Image src={who.art.source as ImageProps['src']} alt="" fill framed={false} unoptimized className="h-full w-full" />
              ) : null}
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="heading">{who.name}</Text>
              <Text variant="caption" tone="muted">{stage}</Text>
              <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{days}</Text>
            </View>
            <ChevronRight size={18} className="text-text-muted" />
          </PressScale>
        </View>
      );
    });
  }
  return (
    <Section className="gap-3">
      <Text variant="label" tone="muted" accessibilityRole="header">{callerCopy('caller.mons.title')}</Text>
      {body}
    </Section>
  );
}

function EntryRow({ testID, icon, title, detail, label, onPress }: {
  testID: string; icon: ReactNode; title: string; detail: string; label: string; onPress: () => void;
}) {
  return (
    <View testID={testID}>
      <PressScale
        aria-label={label}
        onPress={onPress}
        className="min-h-target w-full flex-row items-center gap-3 rounded-none border-2 border-border bg-surface-raised p-4 shadow-card"
        outerClassName="w-full"
      >
        <View className="h-10 w-10 items-center justify-center rounded-none bg-primary/10">{icon}</View>
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{title}</Text>
          <Text variant="caption" tone="muted">{detail}</Text>
        </View>
        <ChevronRight size={18} className="text-text-muted" />
      </PressScale>
    </View>
  );
}

/**
 * The ways into Settings and Account. Both land on the Settings page: the
 * account controls (Caller name, sign out, delete) are its account cards,
 * and no separate Account route exists to send the second row to.
 */
export function ProfileDetails() {
  const router = useRouter();
  return (
    <FadeIn delay={140}>
      <View className="gap-3 md:gap-4">
        <EntryRow
          testID="caller-settings"
          icon={<SettingsIcon size={20} className="text-text" />}
          title={callerCopy('caller.settings.title')}
          detail={callerCopy('caller.settings.detail')}
          label={callerCopy('caller.settings.a11y')}
          onPress={() => router.push('/settings')}
        />
        <EntryRow
          testID="caller-account"
          icon={<KeyRound size={20} className="text-text" />}
          title={callerCopy('caller.account.title')}
          detail={callerCopy('caller.account.detail')}
          label={callerCopy('caller.account.a11y')}
          onPress={() => router.push('/settings')}
        />
      </View>
    </FadeIn>
  );
}

/** Identity, then the record: the primary pane. */
export function ProfileSummary() {
  return (
    <FadeIn>
      <View className="gap-6 md:gap-10">
        <Section className="gap-4">
          <ProfileIdentity />
        </Section>
        <CallerRecord />
      </View>
    </FadeIn>
  );
}

/** The Mons raised, then Settings and Account: the secondary pane. */
export function ProfileSecondary() {
  return (
    <View className="gap-6 md:gap-10">
      <MonsRaised />
      <ProfileDetails />
    </View>
  );
}

export function ProfileContent() {
  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <ProfileSummary />
      <ProfileSecondary />
    </View>
  );
}
