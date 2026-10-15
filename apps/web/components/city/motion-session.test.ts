import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startPhotoMotion } from './motion-session.ts';

function fixture(initialReduced = false) {
  const gate = Promise.withResolvers<() => { play(): void; revert(): void }>();
  const events: string[] = [];
  let visible = () => {};
  let changed = () => {};
  const preference = {
    matches: initialReduced,
    addEventListener: (_type: 'change', listener: () => void) => { changed = listener; events.push('listen'); },
    removeEventListener: (_type: 'change', listener: () => void) => { assert.equal(listener, changed); events.push('unlisten'); },
  };
  const options = {
    preference,
    observe: (callback: () => void) => { visible = callback; events.push('observe'); return () => { events.push('disconnect'); }; },
    load: () => { events.push('load'); return gate.promise; },
    onError: (error: unknown) => { events.push(`error:${String(error)}`); },
  };
  const finish = () => gate.resolve(() => { events.push('create'); return { play: () => { events.push('play'); }, revert: () => { events.push('revert'); } }; });
  return { events, options, finish, gate, visible: () => visible(), reduce: (value: boolean) => { preference.matches = value; changed(); } };
}

test('observes once, loads only on intersection and plays once', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  assert.deepEqual(f.events, ['listen', 'observe']);
  f.visible(); f.visible(); f.finish(); await s.settled;
  assert.deepEqual(f.events, ['listen', 'observe', 'disconnect', 'load', 'create', 'play']);
  s.dispose(); s.dispose();
  assert.deepEqual(f.events.slice(-2), ['unlisten', 'revert']);
});

test('initial reduced motion remains static without importing animation', async () => {
  const f = fixture(true); const s = startPhotoMotion(f.options);
  f.reduce(false); f.visible(); await s.settled; s.dispose();
  assert.deepEqual(f.events, ['listen', 'unlisten']);
});

test('unmount before the import resolves prevents any timeline', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  f.visible(); s.dispose(); f.finish(); await s.settled;
  assert(!f.events.includes('create'));
});

test('reducing motion during import prevents late creation and later replay', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  f.visible(); f.reduce(true); f.reduce(false); f.finish(); await s.settled; f.visible();
  assert(!f.events.includes('create')); s.dispose();
});

test('a live reduced-motion change reverts the current timeline exactly once', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  f.visible(); f.finish(); await s.settled; f.reduce(true); f.reduce(false); f.visible(); s.dispose();
  assert.equal(f.events.filter((event) => event === 'revert').length, 1);
  assert.equal(f.events.filter((event) => event === 'play').length, 1);
});

test('import failure leaves the static page and reports one observed error', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  f.visible(); f.gate.reject(new Error('chunk unavailable')); await s.settled; s.dispose();
  assert.equal(f.events.filter((event) => event.startsWith('error:')).length, 1);
  assert(!f.events.includes('create'));
});

test('Strict Mode replacement cannot revive the first session', async () => {
  const first = fixture(); const next = fixture();
  const a = startPhotoMotion(first.options); first.visible(); a.dispose();
  const b = startPhotoMotion(next.options); next.visible(); next.finish(); first.finish();
  await Promise.all([a.settled, b.settled]);
  assert(!first.events.includes('create')); assert(next.events.includes('play')); b.dispose();
});

test('synchronous initial observer notification still disconnects its subscription', async () => {
  const f = fixture(); const s = startPhotoMotion({ ...f.options, observe: (callback) => { callback(); return () => { f.events.push('disconnect'); }; } });
  f.finish(); await s.settled; s.dispose();
  assert.equal(f.events.filter((event) => event === 'disconnect').length, 1);
});

test('unmount before any intersection removes subscriptions without importing', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  s.dispose(); f.visible(); await s.settled;
  assert.deepEqual(f.events, ['listen', 'observe', 'disconnect', 'unlisten']);
});

test('a playback error reverts styles and remains an observed optional failure', async () => {
  const f = fixture(); const s = startPhotoMotion(f.options);
  f.visible(); f.gate.resolve(() => ({ play() { throw new Error('play failed'); }, revert() { f.events.push('revert'); } }));
  await s.settled; s.dispose();
  assert.equal(f.events.filter((event) => event === 'revert').length, 1);
  assert.equal(f.events.filter((event) => event.startsWith('error:')).length, 1);
});
