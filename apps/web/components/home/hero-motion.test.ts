import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HERO_ENTRANCE_BIND_BUDGET_MS, heroEntrance } from './hero-motion.ts';
import { HERO_LCP_TEXT_IDS, parseMotionMarker } from './motion-markers.ts';

const TRANSFORM_KEYS = new Set(['x', 'y', 'xPercent', 'yPercent', 'scale', 'rotate']);
const targets = () => new Set([...heroEntrance.tracks.map((t) => t.target), ...Object.keys(heroEntrance.initial)]);

test('the hero LCP text ids are not motion markers', () => {
  for (const id of Object.values(HERO_LCP_TEXT_IDS)) assert.equal(parseMotionMarker(id), null, id);
});

test('w01.hero.enter never targets the headline or the support line (PS-035)', () => {
  assert.deepEqual([...targets()].sort(), ['hero-actions', 'hero-art', 'hero-seal']);
  for (const name of targets()) assert.doesNotMatch(name, /title|body/);
});

test('w01.hero.enter is transform-only: nothing in the hero goes transparent', () => {
  for (const [target, from] of Object.entries(heroEntrance.initial)) {
    for (const key of Object.keys(from)) assert.ok(TRANSFORM_KEYS.has(key), `${target}.${key}`);
  }
  for (const track of heroEntrance.tracks) {
    for (const key of Object.keys(track.to)) assert.ok(TRANSFORM_KEYS.has(key), `${track.target}.${key}`);
  }
});

test('w01.hero.enter is one short beat with a bounded bind budget', () => {
  assert.ok(heroEntrance.durationMs <= 1000, `${heroEntrance.durationMs} ms`);
  assert.ok(HERO_ENTRANCE_BIND_BUDGET_MS <= 2000);
});

test('HomeHero renders the LCP text under the plain ids', () => {
  const hero = readFileSync(new URL('./HomeHero.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(hero, /mfx-hero-(title|body)/);
  assert.match(hero, /id=\{HERO_LCP_TEXT_IDS\.title\}/);
  assert.match(hero, /id=\{HERO_LCP_TEXT_IDS\.body\}/);
});
