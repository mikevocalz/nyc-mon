'use client';
// Settings — reached from Profile. Appearance, game, credits and account
// controls live here; identity stays on the profile screen.
import { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'solito/navigation';
import { Pressable, Section, View } from '@acme/ui/tw';
import { AuthProviderButton, Button, Card, ErrorMessage, Heading, ResponsiveDialog, SegmentedControl, Text, FadeIn, useInstanceStore, useStore } from '@acme/ui';
import { useProfile } from '../profile/profile.store';
import { auth } from '../onboarding/auth';
import { copy } from '../onboarding/copy';
import { CITY_MAP_ASSETS, CITY_MAP_DERIVED, CITY_MAP_SOURCES } from '../game/map-data-credit';
import { EXPERIMENTAL_WORLD_PHYSICAL } from '../game/world/physical-look.ts';
import { useTimeOfDay } from '../game/world/time-of-day.store.ts';
import { SOFTWARE_CREDITS, SOFTWARE_CREDITS_GROUP } from './software-credits.ts';
import { TimeOfDayRow } from './TimeOfDayRow';
import { CallerNameCard } from './CallerNameCard';
import { SIGNED_OUT_PATH, signOutHere } from './sign-out';
import { useDeleteAccountFlow, useHasAccount } from './delete-account';
import { DELETED_PATH } from './delete-account-model.ts';
import { hatchCopy } from '../hatch/copy';
import { THEME_OPTIONS } from './theme-options.ts';

/** The game-control settings route (apps/mobile/app/(drawer)/game-controls.tsx). */
const GAME_CONTROLS_PATH = '/game-controls';

/** Layout classes a parent hands a settings card (on its FadeIn). */
interface CellProps {
  className?: string;
}

// Decision (2026-10-15, STRIKE on web): the Game tab never mounts on web
// (GameScreen.tsx), so the row that opens its controls is native only; a
// web row would land on a route that does not exist there.
function GameControlsRow({ className }: CellProps) {
  const router = useRouter();
  if (process.env.EXPO_OS === 'web') return null;
  return (
    <FadeIn delay={170} className={className}>
      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="heading">Game</Text>
          <Text variant="caption" tone="muted">Stick, buttons, hand, haptics.</Text>
        </View>
        <Button title="Game controls" variant="outline" onPress={() => router.push(GAME_CONTROLS_PATH)} />
      </Card>
    </FadeIn>
  );
}

// The physically lit city's light preset (G2, D19). Native only for the
// same reason as GameControlsRow, and only under EXPO_PUBLIC_WORLD_PHYSICAL:
// with the flag off the city has one fixed look and the row would change
// nothing. Settings only; the HUD gains no control in this lane
// (docs/design/research/slop-grade-city-mobbin.md §§ 2–3).
function GraphicsCard({ className }: CellProps) {
  const preset = useTimeOfDay((s) => s.preset);
  const setPreset = useTimeOfDay((s) => s.setPreset);
  if (process.env.EXPO_OS === 'web' || !EXPERIMENTAL_WORLD_PHYSICAL) return null;
  return (
    <FadeIn delay={155} className={className}>
      <Card className="gap-4">
        <Text variant="heading">Graphics</Text>
        <TimeOfDayRow value={preset} onChange={setPreset} />
      </Card>
    </FadeIn>
  );
}

function AmazonAccountLink({ className }: CellProps) {
  const enabled = process.env.EXPO_OS === 'web' && process.env.EXPO_PUBLIC_AMAZON_AUTH_ENABLED === 'true';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  if (!enabled) return null;

  async function linkAmazon(): Promise<void> {
    setPending(true);
    setError(undefined);
    const result = await auth().linkSocial('amazon', window.location.href);
    if (!result.ok) {
      setError(
        result.error.status === 0
          ? "You're offline. Connect to the internet and try again."
          : "Amazon couldn't be linked right now. Try again in a minute.",
      );
      setPending(false);
    }
  }

  return (
    <FadeIn delay={190} className={className}>
      <Card className="gap-4">
        <View className="gap-1">
          <Text variant="heading">Amazon account</Text>
          <Text variant="caption" tone="muted">
            Link Amazon once, then use Amazon to sign in when Alexa+ asks for your NYC-MON account.
          </Text>
        </View>
        {error !== undefined ? <ErrorMessage message={error} /> : null}
        <AuthProviderButton
          provider="amazon"
          intent="sign-in"
          label="Link Amazon"
          loading={pending}
          disabled={pending}
          onPress={() => void linkAmazon()}
        />
      </Card>
    </FadeIn>
  );
}

function ThemeSegment() {
  const theme = useProfile((s) => s.theme);
  const setTheme = useProfile((s) => s.setTheme);
  return <SegmentedControl aria-label="Theme" options={[...THEME_OPTIONS]} value={theme} onChange={setTheme} className="self-start" />;
}

/**
 * One licence or source link in Legal & credits. The caption-sized words sit
 * inside a pressable at least `min-h-target` (48pt) tall, so the tap target
 * clears the 44pt floor on iOS and the 48dp floor on Android and web. On web
 * it is still announced as a link.
 */
function LicenceLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      className="min-h-target min-w-target self-start justify-center rounded-sm focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Text variant="caption" tone="muted" className="underline">{label}</Text>
    </Pressable>
  );
}

/**
 * M20 Delete account (App Store 5.1.1(v)). The row shows only when this
 * device has an account. The confirm step says what goes, and Cancel comes
 * first; a failure keeps the dialog open with the reason and a retry.
 */
function DeleteAccountRow() {
  const router = useRouter();
  const hasAccount = useHasAccount();
  const flow = useDeleteAccountFlow(() => router.replace(DELETED_PATH));
  if (!hasAccount) return null;
  return (
    <View className="gap-2 border-t border-border pt-3">
      <Text variant="caption" tone="muted">{copy('settings.delete.caption')}</Text>
      <View className="flex-row">
        <Button title={copy('settings.delete.label')} variant="danger" onPress={flow.ask} />
      </View>
      <ResponsiveDialog
        open={flow.confirming}
        onClose={flow.cancel}
        title={copy('settings.delete.confirm.title')}
        size="sm"
        footerAlign="right"
        actions={
          <>
            {/* Cancel first and in the primary look: the safe answer is the default. */}
            <Button title={hatchCopy('m09.edit.cancel')} variant="cta" disabled={flow.deleting} onPress={flow.cancel} />
            <Button
              title={flow.errorId === undefined ? copy('settings.delete.confirm.action') : copy('settings.delete.retry')}
              variant="danger"
              loading={flow.deleting}
              disabled={flow.deleting}
              onPress={() => void flow.confirm()}
            />
          </>
        }
      >
        <View className="gap-3">
          <Text>{copy('settings.delete.confirm.body')}</Text>
          {flow.errorId !== undefined ? <ErrorMessage message={copy(flow.errorId)} /> : null}
        </View>
      </ResponsiveDialog>
    </View>
  );
}

/** Session: Sign out ends the auth session here (signOutHere) and goes to sign-in. */
function SessionCard({ className }: CellProps) {
  const router = useRouter();
  const store = useInstanceStore(() => ({ pending: false, failed: false }));
  const pending = useStore(store, (s) => s.pending);
  const failed = useStore(store, (s) => s.failed);
  const signOut = async () => {
    store.setState({ pending: true, failed: false });
    if (await signOutHere()) {
      router.replace(SIGNED_OUT_PATH);
      return;
    }
    store.setState({ pending: false, failed: true });
  };
  return (
    <FadeIn delay={260} className={className}>
      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="heading">Session</Text>
          <Text variant="caption" tone="muted">{copy('settings.sign_out.caption')}</Text>
        </View>
        {failed ? <ErrorMessage message={copy('settings.sign_out.error')} /> : null}
        <View className="flex-row gap-3">
          <Button title={copy('settings.sign_out.label')} variant="outline" loading={pending} disabled={pending} onPress={() => void signOut()} />
        </View>
        <DeleteAccountRow />
      </Card>
    </FadeIn>
  );
}

/** Title and one line of context. */
export function SettingsHeader() {
  return (
    <FadeIn>
      <Section className="gap-1">
        <Heading level={1} size="display-sm">Settings</Heading>
        <Text tone="muted">Appearance, game and your account.</Text>
      </Section>
    </FadeIn>
  );
}

/**
 * The cards that tune the app on this device: Appearance, Graphics and
 * Game. Siblings, so they drop into any `gap-*` column.
 */
export function SettingsDeviceCards() {
  return (
    <>
      {/* STRUCK 2026-10-28: the Preferences card ("Push notifications",
          "Weekly email digest", "Public profile"). Each switch wrote an
          in-memory flag that nothing saved or read: no digest mail exists
          (the privacy notice says there is no marketing channel), there is
          no public profile, and the egg alert's permission lives in the
          Permission Center. They return with a real backing setting. */}
      <FadeIn delay={140}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Appearance</Text>
            <Text variant="caption" tone="muted">Follow the device, or pick a side.</Text>
          </View>
          <ThemeSegment />
        </Card>
      </FadeIn>

      <GraphicsCard />

      <GameControlsRow />
    </>
  );
}

/**
 * The account cards: the Amazon link (web), Legal & credits and Session.
 * Same sibling contract as {@linkcode SettingsDeviceCards}.
 */
export function SettingsAccountCards() {
  return (
    <>
      <CallerNameCard />
      <AmazonAccountLink />

      <FadeIn delay={220}>
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="heading">Legal &amp; credits</Text>
            {/* Interim UX copy (sentence case, pending A1 copy): one row per
                record source in the bundled city dataset. */}
            <Text variant="caption" tone="muted">Map data</Text>
            {CITY_MAP_SOURCES.map((source) => (
              <View key={source.attribution} className="gap-0.5">
                <Text variant="caption">{source.attribution}</Text>
                <LicenceLink label={source.license} url={source.licenseUrl} />
              </View>
            ))}
            {/* ODbL §4.4(a): the bundled tile's own licence grant, beside
                the source licences. */}
            <View className="gap-0.5">
              <Text variant="caption">{CITY_MAP_DERIVED.attribution}</Text>
              <LicenceLink label={CITY_MAP_DERIVED.license} url={CITY_MAP_DERIVED.licenseUrl} />
            </View>
            <Text variant="caption" tone="muted">Models &amp; textures</Text>
            {CITY_MAP_ASSETS.map((source) => (
              <View key={source.attribution} className="gap-0.5">
                <Text variant="caption">{source.attribution}</Text>
                <LicenceLink label={source.license} url={source.licenseUrl} />
              </View>
            ))}
            {/* Code, not data: its own group so it never reads as a map-data credit. */}
            <Text variant="caption" tone="muted">{SOFTWARE_CREDITS_GROUP}</Text>
            {SOFTWARE_CREDITS.map((credit) => (
              <View key={credit.url} className="gap-0.5">
                <Text variant="caption">{credit.line}</Text>
                <LicenceLink label={credit.linkLabel} url={credit.url} />
              </View>
            ))}
          </View>
        </Card>
      </FadeIn>

      <SessionCard />
    </>
  );
}

export function SettingsContent() {
  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <SettingsHeader />
      <SettingsDeviceCards />
      <SettingsAccountCards />
    </View>
  );
}
