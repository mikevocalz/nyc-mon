import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appLinkFromResponse, careLinkFromResponse, createDeepLinkStore, DEFAULT_ACTION_IDENTIFIER, readyLinkFromResponse, SEEN_KEY_LIMIT,
  type ResponseLike,
} from './notify-route.ts';

function response(data: unknown, overrides: Partial<{ action: string; id: string; date: number }> = {}): ResponseLike {
  return {
    actionIdentifier: overrides.action ?? DEFAULT_ACTION_IDENTIFIER,
    notification: {
      date: overrides.date ?? 1_000,
      request: { identifier: overrides.id ?? 'egg-ready-egg-1', content: { data } },
    },
  };
}

const READY = { eggId: 'egg-1', url: '/(home)/hatch' };

describe('readyLinkFromResponse', () => {
  it('routes a tap on a hatch-ready payload to M12 with the egg id', () => {
    const r = readyLinkFromResponse(response(READY));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.link.pathname, '/(home)/hatch');
      assert.deepEqual(r.link.params, { eggId: 'egg-1' });
      assert.equal(r.link.key, 'egg-ready-egg-1@1000');
    }
  });

  it('ignores other payloads and keeps the issues for the log (Law 5)', () => {
    const r = readyLinkFromResponse(response({ url: '/elsewhere' }));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, 'not-hatch-ready');
      assert.ok(r.issues);
    }
    assert.equal(readyLinkFromResponse(response(undefined)).ok, false);
  });

  it('ignores a non-default action (a dismiss)', () => {
    const r = readyLinkFromResponse(response(READY, { action: 'expo.modules.notifications.actions.DISMISS' }));
    assert.deepEqual(r, { ok: false, reason: 'not-a-tap' });
  });
});

describe('deep-link store (M01 holds the link until boot resolves)', () => {
  const link = (key = 'a@1') => ({ pathname: '/(home)/hatch' as const, params: { eggId: 'egg-1' }, key });

  it('cold start: holds the link, then arms it for the destination to apply on mount after an incubating / egg-ready / companion boot', () => {
    for (const kind of ['incubating', 'egg-ready', 'companion'] as const) {
      const s = createDeepLinkStore();
      assert.equal(s.receive(link()), 'held');
      s.resolveBoot(kind);
      // Boot does not push in the same tick as its replace: nothing is applied yet.
      assert.equal(s.store.getState().pending, null);
      assert.deepEqual(s.store.getState().armed, link());
      // The destination's mount takes it exactly once.
      assert.deepEqual(s.takeArmed(), link());
      assert.equal(s.takeArmed(), undefined);
    }
  });

  it('drops a held link when boot lands anywhere else', () => {
    const s = createDeepLinkStore();
    s.receive(link());
    s.resolveBoot('first-run');
    assert.equal(s.store.getState().pending, null);
    assert.equal(s.takeArmed(), undefined);
  });

  it('a destination that mounts with no held link applies nothing', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('companion');
    assert.equal(s.takeArmed(), undefined);
  });

  it('skips the push when M12 is already showing the same egg', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('egg-ready');
    // usePathname drops route groups: M12 reads as /hatch.
    assert.equal(s.receive(link('h@1'), { pathname: '/hatch', eggId: 'egg-1' }), 'already-there');
    assert.equal(s.receive(link('h@1'), { pathname: '/hatch', eggId: 'egg-1' }), 'duplicate');
    assert.equal(s.receive(link('h@2'), { pathname: '/hatch', eggId: 'egg-2' }), 'navigate');
    assert.equal(s.receive(link('h@3'), { pathname: '/', eggId: 'egg-1' }), 'navigate');
  });

  it('keeps only the last few tap keys', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('companion');
    for (let i = 0; i < SEEN_KEY_LIMIT * 3; i += 1) s.receive(link(`k@${i}`));
    const { seen } = s.store.getState();
    assert.equal(seen.length, SEEN_KEY_LIMIT);
    assert.equal(seen.at(-1), `k@${SEEN_KEY_LIMIT * 3 - 1}`);
    // A recent tap is still a duplicate.
    assert.equal(s.receive(link(`k@${SEEN_KEY_LIMIT * 3 - 1}`)), 'duplicate');
  });

  it('warm tap after boot navigates directly', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('companion');
    assert.equal(s.receive(link()), 'navigate');
  });

  it('the same tap seen by the cold-start read and the listener routes once', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('incubating');
    assert.equal(s.receive(link('x@5')), 'navigate');
    assert.equal(s.receive(link('x@5')), 'duplicate');
    assert.equal(s.receive(link('y@6')), 'navigate');
  });
});

describe('care-call taps (Mon Space)', () => {
  const careResponse = (data: unknown, action = DEFAULT_ACTION_IDENTIFIER): ResponseLike => ({
    actionIdentifier: action,
    notification: { date: 42, request: { identifier: 'mon-care:m1:hunger:0', content: { data } } },
  });
  const payload = { kind: 'mon-care-call', monInstanceId: 'm1', callKind: 'hunger', at: 41, url: '/mon-space' };

  it('routes a tap on a care call to Mon Space with the Mon named', () => {
    const result = careLinkFromResponse(careResponse(payload));
    assert.deepEqual(result, { ok: true, link: { pathname: '/mon-space', params: { monId: 'm1' }, key: 'mon-care:m1:hunger:0@42' } });
  });

  it('ignores a dismiss and a foreign payload', () => {
    assert.equal(careLinkFromResponse(careResponse(payload, 'expo.modules.notifications.actions.DISMISS')).ok, false);
    assert.equal(careLinkFromResponse(careResponse({ eggId: 'e' })).ok, false);
  });

  it('appLinkFromResponse picks whichever link the payload carries', () => {
    const care = appLinkFromResponse(careResponse(payload));
    assert.equal(care.ok && care.link.pathname, '/mon-space');
    const egg = appLinkFromResponse(careResponse({ eggId: 'egg-1', url: '/(home)/hatch' }));
    assert.equal(egg.ok && egg.link.pathname, '/(home)/hatch');
    assert.equal(appLinkFromResponse(careResponse({ nope: true })).ok, false);
  });

  it('a care tap while Mon Space already shows that Mon pushes nothing', () => {
    const s = createDeepLinkStore();
    s.resolveBoot('companion');
    const result = careLinkFromResponse(careResponse(payload));
    assert.ok(result.ok);
    assert.equal(s.receive(result.link, { pathname: '/mon-space', monId: 'm1' }), 'already-there');
  });

  it('a care tap held through boot is armed for a companion route', () => {
    const s = createDeepLinkStore();
    const result = careLinkFromResponse(careResponse(payload));
    assert.ok(result.ok);
    assert.equal(s.receive(result.link), 'held');
    s.resolveBoot('companion');
    assert.deepEqual(s.takeArmed(), result.link);
  });
});
