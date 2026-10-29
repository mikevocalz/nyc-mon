import { Slot, Stack, usePathname } from 'expo-router';

/**
 * HOME, GAME, CALLER (and the drawer's Alerts) as plain routes. The shell
 * (navigation/RootShell) draws the rail and the bar and navigates by URL, so
 * this group keeps no tab state of its own. A tab navigator here showed its
 * last-focused tab when the root stack brought the group back, so GAME could
 * open the HOME hub.
 *
 * GAME turns off the root stack's swipe-back: the joystick sits at the left
 * edge, and a drag there must move the Caller, not leave the city.
 */
export default function TabLayout() {
  const inGame = (usePathname() ?? '').startsWith('/game');
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !inGame, fullScreenGestureEnabled: !inGame }} />
      <Slot />
    </>
  );
}
