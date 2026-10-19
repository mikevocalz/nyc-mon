'use client';
// Shared profile sections — identity, account, preferences, session.
// One screen owns the whole "you" surface; settings live here, not on a
// separate route (design decision: fewer places, clearer map).
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import { Avatar, Heading, PressScale, Text, FadeIn, ScaleIn } from '@acme/ui';
import { Settings as SettingsIcon, ChevronRight } from '@acme/ui/icons';
import { useProfile } from './profile.store';

// STRUCK 2026-10-17: the starter's tags (Design/Mobile/Web), stats
// (Projects/Followers/Following), @handle, "Edit profile" (onPress did
// nothing) and the editable Name/Email card (edits never reached the save).
// None had a backing source. They return with one, not as placeholders.

/**
 * Avatar, name and handle. `surface="night"` styles it for the ink plate the
 * web hero lays it on (explicit palette steps: themed tokens follow the
 * page's scheme). Measured in packages/theme/contrast.ts ('profile identity
 * on ink plate'). On the page it carries the edit button inline.
 */
export function ProfileIdentity({ surface = 'page' }: { surface?: 'page' | 'night' }) {
  const p = useProfile();
  const night = surface === 'night';
  return (
    <View className="flex-row flex-wrap items-center gap-5">
      <ScaleIn delay={60}>
        <Avatar name={p.name} size="xl" />
      </ScaleIn>
      <View className="min-w-40 flex-1 gap-1">
        {night ? (
          <>
            <Text variant="label" className="text-silver-300">Account</Text>
            <Heading level={1} size="display-sm" className="text-orange-500">{p.name}</Heading>
          </>
        ) : (
          <>
            <Text variant="label" tone="muted">Account</Text>
            <Heading level={1} size="display-sm">{p.name}</Heading>
          </>
        )}
      </View>
    </View>
  );
}



/** The way into settings. */
export function ProfileDetails() {
  const router = useRouter();
  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      {/* Settings entry — preferences, appearance, and session live there */}
      <FadeIn delay={140}>
        <PressScale
          aria-label="Open settings"
          onPress={() => router.push('/settings')}
          className="w-full flex-row items-center gap-3 rounded-none border-2 border-border bg-surface-raised p-4 shadow-card"
          outerClassName="w-full"
        >
          <View className="h-10 w-10 items-center justify-center rounded-none bg-primary/10">
            <SettingsIcon size={20} className="text-text" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="heading">Settings</Text>
            <Text variant="caption" tone="muted">Notifications, appearance, session.</Text>
          </View>
          <ChevronRight size={18} className="text-text-muted" />
        </PressScale>
      </FadeIn>
    </View>
  );
}

export function ProfileContent() {
  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-4">
          <ProfileIdentity />
        </Section>
      </FadeIn>
      <ProfileDetails />
    </View>
  );
}
