import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandWordmark } from '@acme/ui';
import { HEADER_CONTROL_PT, appHeaderLayout } from '@acme/app/features/navigation/header-metrics.ts';
import { Header } from '@acme/ui/primitives';
import { Pressable, Text, View } from '@acme/ui/tw';
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
/** Page names shown after the wordmark. */
const TITLES: Record<string, string> = {
  '/notifications': 'Notifications',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

export function AppHeader({ back }: { /** The shell's Back, drawn before the wordmark at the bar's left edge. */ back?: ReactNode }) {
  const pathname = usePathname() ?? '/';
  // The menu button lives in the shell (the rail's foot or the phone bar), not here.
  const router = useRouter();
  // One height on every route. The top inset is the window's (the provider's),
  // not a SafeAreaView's own measurement, which is taken per native view: with
  // one, the bar's keyline sat 16 pt lower on /sync than on /home. The bar is fixed,
  // so neither a title nor the Back button can grow it.
  const { top } = useSafeAreaInsets();
  const layout = appHeaderLayout({ topInset: top, back: back != null });

  return (
    <View style={{ height: layout.height, paddingTop: top }} className="bg-ink-950">
      {/* The wordmark is orange with a royal keyline, so an orange bar would
          swallow it. The logo is never recoloured; the bar moved to night
          instead, with the orange as its bottom keyline. */}
      <Header style={{ height: layout.bar }} className="flex-row items-center gap-3 border-b-2 border-primary bg-ink-950 px-4">
        {/* Back sits where native apps put it, at the left edge before the logo
            (RootShell decides when there is one), in the bar's 44 pt control slot. */}
        {back}
        {/* Full control height, so the wordmark matches the 44 pt controls. */}
        <BrandWordmark height={HEADER_CONTROL_PT} />
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
          // The header only draws on rail hardware (tablets, foldables); 6pt off the right edge there.
          onPress={() => router.push('/notifications')}
          className="relative mr-[6px] h-11 w-11 items-center justify-center rounded-none border-2 border-border bg-surface-raised transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
        >
          <Bell size={20} className="text-accent" />
          <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
        </Pressable>

      </Header>
    </View>
  );
}
