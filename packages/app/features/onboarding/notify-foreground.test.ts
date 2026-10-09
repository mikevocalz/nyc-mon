import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  QUIET_READY, SHOW_NOTIFICATION, createReadyBannerHold, foregroundBehavior, readyNotificationId,
} from './notify-foreground.ts';

const READY = (eggId: string) => ({ eggId, url: '/(home)/hatch' });

describe('readyNotificationId', () => {
  it('is the identifier the schedule call sets and M12 cancels', () => {
    assert.equal(readyNotificationId('egg-1'), 'egg-ready-egg-1');
  });
});

describe('foregroundBehavior (M11 foreground suppression)', () => {
  it('shows everything when M11 is not on screen', () => {
    assert.deepEqual(foregroundBehavior(READY('egg-1'), null), SHOW_NOTIFICATION);
  });

  it('drops the banner and sound, keeps the list entry, for the egg M11 is showing', () => {
    assert.deepEqual(foregroundBehavior(READY('egg-1'), 'egg-1'), QUIET_READY);
    assert.equal(QUIET_READY.shouldShowList, true);
    assert.equal(QUIET_READY.shouldShowBanner, false);
  });

  it('shows a ready notification for a different egg', () => {
    assert.deepEqual(foregroundBehavior(READY('egg-2'), 'egg-1'), SHOW_NOTIFICATION);
  });

  it('shows any payload that is not a hatch-ready one (Law 5)', () => {
    assert.deepEqual(foregroundBehavior({ eggId: 'egg-1', url: '/elsewhere' }, 'egg-1'), SHOW_NOTIFICATION);
    assert.deepEqual(foregroundBehavior(undefined, 'egg-1'), SHOW_NOTIFICATION);
  });
});

describe('ready banner hold', () => {
  it('holds while M11 is mounted and lifts on release', () => {
    const h = createReadyBannerHold();
    const release = h.hold('egg-1');
    assert.deepEqual(h.behaviorFor(READY('egg-1')), QUIET_READY);
    release();
    assert.equal(h.store.getState().onScreenEggId, null);
    assert.deepEqual(h.behaviorFor(READY('egg-1')), SHOW_NOTIFICATION);
  });

  it('a stale release does not lift a newer hold', () => {
    const h = createReadyBannerHold();
    const releaseOld = h.hold('egg-1');
    h.hold('egg-2');
    releaseOld();
    assert.equal(h.store.getState().onScreenEggId, 'egg-2');
  });
});
