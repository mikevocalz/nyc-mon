import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONTROLLER_PROFILE, type InputSource, type PillState } from '../contract.ts';
import { createGameInputRouter } from '../create-game-input-router.ts';
import type { GamepadAxis } from '../../modules/nyc-gamepad-input/src/types/GamepadAxis';
import type { GamepadButton } from '../../modules/nyc-gamepad-input/src/types/GamepadButton';
import type { GamepadDevice } from '../../modules/nyc-gamepad-input/src/types/GamepadDevice';
import { createHardwareInputAdapter, type AdapterTimers } from './hardware-input-adapter.ts';
import type { HardwareInputSource } from './hardware-input-source.ts';

type Conn = (device: GamepadDevice, connected: boolean) => void;
type Btn = (button: GamepadButton, pressed: boolean, deviceId: string, timestampMs: number) => void;
type Axis = (axis: GamepadAxis, value: number, deviceId: string, timestampMs: number) => void;
type Key = (code: string, pressed: boolean, timestampMs: number) => void;

function fakeSource(devices: GamepadDevice[]) {
  const l = { conn: [] as Conn[], btn: [] as Btn[], axis: [] as Axis[], key: [] as Key[] };
  const add = <T>(list: T[], fn: T) => { list.push(fn); return { remove: () => { list.splice(list.indexOf(fn), 1); } }; };
  const source: HardwareInputSource = {
    isAvailable: true,
    getConnectedDevices: () => [...devices],
    addOnConnectionChangedListener: (fn) => add(l.conn, fn),
    addOnButtonListener: (fn) => add(l.btn, fn),
    addOnAxisListener: (fn) => add(l.axis, fn),
    addOnKeyListener: (fn) => add(l.key, fn),
  };
  return {
    source,
    devices,
    button: (b: GamepadButton, p: boolean, d: string, t: number) => l.btn.forEach((fn) => fn(b, p, d, t)),
    axis: (a: GamepadAxis, v: number, d: string, t: number) => l.axis.forEach((fn) => fn(a, v, d, t)),
    key: (c: string, p: boolean, t: number) => l.key.forEach((fn) => fn(c, p, t)),
    disconnect: (device: GamepadDevice) => {
      devices.splice(devices.findIndex((x) => x.id === device.id), 1);
      l.conn.forEach((fn) => fn(device, false));
    },
  };
}

const timers: AdapterTimers = { setTimeout: () => 0, clearTimeout: () => undefined };
const padA: GamepadDevice = { id: 'A', name: 'Pad A', family: 'xbox' };
const padB: GamepadDevice = { id: 'B', name: 'Pad B', family: 'playstation' };

function setup(devices: GamepadDevice[] = [padA, padB]) {
  const router = createGameInputRouter({ now: () => 1 });
  const fake = fakeSource(devices);
  let active: InputSource | null = null;
  const store = { setConnectedDevices: () => undefined, setActiveSource: (s: InputSource | null) => { active = s; } };
  const pill: PillState = 'playing';
  const adapter = createHardwareInputAdapter({
    router,
    source: fake.source,
    getOptions: () => ({ profile: DEFAULT_CONTROLLER_PROFILE, pill }),
    store,
    getActiveSource: () => active,
    timers,
  });
  return { router, fake, adapter, active: () => active, setActive: (s: InputSource | null) => { active = s; } };
}

describe('H8: only meaningful hardware input hides the touch overlay', () => {
  it('modifier keys, unbound keys, triggers and a resting stick do not mark a source active', () => {
    const { fake, active } = setup();
    fake.key('ShiftLeft', true, 1);
    fake.key('MetaLeft', true, 2);
    fake.key('KeyQ', true, 3);
    fake.axis('left-trigger', 0.3, 'A', 4);
    fake.axis('left-x', 0.05, 'A', 5); // inside the 0.15 dead zone
    fake.button('home', true, 'A', 6);
    assert.equal(active(), null);
  });

  it('a mapped key, a bound button and a real stick move do', () => {
    const k = setup();
    k.fake.key('KeyJ', true, 1);
    assert.equal(k.active(), 'keyboard');
    const b = setup();
    b.fake.button('south', true, 'A', 1);
    assert.equal(b.active(), 'gamepad');
    const s = setup();
    s.fake.axis('left-x', 0.9, 'A', 1);
    assert.equal(s.active(), 'gamepad');
  });
});

describe('M7: a stick begin the router rejected is retried', () => {
  it('after touch lets go, the next gamepad update arrives as a begin and is accepted', () => {
    const { router, fake } = setup();
    router.move(0.2, 0.2, 'begin', 'touch', 1);
    fake.axis('left-x', 0.9, 'A', 2); // begin rejected: touch owns the stick
    assert.equal(router.stick.x, 0.2);
    router.move(0, 0, 'end', 'touch', 3);
    fake.axis('left-x', 0.8, 'A', 4); // adapter thinks "update"; router has no owner
    assert.equal(router.stick.engaged, true);
    assert.ok(router.stick.x > 0.5, `stick x ${router.stick.x}`);
    assert.equal(router.diagnostics.activeSources.has('gamepad'), true);
  });
});

describe('M8: a disconnect releases only that device', () => {
  it('pad B leaving keeps pad A and the touch cap held', () => {
    const { router, fake, setActive } = setup();
    setActive('gamepad');
    router.buttonDown('z', 'touch', 1);
    fake.button('south', true, 'A', 2); // a
    fake.button('east', true, 'B', 3); // b
    fake.disconnect(padB);
    assert.deepEqual([...router.heldButtons].sort(), ['a', 'z']);
  });

  it('two pads on one button: the router sees one down, and the up only when the last pad lets go', () => {
    const { router, fake } = setup();
    fake.button('south', true, 'A', 1);
    fake.button('south', true, 'B', 2);
    assert.equal(router.diagnostics.rejected, 0);
    fake.disconnect(padA);
    assert.equal(router.heldButtons.has('a'), true);
    fake.button('south', false, 'B', 3);
    assert.equal(router.heldButtons.has('a'), false);
  });

  it('the stick ends only when the pad driving it leaves', () => {
    const { router, fake } = setup();
    fake.axis('left-x', 0.9, 'A', 1);
    fake.disconnect(padB);
    assert.equal(router.stick.engaged, true);
    fake.disconnect(padA);
    assert.equal(router.stick.engaged, false);
  });

  it('the last hardware device leaving while hardware drove cancels once with source-disconnected', () => {
    const { router, fake, setActive, active } = setup([padA]);
    const kinds: string[] = [];
    router.addListener((e) => kinds.push(e.kind === 'cancel-all' ? `cancel-all:${e.reason}` : e.kind));
    fake.button('south', true, 'A', 1);
    setActive('gamepad');
    fake.disconnect(padA);
    assert.equal(kinds.at(-1), 'cancel-all:source-disconnected');
    assert.equal(active(), null);
  });
});

describe('dispose', () => {
  it('releases only what the adapter holds and is idempotent', () => {
    const { router, fake, adapter } = setup();
    router.buttonDown('y', 'touch', 1);
    fake.button('west', true, 'A', 2);
    adapter.dispose();
    adapter.dispose();
    assert.deepEqual([...router.heldButtons], ['y']);
  });
});
