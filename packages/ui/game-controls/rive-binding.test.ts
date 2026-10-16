import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ARCADE_VM_PATHS, createArcadeRiveBinding, type ArcadeViewModelInstance } from './rive-binding.ts';

/** A fake instance that records every write and can hide paths like an older artboard would. */
function fakeInstance(hidden: readonly string[] = []) {
  const writes: [string, unknown][] = [];
  const lookups: string[] = [];
  const property = (path: string) => {
    lookups.push(path);
    if (hidden.includes(path)) return undefined;
    return { set: (value: unknown) => { writes.push([path, value]); } };
  };
  const instance: ArcadeViewModelInstance = {
    numberProperty: property,
    booleanProperty: property,
    enumProperty: property,
    stringProperty: property,
  };
  return { instance, writes, lookups };
}

describe('createArcadeRiveBinding', () => {
  it('writes the §8 stick paths from a reading', () => {
    const { instance, writes } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setStick({ x: 0.5, y: -0.25, engaged: true, direction: 'se' });
    assert.deepEqual(writes, [['stick/x', 0.5], ['stick/y', -0.25], ['stick/engaged', true]]);
  });

  it('skips writes whose value did not change and looks each handle up once', () => {
    const { instance, writes, lookups } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    const reading = { x: 0.5, y: 0.5, engaged: true, direction: 'ne' } as const;
    binding.setStick(reading);
    binding.setStick(reading);
    binding.setStick({ ...reading, x: 0.6 });
    assert.equal(writes.length, 4);
    assert.deepEqual(lookups, ['stick/x', 'stick/y', 'stick/engaged']);
  });

  it('maps button state, label and icon to their paths and clears a dropped icon', () => {
    const { instance, writes } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setButtonState('a', 'pressed');
    binding.setButtonLabel('a', 'A', 'zap');
    binding.setButtonLabel('a', 'A');
    assert.deepEqual(writes, [
      [ARCADE_VM_PATHS.buttonState('a'), 'pressed'],
      ['buttons/a/label', 'A'],
      ['buttons/a/icon', 'zap'],
      ['buttons/a/icon', ''],
    ]);
  });

  it('ignores an unknown button id rather than inventing a path', () => {
    const { instance, writes, lookups } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setButtonState('q' as never, 'held');
    assert.equal(writes.length, 0);
    assert.equal(lookups.length, 0);
  });

  it('writes pill state, stick mode and reduced motion as the contract spells them', () => {
    const { instance, writes } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setPillState('stopConfirm');
    binding.setStickMode('dpad');
    binding.setReducedMotion(true);
    assert.deepEqual(writes, [['pill/state', 'stopConfirm'], ['stick/mode', 'dpad'], ['a11y/reducedMotion', true]]);
  });

  it('clamps the hold progress to 0…1 and drops a non-finite value', () => {
    const { instance, writes } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setPillHoldProgress(0.5);
    binding.setPillHoldProgress(1.7);
    binding.setPillHoldProgress(-2);
    binding.setPillHoldProgress(Number.NaN);
    assert.deepEqual(writes, [['pill/holdProgress', 0.5], ['pill/holdProgress', 1], ['pill/holdProgress', 0]]);
  });

  it('records paths the artboard lacks and keeps serving the rest', () => {
    const { instance, writes } = fakeInstance(['stick/engaged', 'buttons/c/icon']);
    const binding = createArcadeRiveBinding(instance);
    binding.setStick({ x: 1, y: 0, engaged: true, direction: 'e' });
    binding.setStick({ x: 1, y: 0, engaged: true, direction: 'e' });
    binding.setButtonLabel('c', 'C');
    assert.deepEqual(binding.missingPaths, ['stick/engaged', 'buttons/c/icon']);
    assert.deepEqual(writes, [['stick/x', 1], ['stick/y', 0], ['buttons/c/label', 'C']]);
  });

  it('stops writing after dispose', () => {
    const { instance, writes } = fakeInstance();
    const binding = createArcadeRiveBinding(instance);
    binding.setPillState('playing');
    binding.dispose();
    binding.setPillState('paused');
    assert.deepEqual(writes, [['pill/state', 'playing']]);
  });
});

describe('M16: missing paths are reported, not swallowed', () => {
  it('calls onMissingPath once per path, the first time a setter asks', () => {
    const reported: string[] = [];
    const binding = createArcadeRiveBinding(
      { numberProperty: () => undefined, booleanProperty: () => undefined, enumProperty: () => undefined, stringProperty: () => undefined },
      { onMissingPath: (path) => reported.push(path) },
    );
    binding.setPillHoldProgress(0.25);
    binding.setPillHoldProgress(0.5);
    binding.setPillState('stopConfirm');
    assert.deepEqual(reported, ['pill/holdProgress', 'pill/state']);
  });
});

describe('C2: the built start-stop artboard defines every pill path the binding writes', () => {
  it('pill/state and pill/holdProgress are in build/start-stop.data.json', () => {
    const url = new URL('../rive/arcade-controls/start-stop/build/start-stop.data.json', import.meta.url);
    const dump = readFileSync(url, 'utf8');
    for (const path of [ARCADE_VM_PATHS.pillState, ARCADE_VM_PATHS.pillHoldProgress]) {
      assert.ok(dump.includes(`"path": "${path}"`) || dump.includes(`"path":"${path}"`), `${path} missing from the start-stop data dump`);
    }
  });

  it('wakes the host once per setter call that changed a value, never for a no-op or a missing path', () => {
    const { instance } = fakeInstance(['pill/state']);
    let wakes = 0;
    const binding = createArcadeRiveBinding(instance, { onDidWrite: () => { wakes += 1; } });
    binding.setStick({ x: 0.5, y: 0.5, engaged: true, direction: 'ne' });
    assert.equal(wakes, 1, 'three paths, one wake');
    binding.setStick({ x: 0.5, y: 0.5, engaged: true, direction: 'ne' });
    assert.equal(wakes, 1, 'unchanged reading');
    binding.setPillState('playing');
    assert.equal(wakes, 1, 'missing path');
    binding.setButtonState('a', 'pressed');
    assert.equal(wakes, 2);
    binding.dispose();
    binding.setButtonState('a', 'idle');
    assert.equal(wakes, 2, 'disposed');
  });
});

it('a closed native instance ends the binding instead of throwing', () => {
  let calls = 0;
  const closed = { set: () => { calls++; throw new Error('RiveResourceClosedException: ViewModelInstanceHandle(49) is closed'); } };
  const instance = { numberProperty: () => closed, booleanProperty: () => closed, enumProperty: () => closed, stringProperty: () => closed, triggerProperty: () => closed } as never;
  let woke = 0;
  const binding = createArcadeRiveBinding(instance, { onDidWrite: () => { woke++; } });
  assert.doesNotThrow(() => binding.setPillState('playing' as never));
  assert.doesNotThrow(() => binding.setStick({ x: 1, y: 0, engaged: true } as never));
  assert.equal(calls, 1, 'no writes after the first closed throw');
  assert.equal(woke, 0);
});
