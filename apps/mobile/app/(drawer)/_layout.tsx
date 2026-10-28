import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { readSave } from '@acme/app/features/onboarding/save-store.ts';

/**
 * The (drawer) group is only a route container now. The shell (header, rail,
 * tab bar, drawer) is drawn once around the root stack (navigation/RootShell),
 * so this navigator draws no header, no drawer panel and opens no drawer.
 */
export default function DrawerLayout() {
  // Boot (`/`) decides where a player belongs; a deep link (nycmon:///game)
  // skips it. Without a Caller the lobby's START has no identity to start a
  // session with and silently does nothing, so send the player back through
  // boot, which resumes onboarding at the step they still owe.
  if (!readSave()?.caller) return <Redirect href="/" />;
  return (
    <Drawer screenOptions={{ headerShown: false, swipeEnabled: false, drawerStyle: { width: 0 } }}>
      <Drawer.Screen name="(tabs)" />
    </Drawer>
  );
}
