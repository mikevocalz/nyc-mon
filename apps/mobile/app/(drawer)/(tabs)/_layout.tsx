import { Tabs } from 'expo-router';

/*
  WHERE THE BAR GOES is decided by HARDWARE FAMILY, not window size
  (`resolveAdaptiveNavigationPlacement`, packages/ui/adaptive-navigation.ts;
  family detection in packages/ui/hardware-family.ts):

  - native ordinary phone: bottom tabs at every width, height and posture
  - native foldable or dual-screen (open, folded cover, book, tabletop),
    tablet and headset: a rail on the PHYSICAL right, also in RTL
  - native, family still unknown: the bootstrap bottom tabs. A missing hinge
    event never classifies a phone; once a family is verified it is kept for
    the process, so folding to the cover screen keeps the rail
  - web: never a side rail

  Window size chooses content panes independently (SplitView); here it only
  picks Material's expanded rail with labels (`placement.expanded`,
  extra-large windows), drawn at the theme's `navChrome.railExpanded` width
  (240dp) and the 80dp rail otherwise.

  `tabBarPositionForPlacement` converts the physical edge into the navigator's
  row slot: the tab view mirrors its row under RTL, so the physically-right
  rail is passed as `left` there. RTL itself stays on for text and content.
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      // The bar and rail are the root shell's (navigation/RootShell); none here.
      tabBar={() => null}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="game" options={{ title: 'Game' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
