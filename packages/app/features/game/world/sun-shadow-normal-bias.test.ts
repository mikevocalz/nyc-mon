// "Patchy walls when walking" (iPad, 2026-10-28). three@0.186.1's SunShadowNode
// offset each fragment's shadow lookup by normalWorld * normalBias, and in the
// fragment stage normalWorld is the material's normalNode. The physical facades
// bump every brick, sill and cornice (physical/facade.ts) and fade that bump
// with camera distance, so each brick looked up the shadow map at a different
// point and the pattern changed as the Caller walked. patches/three@0.186.1.patch
// offsets along normalWorldGeometry instead; this pins it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const threeRoot = dirname(dirname(require.resolve('three')));
const source = readFileSync(join(threeRoot, 'examples/jsm/lights/SunShadowNode.js'), 'utf8');

test('the sun shadow normal bias follows the geometric normal, not the bumped one', () => {
  assert.match(source, /shadowPositionWorld\.add\(\s*normalWorldGeometry\.mul\(\s*normalBias\s*\)\s*\)/);
  assert.doesNotMatch(source, /normalWorld\.mul\(\s*normalBias/);
});

test('the patched SunShadowNode still loads', async () => {
  const mod = await import('three/examples/jsm/lights/SunShadowNode.js');
  assert.equal(typeof mod.SunShadowNode, 'function');
  assert.equal(typeof mod.sunShadow, 'function');
});
