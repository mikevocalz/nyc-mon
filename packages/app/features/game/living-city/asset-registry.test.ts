import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANIMATION_STATES,
  candidates,
  createWorldAssetRegistry,
  fallbackPose,
  isSemanticId,
  markStatus,
  missingAnimationStates,
  providedAnimationStates,
  register,
  resolve,
  resolveChain,
  semanticIds,
  unregister,
  type AnimationState,
  type WorldAssetEntry,
} from './asset-registry.ts';
import {
  validateAnimations,
  validateLods,
  validatePivot,
  validateRegistry,
  validateUnits,
  type ValidationIssue,
} from './asset-validation.ts';
import { SEED_ASSETS } from './seed-assets.ts';

const registry = createWorldAssetRegistry(SEED_ASSETS);

const errors = (issues: readonly ValidationIssue[]) => issues.filter((i) => i.severity === 'error');

test('seeded registry validates clean: no errors on any entry or rule', () => {
  const issues = validateRegistry(registry);
  assert.deepEqual(errors(issues), [], JSON.stringify(issues, null, 2));
});

test('semantic ids are stable, dot-namespaced and cover the PR04 set', () => {
  assert.deepEqual(semanticIds(registry), [
    'ped.adult',
    'ped.kid',
    'prop.signalhead',
    'vehicle.bus',
    'vehicle.sedan',
    'vehicle.van',
  ]);
  for (const id of semanticIds(registry)) assert.ok(isSemanticId(id), id);
  for (const bad of ['Vehicle.Sedan', 'sedan', 'vehicle..sedan', 'vehicle.SEDAN', '-a.b']) {
    assert.equal(isSemanticId(bad), false, bad);
  }
});

test('resolve: pending-verification GLB is skipped by default; procedural wins', () => {
  const resolved = resolve(registry, 'vehicle.sedan')!;
  assert.equal(resolved.source, 'procedural');
  assert.equal(resolved.variant, 'three-car-generator');
});

test('resolve: allowPending previews the linked GLB without flipping its status', () => {
  const resolved = resolve(registry, 'vehicle.sedan', { allowPending: true })!;
  assert.equal(resolved.source, 'glb');
  assert.equal(resolved.variant, 'kenney-sedan');
  assert.equal(resolved.status, 'pending-verification');
});

test('sedan swap: stable id survives glb → procedural → primitive without touching consumers', () => {
  // GLB verified (hash check cleared) — same id now returns the GLB descriptor.
  const verified = markStatus(registry, 'vehicle.sedan', 'kenney-sedan', 'ready');
  assert.equal(resolve(verified, 'vehicle.sedan')!.variant, 'kenney-sedan');

  // GLB entry pulled entirely — same id, procedural descriptor, no renderer change.
  const noGlb = unregister(verified, 'vehicle.sedan', 'kenney-sedan');
  assert.equal(resolve(noGlb, 'vehicle.sedan')!.source, 'procedural');

  // Procedural gone too — primitive tail still answers the same id.
  const primitiveOnly = unregister(noGlb, 'vehicle.sedan', 'three-car-generator');
  const resolved = resolve(primitiveOnly, 'vehicle.sedan')!;
  assert.equal(resolved.source, 'primitive-fallback');
  assert.equal(resolved.variant, 'box');

  // Original registry untouched — immutable snapshots.
  assert.equal(resolve(registry, 'vehicle.sedan')!.variant, 'three-car-generator');
});

test('resolveChain orders glb → procedural → primitive-fallback', () => {
  assert.deepEqual(
    resolveChain(registry, 'vehicle.sedan').map((e) => e.source),
    ['glb', 'procedural', 'primitive-fallback'],
  );
  assert.deepEqual(
    candidates(registry, 'ped.adult').map((e) => e.variant),
    ['quaternius-ubc', 'three-person-generator', 'box'],
  );
});

test('vehicle.bus has no glb candidate and still resolves (missing GLB never breaks a renderer)', () => {
  const chain = resolveChain(registry, 'vehicle.bus');
  assert.ok(chain.every((e) => e.source !== 'glb'));
  assert.equal(resolve(registry, 'vehicle.bus')!.source, 'procedural');
  assert.equal(resolveChain(registry, 'vehicle.bus').at(-1)!.source, 'primitive-fallback');
});

test('resolve returns null only for unknown ids — never throws', () => {
  assert.equal(resolve(registry, 'vehicle.helicopter'), null);
  assert.deepEqual(resolveChain(registry, 'vehicle.helicopter'), []);
});

test('registry guards: duplicate variant and a chain with no primitive tail are errors', () => {
  const dup = register(registry, { ...SEED_ASSETS[0]!, variant: 'kenney-sedan' });
  // register() replaces same (id,variant), so add the raw duplicate manually:
  const manual = createWorldAssetRegistry([...SEED_ASSETS, SEED_ASSETS[0]!]);
  assert.ok(errors(validateRegistry(manual)).some((i) => i.check === 'registry' && /duplicate/.test(i.message)));
  assert.equal(dup.entries.length, registry.entries.length, 'register replaces instead of duplicating');

  const noTail = createWorldAssetRegistry(
    SEED_ASSETS.filter((e) => !(e.id === 'vehicle.sedan' && e.source === 'primitive-fallback')),
  );
  assert.ok(errors(validateRegistry(noTail)).some((i) => i.id === 'vehicle.sedan' && /primitive-fallback/.test(i.message)));
});

test('units: sedan ≈4.5 m and adult ≈1.7 m pass; centimetre-scale and bad data fail', () => {
  const sedan = resolve(registry, 'vehicle.sedan')!;
  assert.deepEqual(errors(validateUnits(sedan, { lengthM: 4.5 })), []);
  const adult = candidates(registry, 'ped.adult')[0]!;
  assert.deepEqual(errors(validateUnits(adult, { heightM: 1.7 })), []);

  const cmScale: WorldAssetEntry = { ...sedan, variant: 'x', bounds: { lengthM: 450, widthM: 180, heightM: 145 } };
  assert.ok(errors(validateUnits(cmScale, { lengthM: 4.5 })).length >= 3, '450 m sedan = unit scale error');
  const nan: WorldAssetEntry = { ...sedan, variant: 'x', bounds: { lengthM: NaN, widthM: 1.8, heightM: 1.5 } };
  assert.ok(errors(validateUnits(nan)).some((i) => /positive finite/.test(i.message)));
  const kid: WorldAssetEntry = { ...adult, variant: 'x', bounds: { lengthM: 0.35, widthM: 0.4, heightM: 1.15 } };
  assert.deepEqual(errors(validateUnits(kid)), [], '1.15 m kid is inside pedestrian range');
});

test('pivot: ground-center/feet/wheelbase-center allowed per kind, others rejected', () => {
  const sedan = candidates(registry, 'vehicle.sedan')[0]!;
  assert.deepEqual(validatePivot(sedan), []);
  const adult = candidates(registry, 'ped.adult')[0]!;
  assert.equal(adult.pivot, 'feet');
  assert.deepEqual(validatePivot(adult), []);
  const bad: WorldAssetEntry = { ...adult, variant: 'x', pivot: 'wheelbase-center' };
  assert.ok(validatePivot(bad).some((i) => i.severity === 'error'));
});

test('lods: declared tiers must be near/medium/far with non-empty URIs', () => {
  const sedan = candidates(registry, 'vehicle.sedan')[0]!;
  assert.deepEqual(validateLods(sedan), [], 'no lods declared is fine');
  const good: WorldAssetEntry = { ...sedan, variant: 'x', lods: { near: 'a.glb', far: 'b.glb' } };
  assert.deepEqual(validateLods(good), []);
  const bad: WorldAssetEntry = {
    ...sedan,
    variant: 'x',
    lods: { near: 'a.glb', ultra: 'u.glb', medium: '' } as WorldAssetEntry['lods'],
  };
  assert.equal(errors(validateLods(bad)).length, 2);
});

test('animation contract: states list is the spec contract and coverage is computable', () => {
  assert.deepEqual(ANIMATION_STATES, ['idle', 'walk', 'run', 'wait', 'turn', 'cross', 'look', 'react', 'sit', 'board']);

  const ubc = candidates(registry, 'ped.adult').find((e) => e.variant === 'quaternius-ubc')!;
  assert.deepEqual(providedAnimationStates(ubc).sort(), ['idle', 'run', 'sit', 'walk']);
  assert.deepEqual(missingAnimationStates(ubc), ['wait', 'turn', 'cross', 'look', 'react', 'board']);
  assert.equal(fallbackPose(ubc), 'idle', 'missing states documented as the idle fallback pose');

  const box = candidates(registry, 'ped.adult').find((e) => e.variant === 'box')!;
  assert.deepEqual(providedAnimationStates(box), []);
  assert.equal(missingAnimationStates(box).length, ANIMATION_STATES.length);
  assert.equal(fallbackPose(box), 'idle');

  const bogus: WorldAssetEntry = {
    ...ubc,
    variant: 'x',
    animations: { idle: 'Idle', fly: 'Fly' } as WorldAssetEntry['animations'],
    fallbackPose: 'fly' as unknown as AnimationState,
  };
  assert.equal(errors(validateAnimations(bogus)).length, 2);
});

test('licenses: every entry declares one; ready ⇒ verified, pending ⇒ unverified', () => {
  for (const entry of registry.entries) {
    assert.ok(entry.license.length > 0, `${entry.id}/${entry.variant}`);
    if (entry.status === 'ready') assert.equal(entry.provenance.licenseVerified, true, `${entry.id}/${entry.variant}`);
    if (entry.status === 'pending-verification') {
      assert.equal(entry.provenance.licenseVerified, false, `${entry.id}/${entry.variant}`);
      assert.match(entry.provenance.note ?? '', /hedge|verify/i, 'pending entries carry the ledger hedge');
    }
  }
  const statuses = new Map<string, string>();
  for (const e of registry.entries) statuses.set(`${e.id}/${e.variant}`, `${e.source}:${e.status}`);
  assert.equal(statuses.get('vehicle.sedan/kenney-sedan'), 'glb:pending-verification');
  assert.equal(statuses.get('vehicle.bus/proc-bus'), 'procedural:ready');
  assert.ok([...statuses.values()].every((v) => v !== 'glb:ready'), 'no unverified GLB ships as ready');
});
