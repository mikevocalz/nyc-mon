import { useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { BrandWordmark, SafeArea } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Text } from '@acme/ui/tw';
import { AVATAR_URI, MenuButton, useProfile } from '@acme/app';
import { useRouter } from 'expo-router';
import { Avatar } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import { Bell } from '@acme/ui/icons';

/**
 * The app bar for every drawer route.
 *
 * The drawer previously ran with `headerShown: false` and only the split route
 * drew a header of its own, so the tab screens had no title and no way back to
 * the drawer except the edge swipe. This renders the same row the split route
 * already uses, so both look like one app.
 *
 * The title comes from the path rather than navigation options because the
 * drawer's child is the whole `(tabs)` group — its options carry the group's
 * name, not the focused tab's. This uses expo-router's `usePathname`: solito's
 * does not update when the native tab bar switches tabs, so the title stuck on
 * "Home" no matter which tab was showing.
 */
/** Routes rendered inside the tab navigator, and so behind the rail. */
const TAB_PATHS = new Set(['/', '/explore', '/notifications', '/profile']);

/** Page names shown after the wordmark. Home shows the wordmark alone. */
const TITLES: Record<string, string> = {
  '/explore': 'Explore',
  '/notifications': 'Notifications',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  // On rail-sized screens the drawer toggle lives at the foot of the rail, so
  // the header must not show a second one — but ONLY on the tab routes, which
  // are the only ones the rail renders on. Hiding it everywhere left Settings
  // with no way into the drawer at all.
  const { width } = useWindowDimensions();
  const railHasMenu = width >= 600 && TAB_PATHS.has(pathname);
  const router = useRouter();
  const profileName = useProfile((state) => state.name);

  return (
    <SafeArea edges={['top']} className="bg-ink-950">
      {/* The wordmark is orange with a royal keyline, so an orange bar would
          swallow it. The logo is never recoloured; the bar moved to night
          instead, with the orange as its bottom keyline. */}
      <Header className="flex-row items-center gap-3 border-b-2 border-primary bg-ink-950 px-4 py-2">
        {railHasMenu ? null : <MenuButton />}
        <BrandWordmark height={36} />
        <Text numberOfLines={1} className="flex-1 text-lg font-semibold text-ink-50 md:text-xl">
          {TITLES[pathname] ?? ''}
        </Text>

        {/* Notifications and profile live here rather than inside the Home
            screen's greeting block: they are app-level destinations reachable
            from every screen, and burying them in one screen's content meant
            they scrolled away. White slabs with an accent icon, matching the
            pane toggles, so controls on the primary field read as one set. */}
        <Pressable
          aria-label="Notifications"
          onPress={() => router.push('/notifications')}
          className="relative h-11 w-11 items-center justify-center rounded-none border-2 border-border bg-surface-raised transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
        >
          <Bell size={20} className="text-accent" />
          <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
        </Pressable>

        <Pressable
          aria-label="Profile"
          onPress={() => router.push('/profile')}
          className="rounded-none"
        >
          <Avatar name={profileName} imageUri={AVATAR_URI} />
        </Pressable>
      </Header>
    </SafeArea>
  );
}
