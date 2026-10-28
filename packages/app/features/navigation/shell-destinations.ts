// The app's top-level places, shared by every native navigation shell.
// Pure: no react-native import, so node --test covers it.
// SOT: docs/canon/GAMEPLAY_BIBLE_V12.md "Native navigation canon" (the five primary tabs)
// SOT-KEYWORDS: shell rail drawer destinations home game hlynk mons caller physical right

/** The canon's five primary tabs, in canon order. */
export type ShellDestinationName = 'home' | 'game' | 'hlynk' | 'mons' | 'caller';

export interface ShellDestination {
  readonly name: ShellDestinationName;
  readonly label: string;
  /** The raised centre action (H-LYNK). */
  readonly raised: boolean;
}

/**
 * HOME, GAME, H-LYNK (raised centre), MONS, CALLER. Where each one goes is
 * decided at press time by the host (`shellHref`), because MONS needs the
 * active Mon and H-LYNK opens the device's own menu rather than a route.
 */
export const SHELL_DESTINATIONS: readonly ShellDestination[] = [
  { name: 'home', label: 'HOME', raised: false },
  { name: 'game', label: 'GAME', raised: false },
  { name: 'hlynk', label: 'H-LYNK', raised: true },
  { name: 'mons', label: 'MONS', raised: false },
  { name: 'caller', label: 'CALLER', raised: false },
];

export function isShellDestination(name: string): name is ShellDestinationName {
  return SHELL_DESTINATIONS.some((d) => d.name === name);
}

export function shellDestination(name: ShellDestinationName): ShellDestination {
  const found = SHELL_DESTINATIONS.find((d) => d.name === name);
  if (!found) throw new Error(`Unknown shell destination: ${name}`);
  return found;
}

/**
 * The route a primary tab opens. MONS is the species index; until it exists
 * it opens the active Mon's Dex page, and HOME when there is no Mon yet.
 * H-LYNK opens the companion stage (the host also opens the device menu).
 */
export function shellHref(name: ShellDestinationName, activeMonId: string | undefined): string {
  switch (name) {
    case 'home':
    case 'hlynk':
      return '/(home)';
    case 'game':
      return '/game';
    case 'mons':
      return activeMonId === undefined ? '/(home)' : `/(home)/mon/${activeMonId}`;
    case 'caller':
      return '/profile';
  }
}

/**
 * Which primary tab a path belongs to. The `(home)` group's Dex routes are
 * MONS; the rest of the companion loop is H-LYNK; HOME is the bare landing.
 */
export function activeShellDestination(pathname: string): ShellDestinationName | null {
  if (pathname.startsWith('/game')) return 'game';
  if (pathname.startsWith('/profile')) return 'caller';
  if (pathname.startsWith('/mon/')) return 'mons';
  if (pathname === '/' || pathname === '') return 'home';
  if (/^\/(feed|rest|social|journal|name|hatch)\b/.test(pathname)) return 'hlynk';
  return null;
}

/** The drawer: everything that is not a primary tab. */
export type ShellDrawerItemName = 'alerts' | 'journal' | 'settings' | 'controls' | 'legal';

export interface ShellDrawerItem {
  readonly name: ShellDrawerItemName;
  readonly label: string;
  readonly href: string;
}

export const SHELL_DRAWER_ITEMS: readonly ShellDrawerItem[] = [
  { name: 'alerts', label: 'Alerts', href: '/notifications' },
  { name: 'journal', label: 'Journal', href: '/(home)/journal' },
  { name: 'settings', label: 'Settings', href: '/(home)/settings' },
  { name: 'controls', label: 'Game controls', href: '/game-controls' },
  { name: 'legal', label: 'Legal', href: '/legal/terms' },
];

/** The drawer row a path belongs to, for its selected state. */
export function activeDrawerItem(pathname: string): ShellDrawerItemName | null {
  const hit = SHELL_DRAWER_ITEMS.find((item) => pathname.startsWith(item.href.replace('/(home)', '')));
  return hit?.name ?? null;
}

/** Shell spacing (pt), the foldable layout: items 20 below the header, menu 30 above the bottom, drawer 10 above the menu. */
export const SHELL_SPACING = { itemsBelowHeader: 20, menuFromBottom: 30, drawerAboveMenu: 10 } as const;
