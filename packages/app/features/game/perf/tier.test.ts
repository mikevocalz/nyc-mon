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
import {
  createLivingCityAdaptive,
  LIVING_CITY_ADAPTIVE_SCALE,
  LIVING_CITY_CAPS,
  livingCityCapsFor,
  parseLivingCityTier,
  parseWorldTier,
  resolveLivingCityTier,
  TIER,
  tierBundle,
  WORLD_TIER,
} from './tier.ts';
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

// --- PR09: Living City actor/LOD caps -------------------------------------------------

test('PR09: every world tier names a living-city rung', () => {
  assert.equal(tierBundle('phone').livingCity, 'medium');
  assert.equal(tierBundle('high').livingCity, 'high');
});

test('PR09: the living-city selector honours the four rungs, rejects the rest', () => {
  for (const t of ['low', 'LOW', ' Low ', 'medium', 'MEDIUM', 'high', ' High', 'xr', 'XR']) {
    assert.ok(parseLivingCityTier(t) !== null, t);
  }
  assert.equal(parseLivingCityTier('low'), 'low');
  assert.equal(parseLivingCityTier('medium'), 'medium');
  assert.equal(parseLivingCityTier('high'), 'high');
  assert.equal(parseLivingCityTier('xr'), 'xr');
  for (const bad of [undefined, null, '', '  ', 'ultra', '0', 'phone']) {
    assert.equal(parseLivingCityTier(bad), null, String(bad));
  }
});

test('PR09: the xr rung is the authored ceiling — reserved for a headset measurement', () => {
  // 'xr' deliberately equals 'high': there is no measured headset budget to
  // raise counts into, so the rung reserves the selector name only.
  assert.deepEqual(livingCityCapsFor('xr'), livingCityCapsFor('high'));
});

test('PR09: with nothing selected the living city keeps the authored counts', () => {
  // Neither EXPO_PUBLIC_LIVING_CITY_TIER nor EXPO_PUBLIC_WORLD_TIER is set
  // in this test process — the resolution must land on 'high', which the
  // living-city tests pin against the authored PR05–07 constants.
  assert.equal(resolveLivingCityTier(), 'high');
  const high = livingCityCapsFor('high');
  assert.equal(high.vehicles, 12);
  assert.equal(high.peds, 16);
  assert.equal(high.lampGlow, true);
  // And the ordering is monotone where it matters.
  assert.ok(LIVING_CITY_CAPS.low.vehicles < LIVING_CITY_CAPS.medium.vehicles);
  assert.ok(LIVING_CITY_CAPS.medium.vehicles < LIVING_CITY_CAPS.high.vehicles);
  assert.ok(LIVING_CITY_CAPS.low.peds < LIVING_CITY_CAPS.medium.peds);
  assert.ok(LIVING_CITY_CAPS.medium.peds < LIVING_CITY_CAPS.high.peds);
  assert.equal(LIVING_CITY_CAPS.low.lampGlow, false);
  assert.ok(LIVING_CITY_CAPS.low.signalHeadCap < LIVING_CITY_CAPS.high.signalHeadCap);
});

test('PR09: the adaptive stepper walks high→medium→low on surrendering scale, never back up', () => {
  const a = createLivingCityAdaptive();
  assert.equal(a.frame(1, 'high'), null, 'full resolution — nothing to do');
  assert.equal(a.frame(LIVING_CITY_ADAPTIVE_SCALE + 0.01, 'high'), null, 'above the mark');
  assert.equal(a.frame(LIVING_CITY_ADAPTIVE_SCALE, 'high'), 'medium', 'first mark → medium');
  assert.equal(a.frame(0.74, 'medium'), null, 'same scale again — the mark moved');
  assert.equal(a.frame(LIVING_CITY_ADAPTIVE_SCALE * 0.75, 'medium'), 'low', 'second mark → low');
  assert.equal(a.frame(0.3, 'low'), null, 'floored at low — stops evaluating');
  // A second stepper shows the rule never steps up.
  const b = createLivingCityAdaptive();
  assert.equal(b.frame(0.5, 'high'), 'medium');
  assert.equal(b.frame(1, 'medium'), null, 'recovered scale does not re-fill');
  // 'low' as the starting tier never steps.
  const c = createLivingCityAdaptive();
  assert.equal(c.frame(0.2, 'low'), null);
  // 'xr' sits above 'high' in the walk: it steps down through it.
  const d = createLivingCityAdaptive();
  assert.equal(d.frame(0.5, 'xr'), 'high');
});
