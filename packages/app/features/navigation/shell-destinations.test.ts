import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHELL_DESTINATIONS,
  SHELL_DRAWER_ITEMS,
  SHELL_SPACING,
  activeDrawerItem,
  activeShellDestination,
  isShellDestination,
  shellChromeVisible,
  shellHref,
} from './shell-destinations.ts';
import { HEADER_BAR_PT } from './header-metrics.ts';

describe('shell destinations', () => {
  it('is the canon five, in canon order, with H-LYNK raised in the centre', () => {
    assert.deepEqual(SHELL_DESTINATIONS.map((d) => d.label), ['HOME', 'GAME', 'H-LYNK', 'MONS', 'CALLER']);
    assert.deepEqual(SHELL_DESTINATIONS.filter((d) => d.raised).map((d) => d.name), ['hlynk']);
    assert.equal(SHELL_DESTINATIONS[2]?.name, 'hlynk');
  });

  it('routes each tab; HOME is the hub, MONS is the species index with or without a Mon', () => {
    assert.equal(shellHref('home', 'm1'), '/home');
    assert.equal(shellHref('home', undefined), '/home');
    assert.equal(shellHref('game', 'm1'), '/game');
    assert.equal(shellHref('hlynk', 'm1'), '/(home)');
    assert.equal(shellHref('mons', 'm1'), '/mons');
    assert.equal(shellHref('mons', undefined), '/mons');
    assert.equal(shellHref('caller', 'm1'), '/profile');
  });

  it('selects the tab a path belongs to', () => {
    assert.equal(activeShellDestination('/home'), 'home');
    assert.equal(activeShellDestination('/'), 'hlynk');
    assert.equal(activeShellDestination('/homework'), null);
    assert.equal(activeShellDestination('/game'), 'game');
    assert.equal(activeShellDestination('/feed'), 'hlynk');
    assert.equal(activeShellDestination('/mon/abc'), 'mons');
    assert.equal(activeShellDestination('/mons'), 'mons');
    assert.equal(activeShellDestination('/mons/dex-002'), 'mons');
    assert.equal(activeShellDestination('/monster'), null);
    assert.equal(activeShellDestination('/profile'), 'caller');
    assert.equal(activeShellDestination('/settings'), null);
    assert.equal(isShellDestination('feed'), false);
  });

  it('puts everything that is not a primary tab in the drawer', () => {
    assert.deepEqual(SHELL_DRAWER_ITEMS.map((i) => i.name), ['alerts', 'journal', 'settings', 'controls', 'legal']);
    assert.equal(activeDrawerItem('/settings'), 'settings');
    assert.equal(activeDrawerItem('/notifications'), 'alerts');
    assert.equal(activeDrawerItem('/game'), null);
  });

  it('uses the foldable shell spacing', () => {
    assert.deepEqual({ ...SHELL_SPACING }, { itemsBelowHeader: 80, menuFromBottom: 30, drawerAboveMenu: 10 });
  });

  it('fits the rail column (80 pt top) on a 12.9-inch iPad Pro in landscape and a spanned Surface Duo', () => {
    // Heights from ShellNav's classes at md: a tab is py-2 + 22 pt icon + gap-1 + a 16 pt label line (58);
    // H-LYNK swaps the icon for the 48 pt tile (84); avatar 56 + 10 margin; menu 56; gap-2 between the 8 children.
    const column = (bottomInset: number) =>
      SHELL_SPACING.itemsBelowHeader + 4 * 58 + 84 + 7 * 8 + 56 + 10 + 56 + bottomInset + SHELL_SPACING.menuFromBottom;
    const header = (topInset: number) => topInset + HEADER_BAR_PT;
    // iPad Pro 12.9-inch landscape: 1024 pt tall, 24 pt top inset, 20 pt home indicator.
    assert.ok(column(20) <= 1024 - header(24), `iPad: ${column(20)} > ${1024 - header(24)}`);
    // Surface Duo spanned landscape: 720 dp tall, 24 dp status bar, up to 24 dp gesture bar.
    assert.ok(column(24) <= 720 - header(24), `Duo: ${column(24)} > ${720 - header(24)}`);
  });

  it('shows the shell on tabs and companion screens, hides it on full-window flows', () => {
    for (const p of ['/', '/home', '/game', '/mons', '/profile', '/feed', '/settings', '/sync', '/error']) assert.equal(shellChromeVisible(p), true, p);
    for (const p of ['/welcome', '/age', '/sign-in', '/consent', '/caller', '/meet', '/incubate', '/hatch', '/legal/terms']) assert.equal(shellChromeVisible(p), false, p);
  });
});
