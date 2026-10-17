// Lane L6 tier bundle: the selector's truth table, the tier→option
// mapping onto the L1/L3/L5a option names, the env-flag force-on merge
// into post options, and the env-size pick reaching the sky rig.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { SKY_PRESETS } from '@acme/assets/skies';
import { parseCityDataset } from '../city-dataset.ts';
import { resolvePostOptions } from '../post/pipeline.ts';
import { buildCityWorld } from '../world/index.ts';
import { bakeSkyEquirect, SKY_RIG } from '../world/sky-rig.ts';
import { syntheticTileV2 } from '../world/synthetic-tile.ts';
import { parseWorldTier, TIER, tierBundle, WORLD_TIER } from './tier.ts';
import { RENDER_SCALE_FLOOR } from './render-scale.ts';

test('the selector only honours "high"; everything else is the phone tier', () => {
  for (const high of ['high', 'HIGH', ' High ', 'hiGH']) {
    assert.equal(parseWorldTier(high), 'high', high);
  }
  for (const phone of [undefined, null, '', 'phone', 'low', '0', '  ', 'higher']) {
    assert.equal(parseWorldTier(phone), 'phone', String(phone));
  }
  assert.equal(WORLD_TIER, parseWorldTier(process.env.EXPO_PUBLIC_WORLD_TIER));
});

test('the phone tier bundles the Flying Roadster phone set onto the lane option names', () => {
  const phone = tierBundle('phone');
  // L1 env size: 1024 equirect → 256px PMREM cube (sky-rig.ts, width/4).
  assert.equal(phone.envWidth, SKY_RIG.envWidth);
  assert.equal(phone.envWidth / 4, 256);
  // L3 interior mapping: the cheap flat room colour.
  assert.equal(phone.glassTier, 'flat');
  // L5a post picks: no AO, no bloom, FXAA.
  assert.deepEqual(phone.post, { bloom: false, ao: false, aa: true, tier: 'phone' });
  // L6 controller: the 27–38 fps band and the provisional 0.5 floor.
  assert.deepEqual(phone.scale.band, { low: 27, high: 38 });
  assert.equal(phone.scale.floor, RENDER_SCALE_FLOOR);
});

test('the high tier bundles the full set and its own band', () => {
  const high = tierBundle('high');
  assert.equal(high.envWidth, SKY_RIG.envWidth * 2);
  assert.equal(high.envWidth / 4, 512);
  assert.equal(high.glassTier, 'full');
  assert.deepEqual(high.post, { bloom: true, ao: true, aa: true, tier: 'high' });
  assert.ok(high.scale.band.low > TIER.phone.scale.band.low, 'the high band sits above the phone band');
  assert.equal(high.scale.floor, RENDER_SCALE_FLOOR);
  // TIER is the same object tierBundle returns — the mapping table is the contract.
  assert.equal(tierBundle('phone'), TIER.phone);
  assert.equal(tierBundle('high'), TIER.high);
});

test('tier post picks are the base; env flags force on over them, selectors override when set', () => {
  // Phone base: FXAA lands without any flag; bloom and AO stay off.
  assert.deepEqual(resolvePostOptions({}, tierBundle('phone').post), {
    bloom: false, ao: false, aa: true, grade: false, tier: 'phone', toneMapping: 'none',
  });
  // High base: the whole chain defaults on except the unbundled grade/toneMapping.
  assert.deepEqual(resolvePostOptions({}, tierBundle('high').post), {
    bloom: true, ao: true, aa: true, grade: false, tier: 'high', toneMapping: 'none',
  });
  // A truthy per-effect flag forces on over the phone bundle.
  assert.equal(
    resolvePostOptions({ EXPO_PUBLIC_WORLD_POST_BLOOM: '1' }, tierBundle('phone').post).bloom,
    true,
  );
  // The post tier selector keeps its own say: set → wins, unset → the bundle's.
  assert.equal(
    resolvePostOptions({ EXPO_PUBLIC_WORLD_POST_TIER: 'high' }, tierBundle('phone').post).tier,
    'high',
  );
  assert.equal(
    resolvePostOptions({ EXPO_PUBLIC_WORLD_POST_TIER: 'phone' }, tierBundle('high').post).tier,
    'phone',
  );
  assert.equal(resolvePostOptions({}, tierBundle('high').post).tier, 'high');
});

test('the env-size pick reaches the sky rig: a wider equirect means a bigger PMREM cube', () => {
  // bakeSkyEquirect takes the tier's width/height directly — the baked env
  // path is the always-available fallback.
  const phone = bakeSkyEquirect(THREE, SKY_PRESETS.dusk, tierBundle('phone').envWidth, tierBundle('phone').envWidth / 2);
  assert.equal(phone.image.width, 1024);
  const high = bakeSkyEquirect(THREE, SKY_PRESETS.dusk, tierBundle('high').envWidth, tierBundle('high').envWidth / 2);
  assert.equal(high.image.width, 2048);
  assert.equal(high.image.height, 1024);
  phone.dispose();
  high.dispose();
});

test('buildCityWorld accepts the bundle options without changing the flags', () => {
  const dataset = parseCityDataset(syntheticTileV2());
  const world = buildCityWorld(THREE, dataset, {
    skyRig: true,
    glassTier: tierBundle('phone').glassTier,
    envWidth: tierBundle('phone').envWidth,
  });
  assert.ok(world.skyRig, 'the sky rig still mounts behind its flag');
  world.dispose();
});
