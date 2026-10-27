'use client';
// Settings — reached from Profile. Preferences, appearance, and session
// controls live here; identity stays on the profile screen.
import { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import { AuthProviderButton, Button, Card, ErrorMessage, Heading, SegmentedControl, Switch, Text, FadeIn } from '@acme/ui';
import { useProfile, type ThemePreference } from '../profile/profile.store';
import { auth } from '../onboarding/auth';
import { CITY_MAP_ASSETS, CITY_MAP_DERIVED, CITY_MAP_SOURCES } from '../game/map-data-credit';
import { EXPERIMENTAL_WORLD_PHYSICAL } from '../game/world/physical-look.ts';
import { useTimeOfDay } from '../game/world/time-of-day.store.ts';
import { SOFTWARE_CREDITS, SOFTWARE_CREDITS_GROUP } from './software-credits.ts';
import { TimeOfDayRow } from './TimeOfDayRow';

/** The game-control settings route (apps/mobile/app/(drawer)/game-controls.tsx). */
const GAME_CONTROLS_PATH = '/game-controls';

/** Layout classes a parent grid hands each settings card (on its FadeIn). */
interface CellProps {
  className?: string;
}

/**
 * The native tablet portrait grid: below md a plain `gap-6` column (the
 * phone layout, unchanged); from md the cards pair into two columns. RN has
 * no CSS grid, so it is a wrapping row with half-width cells whose padding
 * makes the gutter, and a negative margin that cancels it at the edges.
 */
export const SETTINGS_GRID = 'gap-6 md:-mx-3 md:flex-row md:flex-wrap md:gap-x-0 md:gap-y-10 lg:gap-y-12';
const GRID_CELL = 'md:w-1/2 md:px-3';
/** Long cards (the credits list, the session actions) span both columns. */
const GRID_CELL_WIDE = 'md:w-full md:px-3';

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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemeSegment() {
  const theme = useProfile((s) => s.theme);
  const setTheme = useProfile((s) => s.setTheme);
  return <SegmentedControl aria-label="Theme" options={THEME_OPTIONS} value={theme} onChange={setTheme} className="self-start" />;
}

/** Title and one line of context. */
export function SettingsHeader() {
  return (
    <FadeIn>
      <Section className="gap-1">
        <Heading level={1} size="display-sm">Settings</Heading>
        <Text tone="muted">Notifications, appearance, and your session.</Text>
      </Section>
    </FadeIn>
  );
}

/**
 * The cards that tune the app on this device: Preferences, Appearance,
 * Graphics and Game. Siblings, so they drop into a `gap-*` column or, with
 * `grid`, into {@linkcode SETTINGS_GRID}.
 */
export function SettingsDeviceCards({ grid = false }: { grid?: boolean }) {
  const p = useProfile();
  const cell = grid ? GRID_CELL : undefined;
  return (
    <>
      <FadeIn delay={80} className={cell}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Preferences</Text>
            <Text variant="caption" tone="muted">Notifications and visibility.</Text>
          </View>
          <Switch value={p.notifications} onChange={p.setNotifications} label="Push notifications" />
          <Switch value={p.digest} onChange={p.setDigest} label="Weekly email digest" />
          <Switch value={p.publicProfile} onChange={p.setPublicProfile} label="Public profile" />
        </Card>
      </FadeIn>

      <FadeIn delay={140} className={cell}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Appearance</Text>
            <Text variant="caption" tone="muted">Follow the device, or pick a side.</Text>
          </View>
          <ThemeSegment />
        </Card>
      </FadeIn>

      <GraphicsCard className={cell} />

      <GameControlsRow className={cell} />
    </>
  );
}

/**
 * The account cards: the Amazon link (web), Legal & credits and Session.
 * Same sibling contract as {@linkcode SettingsDeviceCards}.
 */
export function SettingsAccountCards({ grid = false }: { grid?: boolean }) {
  const wide = grid ? GRID_CELL_WIDE : undefined;
  return (
    <>
      <AmazonAccountLink className={grid ? GRID_CELL : undefined} />

      <FadeIn delay={220} className={wide}>
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="heading">Legal &amp; credits</Text>
            {/* Interim UX copy (sentence case, pending A1 copy): one row per
                record source in the bundled city dataset. */}
            <Text variant="caption" tone="muted">Map data</Text>
            {CITY_MAP_SOURCES.map((source) => (
              <View key={source.attribution} className="gap-0.5">
                <Text variant="caption">{source.attribution}</Text>
                <Text
                  variant="caption"
                  tone="muted"
                  onPress={() => void Linking.openURL(source.licenseUrl)}
                  accessibilityRole="link"
                >
                  {source.license}
                </Text>
              </View>
            ))}
            {/* ODbL §4.4(a): the bundled tile's own licence grant, beside
                the source licences. */}
            <View className="gap-0.5">
              <Text variant="caption">{CITY_MAP_DERIVED.attribution}</Text>
              <Text
                variant="caption"
                tone="muted"
                onPress={() => void Linking.openURL(CITY_MAP_DERIVED.licenseUrl)}
                accessibilityRole="link"
              >
                {CITY_MAP_DERIVED.license}
              </Text>
            </View>
            <Text variant="caption" tone="muted">Models &amp; textures</Text>
            {CITY_MAP_ASSETS.map((source) => (
              <View key={source.attribution} className="gap-0.5">
                <Text variant="caption">{source.attribution}</Text>
                <Text
                  variant="caption"
                  tone="muted"
                  onPress={() => void Linking.openURL(source.licenseUrl)}
                  accessibilityRole="link"
                >
                  {source.license}
                </Text>
              </View>
            ))}
            {/* Code, not data: its own group so it never reads as a map-data credit. */}
            <Text variant="caption" tone="muted">{SOFTWARE_CREDITS_GROUP}</Text>
            {SOFTWARE_CREDITS.map((credit) => (
              <View key={credit.url} className="gap-0.5">
                <Text variant="caption">{credit.line}</Text>
                <Text
                  variant="caption"
                  tone="muted"
                  onPress={() => void Linking.openURL(credit.url)}
                  accessibilityRole="link"
                >
                  {credit.linkLabel}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={260} className={wide}>
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="heading">Session</Text>
            <Text variant="caption" tone="muted">Sign out on this device only.</Text>
          </View>
          <View className="flex-row gap-3">
            <Button title="Sign out" variant="outline" onPress={() => {}} />
            <Button title="Delete account" variant="danger" onPress={() => {}} />
          </View>
        </Card>
      </FadeIn>
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
