import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHELL_DESTINATIONS,
  SHELL_DRAWER_ITEMS,
  SHELL_SPACING,
  activeDrawerItem,
  activeShellDestination,
  isShellDestination,
  shellHref,
} from './shell-destinations.ts';

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
    assert.deepEqual({ ...SHELL_SPACING }, { itemsBelowHeader: 20, menuFromBottom: 30, drawerAboveMenu: 10 });
  });
});
