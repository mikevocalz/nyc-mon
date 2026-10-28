import { Slot } from 'expo-router';

/**
 * HOME, GAME, CALLER (and the drawer's Alerts) as plain routes. The shell
 * (navigation/RootShell) draws the rail and the bar and navigates by URL, so
 * this group keeps no tab state of its own. A tab navigator here showed its
 * last-focused tab when the root stack brought the group back, so GAME could
 * open the HOME hub.
 */
export default function TabLayout() {
  return <Slot />;
}
