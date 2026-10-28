import { Redirect, usePathname, useRouter } from 'expo-router';
import { View } from '@acme/ui/tw';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveNavigationPlacement } from '@acme/ui/adaptive-panes/parts';
import { ShellDrawer } from '@acme/app/features/navigation/ShellNav.tsx';
import { activeDrawerItem } from '@acme/app/features/navigation/shell-destinations.ts';
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { palette } from '@acme/theme';
import { readSave } from '@acme/app/features/onboarding/save-store.ts';
import { DrawerContent } from '../../components/DrawerContent';
import { AppHeader } from '../../components/AppHeader';

export default function DrawerLayout() {
  const isDark = useColorScheme() === 'dark';
  // drawerStyle takes a number, so the md breakpoint is read through Uniwind:
  // 270 on phones, 360 from md (tablets), where the rows and type grow too.
  const { width: drawerWidth } = useResolveClassNames('w-[270px] md:w-[360px]') as { width?: number };
  const placement = useAdaptiveNavigationPlacement();
  const insets = useSafeAreaInsets();
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  // Boot (`/`) decides where a player belongs; a deep link (nycmon:///game)
  // skips it. Without a Caller the lobby's START has no identity to start a
  // session with and silently does nothing, so send the player back through
  // boot, which resumes onboarding at the step they still owe.
  if (!readSave()?.caller) return <Redirect href="/" />;

  // The shell's drawer (right side, beside the rail or above the phone bar)
  // replaces the navigator's left-edge drawer, which is kept only as the route
  // container: its swipe is off and nothing opens it.
  return (
    <View className="flex-1">
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        // Every drawer route gets the app bar.
        header: () => <AppHeader />,
        drawerType: 'front',
        drawerStyle: {
          width: drawerWidth ?? 270,
          backgroundColor: isDark ? palette.ink[900] : palette.ink[50],
        },
        overlayColor: 'rgba(0,0,0,0.6)',
        swipeEnabled: false,
      }}
    >
      {/* The header runs across the top on rail hardware (the foldable shell); phones keep the full height. */}
      <Drawer.Screen name="(tabs)" options={{ headerShown: placement.rail }} />
    </Drawer>
    <ShellDrawer
      insets={{ top: insets.top, bottom: insets.bottom, left: insets.left }}
      active={activeDrawerItem(pathname)}
      onSelect={(href) => router.push(href as never)}
    />
    </View>
  );
}
