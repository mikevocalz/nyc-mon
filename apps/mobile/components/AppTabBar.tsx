// Expo Router 58 exposes the JavaScript tab navigator and its public types
// from this stable export; do not reach into expo-router/build internals.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { usePathname } from 'expo-router';
import { ShellBottomBar, ShellRail } from '@acme/app/features/navigation/ShellNav.tsx';
import { activeShellDestination } from '@acme/app/features/navigation/shell-destinations.ts';
import { useShellNavigate } from '@acme/app/features/navigation/use-shell-navigate.ts';

export { RAIL_EXPANDED_WIDTH, RAIL_WIDTH } from '@acme/app/features/navigation/ShellNav.tsx';

/**
 * The `(tabs)` group's bar: the shell (packages/app/features/navigation), the
 * same rail and phone bar the `(home)` group draws. The canon's five primary
 * tabs; everything else is in the drawer the menu button opens.
 */
export function AppTabBar({ insets, rail, expanded = false }: BottomTabBarProps & { rail: boolean; expanded?: boolean }) {
  const pathname = usePathname() ?? '/';
  const navigate = useShellNavigate();
  const active = activeShellDestination(pathname);
  if (!rail) return <ShellBottomBar active={active} onSelect={navigate} bottomInset={insets.bottom} />;
  return <ShellRail active={active} expanded={expanded} insets={{ bottom: insets.bottom, right: insets.right }} onSelect={navigate} />;
}
