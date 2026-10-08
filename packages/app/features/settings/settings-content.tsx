'use client';
// Settings — reached from Profile. Preferences, appearance, and session
// controls live here; identity stays on the profile screen.
import { Section, View } from '@acme/ui/tw';
import { Button, Card, Heading, SegmentedControl, Switch, Text, FadeIn } from '@acme/ui';
import { useProfile, type ThemePreference } from '../profile/profile.store';

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

      <FadeIn delay={200}>
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
