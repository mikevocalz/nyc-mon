import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_SESSION_STATE, transitionSession, type SessionState } from '@acme/core';
import { DEFAULT_CAMERA_BINDINGS, type ControllerBindings, type StickReading } from '@acme/ui/game-controls/parts';
import { INITIAL_CITY_CAMERA, moveCityCamera } from './city-camera.ts';
import { commandToAction, panToAction } from './camera-input.ts';
import {
  BUTTON_REPEAT_DELAY_MS,
  BUTTON_REPEAT_MS,
  STICK_MAX_FRAME_SECONDS,
  STICK_PAN_DP_PER_SECOND,
  acceptsGameplayInput,
  buttonToCallerAction,
  buttonToCommand,
  isHoldAction,
  cancelAnnouncement,
  isRepeatable,
  nextRepeatAtMs,
  sessionEventsFor,
  stickToPanAction,
} from './game-input-bindings.ts';

const camera = { ...INITIAL_CITY_CAMERA, yaw: 0 };
const engaged = (x: number, y: number): StickReading => ({ x, y, engaged: true, direction: 'none' });
const neutral: StickReading = { x: 0, y: 0, engaged: false, direction: 'none' };

const playing: SessionState = { kind: 'playing', sessionId: 's1', startedAt: 10 };
const paused: SessionState = { kind: 'paused', sessionId: 's1', startedAt: 10, pausedAt: 20, cause: 'pill' };
const confirming: SessionState = { kind: 'stop-confirm', sessionId: 's1', startedAt: 10, pausedAt: 30, resumeTo: 'playing' };

test('stick right pans the camera right, stick up pans it forward', () => {
  const right = stickToPanAction(engaged(1, 0), camera, 800, 1 / 60);
  assert.ok(right && right.type === 'pan' && right.right > 0 && right.forward === 0);
  const up = stickToPanAction(engaged(0, 1), camera, 800, 1 / 60);
  assert.ok(up && up.type === 'pan' && up.forward > 0 && up.right === 0);
  // The same frame as a finger drag of the equivalent travel, through the shared maths.
  const travel = STICK_PAN_DP_PER_SECOND / 60;
  assert.deepEqual(right, panToAction(-travel, 0, camera, 800));
});

test('stick pan scales with deflection and is frame-rate independent', () => {
  const half = stickToPanAction(engaged(0.5, 0), camera, 800, 1 / 60);
  const full = stickToPanAction(engaged(1, 0), camera, 800, 1 / 60);
  assert.ok(half && full && half.type === 'pan' && full.type === 'pan');
  assert.ok(Math.abs(full.right / half.right - 2) < 1e-9);
  const twoFrames = stickToPanAction(engaged(1, 0), camera, 800, 2 / 60);
  assert.ok(twoFrames && twoFrames.type === 'pan' && Math.abs(twoFrames.right / full.right - 2) < 1e-9);
});

test('stick pan scales with camera distance, like a drag does', () => {
  const near = stickToPanAction(engaged(1, 0), { ...camera, distance: 200 }, 800, 1 / 60);
  const far = stickToPanAction(engaged(1, 0), { ...camera, distance: 400 }, 800, 1 / 60);
  assert.ok(near && far && near.type === 'pan' && far.type === 'pan');
  assert.ok(Math.abs(far.right / near.right - 2) < 1e-9);
});

test('a stalled frame is capped, so the camera never teleports', () => {
  const capped = stickToPanAction(engaged(1, 0), camera, 800, 5);
  const atCap = stickToPanAction(engaged(1, 0), camera, 800, STICK_MAX_FRAME_SECONDS);
  assert.deepEqual(capped, atCap);
});

test('neutral readings, bad viewports and bad frame steps pan nothing', () => {
  assert.equal(stickToPanAction(neutral, camera, 800, 1 / 60), null);
  assert.equal(stickToPanAction(engaged(1, 0), camera, 0, 1 / 60), null);
  assert.equal(stickToPanAction(engaged(1, 0), camera, 800, 0), null);
  assert.equal(stickToPanAction(engaged(1, 0), camera, 800, Number.NaN), null);
});

test('the default bindings drive the Caller: every cap names a Caller action, none a camera command', () => {
  const expected = { x: 'recentre', y: 'zoomCycle', z: 'look', a: 'jump', b: 'run', c: 'interact' } as const;
  for (const id of ['x', 'y', 'z', 'a', 'b', 'c'] as const) {
    assert.equal(buttonToCallerAction(id, DEFAULT_CAMERA_BINDINGS), expected[id]);
    assert.equal(buttonToCommand(id, DEFAULT_CAMERA_BINDINGS), null);
  }
  assert.equal(isHoldAction('run'), true);
  assert.equal(isHoldAction('look'), true);
  for (const action of ['jump', 'interact', 'recentre', 'zoomCycle'] as const) assert.equal(isHoldAction(action), false);
  assert.equal(buttonToCallerAction('a', { ...DEFAULT_CAMERA_BINDINGS, a: { action: 'jump', label: 'A', enabled: false } }), null);
});

test('a custom camera map still maps caps to camera commands that move the camera', () => {
  const cameraMap: ControllerBindings = {
    x: { action: 'zoomIn', label: 'X' }, y: { action: 'zoomOut', label: 'Y' }, z: { action: 'reset', label: 'Z' },
    a: { action: 'rotateLeft', label: 'A' }, b: { action: 'rotateRight', label: 'B' }, c: { action: 'moveForward', label: 'C' },
  };
  for (const id of ['x', 'y', 'z', 'a', 'b', 'c'] as const) {
    const command = buttonToCommand(id, cameraMap);
    assert.ok(command !== null, `${id} is bound`);
    assert.equal(buttonToCallerAction(id, cameraMap), null);
    assert.notDeepEqual(moveCityCamera({ ...camera, yaw: 0.3 }, commandToAction(command, camera)), { ...camera, yaw: 0.3 });
  }
});

test('a disabled or unknown binding maps to no command', () => {
  const bindings: ControllerBindings = {
    ...DEFAULT_CAMERA_BINDINGS,
    x: { action: 'zoomIn', label: 'X', enabled: false },
    y: { action: 'castSpell', label: 'Y' },
    z: { action: 'reset', label: 'Z' },
  };
  assert.equal(buttonToCommand('x', bindings), null);
  assert.equal(buttonToCommand('y', bindings), null);
  assert.equal(buttonToCallerAction('y', bindings), null);
  assert.equal(buttonToCommand('z', bindings), 'reset');
});

test('held caps repeat on a bounded schedule; reset never repeats', () => {
  assert.equal(isRepeatable('zoomIn'), true);
  assert.equal(isRepeatable('moveForward'), true);
  assert.equal(isRepeatable('reset'), false);
  assert.equal(nextRepeatAtMs(1000, 0), 1000 + BUTTON_REPEAT_DELAY_MS);
  assert.equal(nextRepeatAtMs(1000, 1), 1000 + BUTTON_REPEAT_DELAY_MS + BUTTON_REPEAT_MS);
  assert.equal(nextRepeatAtMs(1000, 3) - nextRepeatAtMs(1000, 2), BUTTON_REPEAT_MS);
  assert.ok(BUTTON_REPEAT_MS >= 100, 'never faster than ten steps a second');
});

test('pause and resume requests are one pillPress, only in the state that accepts them', () => {
  assert.deepEqual(sessionEventsFor('pause-request', playing, 5), [{ type: 'pillPress', at: 5 }]);
  assert.deepEqual(sessionEventsFor('pause-request', paused, 5), []);
  assert.deepEqual(sessionEventsFor('resume-request', paused, 5), [{ type: 'pillPress', at: 5 }]);
  assert.deepEqual(sessionEventsFor('resume-request', playing, 5), []);
  assert.deepEqual(sessionEventsFor('resume-request', INITIAL_SESSION_STATE, 5), []);
});

test('a stop request confirms a hold the session already knows, or opens and confirms one for hardware', () => {
  assert.deepEqual(sessionEventsFor('stop-request', confirming, 7), [{ type: 'confirmStop', at: 7 }]);
  assert.deepEqual(sessionEventsFor('stop-request', playing, 7), [{ type: 'stopConfirm', at: 7 }, { type: 'confirmStop', at: 7 }]);
  assert.deepEqual(sessionEventsFor('stop-request', INITIAL_SESSION_STATE, 7), []);
  // Replaying the hardware pair through the real machine ends the session with one final save.
  let state: SessionState = playing;
  const effects: { reason: string }[] = [];
  for (const event of sessionEventsFor('stop-request', playing, 7)) {
    const transition = transitionSession(state, event);
    state = transition.state;
    effects.push(...transition.effects);
  }
  assert.equal(state.kind, 'idle');
  assert.deepEqual(effects.map((e) => e.reason), ['stop']);
});

test('only a playing session accepts stick and cap input', () => {
  assert.equal(acceptsGameplayInput(playing), true);
  assert.equal(acceptsGameplayInput(paused), false);
  assert.equal(acceptsGameplayInput(confirming), false);
  assert.equal(acceptsGameplayInput(INITIAL_SESSION_STATE), false);
});

test('every cancel reason has a copy-deck line within its limit', () => {
  const limits = { background: 44, 'fold-change': 44, 'layout-change': 40, 'source-disconnected': 48, 'gesture-cancel': 16, 'focus-loss': 16, 'screen-transition': 16 } as const;
  for (const [reason, max] of Object.entries(limits) as [keyof typeof limits, number][]) {
    const line = cancelAnnouncement(reason);
    assert.ok(line.length > 0 && line.length <= max, `${reason}: "${line}" within ${max}`);
  }
});
