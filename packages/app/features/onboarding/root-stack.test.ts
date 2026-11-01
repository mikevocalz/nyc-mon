import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanRootStack, type RouteLike } from './root-stack.ts';

const group = (name: string, leaf: string, key = name): RouteLike => ({ key, name, state: { index: 0, routes: [{ key: `${key}-${leaf}`, name: leaf }] } });
const names = (r: ReturnType<typeof cleanRootStack>) => r?.routes.map((x) => x.key) ?? null;

describe('cleanRootStack', () => {
  it('leaves a clean stack alone: home under game, game under home', () => {
    assert.equal(cleanRootStack({ index: 1, routes: [group('(home)', 'index'), group('(drawer)', '(tabs)')] }), null);
    assert.equal(cleanRootStack({ index: 1, routes: [group('(drawer)', '(tabs)'), group('(home)', 'index')] }), null);
  });

  it('keeps Welcome under sign-in (Back from sign-in returns to Welcome)', () => {
    assert.equal(cleanRootStack({ index: 1, routes: [group('(onboarding)', 'welcome'), group('(auth)', 'sign-in')] }), null);
  });

  it('sign-out (replace to sign-in) drops the old session shell under it', () => {
    const r = cleanRootStack({ index: 2, routes: [group('(drawer)', '(tabs)'), group('(home)', 'index'), group('(auth)', 'sign-in')] });
    assert.deepEqual(names(r), ['(auth)']);
    assert.equal(r?.index, 0);
  });

  it('account deletion (replace to Welcome) drops the shell too', () => {
    const r = cleanRootStack({ index: 1, routes: [group('(home)', 'index'), group('(onboarding)', 'welcome')] });
    assert.deepEqual(names(r), ['(onboarding)']);
  });

  it('a replace into (home) drops the older (home) copy, keeps the rest', () => {
    const r = cleanRootStack({
      index: 2,
      routes: [group('(home)', 'index', 'home-old'), group('(drawer)', '(tabs)'), group('(home)', 'index', 'home-new')],
    });
    assert.deepEqual(names(r), ['(drawer)', 'home-new']);
    assert.equal(r?.index, 1);
  });

  it('a (home) route pushing the permissions step keeps (home) under it', () => {
    assert.equal(cleanRootStack({ index: 1, routes: [group('(home)', 'index'), group('(onboarding)', 'permissions')] }), null);
  });
});
