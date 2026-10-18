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
import { CITY_MAP_ASSETS, CITY_MAP_SOURCES } from '../game/map-data-credit';

/** The game-control settings route (apps/mobile/app/(drawer)/game-controls.tsx). */
const GAME_CONTROLS_PATH = '/game-controls';

// Decision (2026-10-15, STRIKE on web): the Game tab never mounts on web
// (GameScreen.tsx), so the row that opens its controls is native only; a
// web row would land on a route that does not exist there.
function GameControlsRow() {
  const router = useRouter();
  if (process.env.EXPO_OS === 'web') return null;
  return (
    <FadeIn delay={170}>
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


function AmazonAccountLink() {
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
    <FadeIn delay={190}>
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

export function SettingsContent() {
  const p = useProfile();

  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Settings</Heading>
          <Text tone="muted">Notifications, appearance, and your session.</Text>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
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

      <FadeIn delay={140}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Appearance</Text>
            <Text variant="caption" tone="muted">Follow the device, or pick a side.</Text>
          </View>
          <ThemeSegment />
        </Card>
      </FadeIn>

      <GameControlsRow />

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
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={260}>
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
    </View>
  );
}
