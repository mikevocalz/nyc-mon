import { Tabs } from 'expo-router';
import { useAdaptiveNavigationPlacement } from '@acme/ui/adaptive-panes';
import { AppTabBar } from '../../../components/AppTabBar';

/*
  WHERE THE BAR GOES is the kit's Material 3 Adaptive policy
  (`resolveAdaptiveNavigationPlacement`, packages/ui/adaptive-navigation.ts),
  fed by the window size class, the window height and the native fold posture:

  - compact width (<600dp): bottom bar
  - Android tabletop posture, or a window under 480dp tall: bottom bar, so a
    half-open foldable or a landscape phone keeps its height for content
  - otherwise: a rail on the logical leading edge (right in RTL)

  This is NOT the kit's REGULAR_MIN_WIDTH (768). That constant governs when a
  layout earns a second pane; the rail switches earlier, at the width where a
  full-width bottom bar starts wasting a wide window's vertical space.

  `placement.expanded` (extra-large windows) asks for Material's expanded rail
  with labels beside icons; AppTabBar draws it at the theme's
  `navChrome.railExpanded` width (240dp) and the 80dp rail otherwise.
*/

/**
 * These are expo-router's JS tabs, not `NativeTabs`.
 *
 * TRADE-OFF, made deliberately: `NativeTabs` renders the real platform bar, but
 * its only repositioning prop is `sidebarAdaptable`, which expo-router
 * documents as iOS 18+ iPad/macOS and explicitly a no-op elsewhere — it cannot
 * produce an Android navigation rail at all. `tabBarPosition` exists only on
 * the JS tabs, so a rail on Android means giving up the native bar. In exchange
 * the rail is identical on both platforms and carries the app's own styling.
 */
export default function TabLayout() {
  const placement = useAdaptiveNavigationPlacement();
  const rail = placement.rail;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: placement.position,
      }}
      tabBar={(props) => <AppTabBar {...props} rail={rail} expanded={placement.expanded} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Grid' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
