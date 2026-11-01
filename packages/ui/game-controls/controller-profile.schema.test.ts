import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONTROLLER_PROFILE } from './contract.ts';
import {
  VALID_DEFAULT_CONTROLLER_PROFILE,
  controllerProfileSchema,
  parseControllerProfile,
  patchControllerProfile,
} from './controller-profile.schema.ts';

describe('controllerProfileSchema', () => {
  it('accepts the contract default', () => {
    assert.deepEqual(parseControllerProfile(DEFAULT_CONTROLLER_PROFILE), DEFAULT_CONTROLLER_PROFILE);
    assert.deepEqual(VALID_DEFAULT_CONTROLLER_PROFILE, DEFAULT_CONTROLLER_PROFILE);
  });

  it('enforces every range at both ends', () => {
    const base = DEFAULT_CONTROLLER_PROFILE;
    const cases: [string, unknown, boolean][] = [
      ['deadZone 0', { ...base, stick: { ...base.stick, deadZone: 0 } }, true],
      ['deadZone 0.5', { ...base, stick: { ...base.stick, deadZone: 0.5 } }, true],
      ['deadZone 0.51', { ...base, stick: { ...base.stick, deadZone: 0.51 } }, false],
      ['deadZone -0.01', { ...base, stick: { ...base.stick, deadZone: -0.01 } }, false],
      ['sensitivity 0.5', { ...base, stick: { ...base.stick, sensitivity: 0.5 } }, true],
      ['sensitivity 2', { ...base, stick: { ...base.stick, sensitivity: 2 } }, true],
      ['sensitivity 2.1', { ...base, stick: { ...base.stick, sensitivity: 2.1 } }, false],
      ['clamp 32', { ...base, stick: { ...base.stick, clampRadiusDp: 32 } }, true],
      ['clamp 96', { ...base, stick: { ...base.stick, clampRadiusDp: 96 } }, true],
      ['clamp 31', { ...base, stick: { ...base.stick, clampRadiusDp: 31 } }, false],
      ['scale 0.8', { ...base, scale: 0.8 }, true],
      ['scale 1.4', { ...base, scale: 1.4 }, true],
      ['scale 1.41', { ...base, scale: 1.41 }, false],
      ['opacity 0.3', { ...base, opacity: 0.3 }, true],
      ['opacity 1', { ...base, opacity: 1 }, true],
      ['opacity 0.29', { ...base, opacity: 0.29 }, false],
      ['opacity 1.01', { ...base, opacity: 1.01 }, false],
    ];
    for (const [name, value, ok] of cases) {
      assert.equal(controllerProfileSchema.safeParse(value).success, ok, name);
    }
  });

  it('rejects unknown enum members, NaN, missing fields and non-objects', () => {
    const base = DEFAULT_CONTROLLER_PROFILE;
    assert.equal(parseControllerProfile({ ...base, stickMode: 'wheel' }), undefined);
    assert.equal(parseControllerProfile({ ...base, haptics: 'max' }), undefined);
    assert.equal(parseControllerProfile({ ...base, scale: Number.NaN }), undefined);
    assert.equal(parseControllerProfile({ ...base, opacity: Number.POSITIVE_INFINITY }), undefined);
    const { showIcons: _dropped, ...missing } = base;
    assert.equal(parseControllerProfile(missing), undefined);
    assert.equal(parseControllerProfile(null), undefined);
    assert.equal(parseControllerProfile('profile'), undefined);
  });

  it('strips unknown keys so a newer build\'s profile still loads', () => {
    const parsed = parseControllerProfile({ ...DEFAULT_CONTROLLER_PROFILE, clusterPlacement: 'bottom' });
    assert.deepEqual(parsed, DEFAULT_CONTROLLER_PROFILE);
  });
});

describe('patchControllerProfile', () => {
  it('merges a nested stick patch', () => {
    const next = patchControllerProfile(DEFAULT_CONTROLLER_PROFILE, { stick: { deadZone: 0.3 } as never, handedness: 'left' });
    assert.equal(next.stick.deadZone, 0.3);
    assert.equal(next.stick.sensitivity, DEFAULT_CONTROLLER_PROFILE.stick.sensitivity);
    assert.equal(next.handedness, 'left');
  });

  it('keeps the current profile when the patch is out of range', () => {
    const next = patchControllerProfile(DEFAULT_CONTROLLER_PROFILE, { scale: 3 });
    assert.equal(next, DEFAULT_CONTROLLER_PROFILE);
  });
});
