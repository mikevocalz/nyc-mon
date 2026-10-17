'use client';
// Settings — reached from Profile. Preferences, appearance, and session
// controls live here; identity stays on the profile screen.
import { Linking } from 'react-native';
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import { Button, Card, Heading, SegmentedControl, Switch, Text, FadeIn } from '@acme/ui';
import { useProfile, type ThemePreference } from '../profile/profile.store';
import { CITY_MAP_ATTRIBUTION, CITY_MAP_LICENSE, CITY_MAP_LICENSE_URL } from '../game/map-data-credit';

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

      <FadeIn delay={200}>
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="heading">Legal &amp; credits</Text>
            <Text variant="caption" tone="muted">Map data</Text>
            <Text>{CITY_MAP_ATTRIBUTION}</Text>
            <Text variant="caption" tone="muted">
              NYC-Mon&apos;s 3D city uses OpenStreetMap data under the Open Database License ({CITY_MAP_LICENSE.replace('ODbL-', 'ODbL ')}).
            </Text>
          </View>
          <Button
            title="View map data license"
            variant="outline"
            onPress={() => void Linking.openURL(CITY_MAP_LICENSE_URL)}
          />
        </Card>
      </FadeIn>

      <FadeIn delay={240}>
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
