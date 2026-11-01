// M5: the web gamepad source holds no window listener and no frame loop
// while nobody listens. Fakes the four browser globals it touches.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

type Listener = (event: unknown) => void;

function fakeTarget() {
  const map = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, fn: Listener) => { (map.get(type) ?? map.set(type, new Set()).get(type))!.add(fn); },
    removeEventListener: (type: string, fn: Listener) => { map.get(type)?.delete(fn); },
    count: (type: string) => map.get(type)?.size ?? 0,
    fire: (type: string, event: unknown) => { for (const fn of map.get(type) ?? []) fn(event); },
  };
}

const pad = { index: 0, id: 'Xbox Wireless Controller', connected: true, mapping: 'standard', buttons: [], axes: [] };
let win: ReturnType<typeof fakeTarget>;
let frames: Map<number, () => void>;
const saved: Record<string, PropertyDescriptor | undefined> = {};

function define(name: string, value: unknown) {
  saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

beforeEach(() => {
  win = fakeTarget();
  frames = new Map();
  let next = 1;
  define('window', win);
  define('document', { ...fakeTarget(), visibilityState: 'visible' });
  define('navigator', { getGamepads: () => [pad] });
  define('requestAnimationFrame', (fn: () => void) => { const id = next++; frames.set(id, fn); return id; });
  define('cancelAnimationFrame', (id: number) => { frames.delete(id); });
});

afterEach(() => {
  for (const [name, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
});

describe('M5: web gamepad teardown', () => {
  it('creating the source attaches nothing and starts no loop', async () => {
    const { createWebGamepadInput } = await import('./gamepad.web.ts');
    const source = createWebGamepadInput();
    assert.equal(win.count('gamepadconnected'), 0);
    assert.equal(frames.size, 0);
    assert.equal(source.getConnectedDevices().length, 1, 'still reports the attached pad');
  });

  it('the first listener starts the loop; the last one removed stops it and detaches the window listeners', async () => {
    const { createWebGamepadInput } = await import('./gamepad.web.ts');
    const source = createWebGamepadInput();
    const a = source.addOnButtonListener(() => undefined);
    const b = source.addOnAxisListener(() => undefined);
    assert.equal(win.count('gamepadconnected'), 1);
    assert.equal(win.count('gamepaddisconnected'), 1);
    assert.equal(frames.size, 1);
    a.remove();
    assert.equal(frames.size, 1, 'one listener left, loop keeps running');
    b.remove();
    b.remove();
    assert.equal(frames.size, 0);
    assert.equal(win.count('gamepadconnected'), 0);
    assert.equal(win.count('gamepaddisconnected'), 0);
  });
});
