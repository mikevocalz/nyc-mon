import { describe, expect, it } from 'vitest';
import {
  type ApproachConfig,
  type ApproachFrame,
  type ApproachState,
  type ApproachSuppression,
  createApproachMachine,
  DEFAULT_APPROACH_CONFIG,
} from '../sim/approach.ts';

const CONFIG: ApproachConfig = {
  radii: { tabletop: { enterM: 0.5, exitM: 0.7 }, room: { enterM: 1, exitM: 1.5 } },
  fovHalfAngleDeg: 30,
  dwellMs: 1_000,
  cooldownMs: 5_000,
  maxTriggersPerSession: 3,
};

const MON = { id: 'mon', position: { x: 0, y: 0, z: 0 } };

/** Viewer at head height 1.6 m, `distance` metres from the origin along +z, looking at `look`. */
function frame(nowMs: number, distance: number, overrides: Partial<ApproachFrame> = {}): ApproachFrame {
  return {
    nowMs,
    tier: 'room',
    viewer: { position: { x: 0, y: 1.6, z: distance }, forward: { x: 0, y: -1.6, z: -distance } },
    targets: [MON],
    ...overrides,
  };
}

function run(machine = createApproachMachine(CONFIG), frames: readonly ApproachFrame[]) {
  let state: ApproachState = machine.initialState;
  const events = [];
  for (const f of frames) {
    const out = machine.advance(state, f);
    state = out.state;
    events.push(...out.events);
  }
  return { state, events };
}

describe('construction', () => {
  it('accepts the shipped defaults', () => {
    expect(() => createApproachMachine(DEFAULT_APPROACH_CONFIG)).not.toThrow();
  });

  it('defaults keep exit beyond enter on every tier', () => {
    for (const r of Object.values(DEFAULT_APPROACH_CONFIG.radii)) expect(r.exitM).toBeGreaterThan(r.enterM);
  });

  it.each([
    ['exit equal to enter', { ...CONFIG, radii: { ...CONFIG.radii, room: { enterM: 1, exitM: 1 } } }, /hysteresis/],
    ['exit below enter', { ...CONFIG, radii: { ...CONFIG.radii, tabletop: { enterM: 0.5, exitM: 0.4 } } }, /hysteresis/],
    ['zero enter radius', { ...CONFIG, radii: { ...CONFIG.radii, room: { enterM: 0, exitM: 1 } } }, /enterM/],
    ['NaN exit radius', { ...CONFIG, radii: { ...CONFIG.radii, room: { enterM: 1, exitM: Number.NaN } } }, /exitM/],
    ['zero FOV', { ...CONFIG, fovHalfAngleDeg: 0 }, /fovHalfAngleDeg/],
    ['FOV above 180', { ...CONFIG, fovHalfAngleDeg: 181 }, /fovHalfAngleDeg/],
    ['negative dwell', { ...CONFIG, dwellMs: -1 }, /dwellMs/],
    ['negative cooldown', { ...CONFIG, cooldownMs: -1 }, /cooldownMs/],
    ['fractional cap', { ...CONFIG, maxTriggersPerSession: 1.5 }, /maxTriggersPerSession/],
  ] as const)('rejects %s', (_name, config, message) => {
    expect(() => createApproachMachine(config)).toThrow(RangeError);
    expect(() => createApproachMachine(config)).toThrow(message);
  });

  it('accepts a 180° cone and zero dwell, cooldown and cap', () => {
    expect(() =>
      createApproachMachine({ ...CONFIG, fovHalfAngleDeg: 180, dwellMs: 0, cooldownMs: 0, maxTriggersPerSession: 0 }),
    ).not.toThrow();
  });
});

describe('enter and dwell', () => {
  it('starts once the target has dwelt exactly dwellMs inside enter radius', () => {
    const { state, events } = run(undefined, [frame(0, 0.9), frame(999, 0.9), frame(1_000, 0.9)]);
    expect(events).toEqual([{ type: 'approach-started', targetId: 'mon', atMs: 1_000 }]);
    expect(state.active).toEqual({ targetId: 'mon', sinceMs: 1_000 });
    expect(state.triggeredCount).toBe(1);
  });

  it('does not start one millisecond early', () => {
    const { state, events } = run(undefined, [frame(0, 0.9), frame(999, 0.9)]);
    expect(events).toEqual([]);
    expect(state.dwelling).toEqual({ mon: 0 });
  });

  it('treats the enter radius as inclusive', () => {
    const { events } = run(undefined, [frame(0, 1), frame(1_000, 1)]);
    expect(events).toHaveLength(1);
  });

  it('does not dwell just outside the enter radius', () => {
    const { state, events } = run(undefined, [frame(0, 1.0001), frame(5_000, 1.0001)]);
    expect(events).toEqual([]);
    expect(state.dwelling).toEqual({});
  });

  it('measures distance on the floor plane, not through head height', () => {
    const { events } = run(undefined, [frame(0, 0.95), frame(1_000, 0.95)]);
    expect(events).toHaveLength(1);
  });

  it('restarts dwell when the target leaves enter radius mid-dwell', () => {
    const { state, events } = run(undefined, [frame(0, 0.9), frame(600, 1.2), frame(700, 0.9), frame(1_600, 0.9)]);
    expect(events).toEqual([]);
    expect(state.dwelling).toEqual({ mon: 700 });
  });

  it('fires on the first frame with zero dwell', () => {
    const { events } = run(createApproachMachine({ ...CONFIG, dwellMs: 0 }), [frame(0, 0.5)]);
    expect(events).toEqual([{ type: 'approach-started', targetId: 'mon', atMs: 0 }]);
  });

  it('uses the radii of the frame tier', () => {
    const tabletop = (t: number, d: number) => frame(t, d, { tier: 'tabletop' });
    expect(run(undefined, [tabletop(0, 0.9), tabletop(1_000, 0.9)]).events).toEqual([]);
    expect(run(undefined, [tabletop(0, 0.5), tabletop(1_000, 0.5)]).events).toHaveLength(1);
  });
});

describe('forward cone', () => {
  const looking = (t: number, forward: { x: number; y: number; z: number }) =>
    frame(t, 0.9, { viewer: { position: { x: 0, y: 0, z: 0.9 }, forward } });

  it('dwells when looking straight at the target', () => {
    expect(run(undefined, [looking(0, { x: 0, y: 0, z: -1 }), looking(1_000, { x: 0, y: 0, z: -1 })]).events).toHaveLength(1);
  });

  it('includes the cone edge and excludes just past it', () => {
    const at = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      return { x: Math.sin(r), y: 0, z: -Math.cos(r) };
    };
    expect(run(undefined, [looking(0, at(29.999)), looking(1_000, at(29.999))]).events).toHaveLength(1);
    expect(run(undefined, [looking(0, at(30.01)), looking(1_000, at(30.01))]).events).toEqual([]);
  });

  it('never dwells while looking away', () => {
    expect(run(undefined, [looking(0, { x: 0, y: 0, z: 1 }), looking(1_000, { x: 0, y: 0, z: 1 })]).events).toEqual([]);
  });

  it('sees nothing with a zero forward vector', () => {
    expect(run(undefined, [looking(0, { x: 0, y: 0, z: 0 }), looking(1_000, { x: 0, y: 0, z: 0 })]).events).toEqual([]);
  });

  it('counts a target at the eye as seen', () => {
    const atEye = (t: number) =>
      frame(t, 0, { viewer: { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 } } });
    expect(run(undefined, [atEye(0), atEye(1_000)]).events).toHaveLength(1);
  });
});

describe('exit and hysteresis', () => {
  const started = [frame(0, 0.9), frame(1_000, 0.9)];

  it('stays active between enter and exit radius, and while looking away', () => {
    const away = frame(2_000, 1.4, { viewer: { position: { x: 0, y: 1.6, z: 1.4 }, forward: { x: 0, y: 0, z: 1 } } });
    const { state, events } = run(undefined, [...started, frame(1_500, 1.2), away]);
    expect(events).toHaveLength(1);
    expect(state.active?.targetId).toBe('mon');
  });

  it('stays active exactly on the exit radius', () => {
    expect(run(undefined, [...started, frame(2_000, 1.5)]).state.active).not.toBeNull();
  });

  it('ends just past the exit radius and starts cooldown', () => {
    const { state, events } = run(undefined, [...started, frame(2_000, 1.5001)]);
    expect(events.at(-1)).toEqual({
      type: 'approach-ended',
      targetId: 'mon',
      atMs: 2_000,
      reason: 'left-exit-radius',
      suppressionId: null,
    });
    expect(state.active).toBeNull();
    expect(state.cooldownUntilMs).toBe(7_000);
  });

  it('ends when the active target disappears', () => {
    const { events } = run(undefined, [...started, frame(2_000, 0.9, { targets: [] })]);
    expect(events.at(-1)).toMatchObject({ type: 'approach-ended', reason: 'target-gone' });
  });

  it('does not re-trigger by stepping across enter radius while active', () => {
    const { events } = run(undefined, [...started, frame(2_000, 1.2), frame(3_000, 0.9), frame(5_000, 0.9)]);
    expect(events.filter((e) => e.type === 'approach-started')).toHaveLength(1);
  });
});

describe('cooldown', () => {
  const endedAt2s = [frame(0, 0.9), frame(1_000, 0.9), frame(2_000, 3)];

  it('blocks dwell until cooldown ends, then needs a full dwell', () => {
    const { state, events } = run(undefined, [...endedAt2s, frame(6_999, 0.9), frame(7_000, 0.9), frame(7_999, 0.9)]);
    expect(events.filter((e) => e.type === 'approach-started')).toHaveLength(1);
    expect(state.dwelling).toEqual({ mon: 7_000 });
  });

  it('starts again at cooldown end plus dwell', () => {
    const { events } = run(undefined, [...endedAt2s, frame(7_000, 0.9), frame(8_000, 0.9)]);
    expect(events.at(-1)).toEqual({ type: 'approach-started', targetId: 'mon', atMs: 8_000 });
  });

  it('does not count dwell that happened during cooldown', () => {
    const { events } = run(undefined, [...endedAt2s, frame(3_000, 0.9), frame(7_000, 0.9)]);
    expect(events.filter((e) => e.type === 'approach-started')).toHaveLength(1);
  });
});

describe('session cap', () => {
  it('stops after maxTriggersPerSession', () => {
    const machine = createApproachMachine({ ...CONFIG, cooldownMs: 0, dwellMs: 0 });
    const frames: ApproachFrame[] = [];
    for (let k = 0; k < 6; k++) frames.push(frame(k * 100, 0.5), frame(k * 100 + 50, 3));
    const { state, events } = run(machine, frames);
    expect(events.filter((e) => e.type === 'approach-started')).toHaveLength(3);
    expect(state.triggeredCount).toBe(3);
  });

  it('a cap of zero never triggers', () => {
    const machine = createApproachMachine({ ...CONFIG, maxTriggersPerSession: 0, dwellMs: 0 });
    expect(run(machine, [frame(0, 0.1)]).events).toEqual([]);
  });

  it('a new session starts from initialState', () => {
    const machine = createApproachMachine({ ...CONFIG, maxTriggersPerSession: 1, dwellMs: 0 });
    expect(run(machine, [frame(0, 0.1)]).events).toHaveLength(1);
    expect(machine.advance(machine.initialState, frame(1, 0.1)).events).toHaveLength(1);
  });
});

describe('suppression', () => {
  const sleepingFrom = (fromMs: number): ApproachSuppression => ({ id: 'mon-asleep', isSuppressed: (f) => f.nowMs >= fromMs });
  const menuFrom = (fromMs: number): ApproachSuppression => ({ id: 'menu-open', isSuppressed: (f) => f.nowMs >= fromMs });

  it('blocks dwell while any rule matches', () => {
    const machine = createApproachMachine(CONFIG, [menuFrom(Infinity), sleepingFrom(0)]);
    const { state, events } = run(machine, [frame(0, 0.9), frame(5_000, 0.9)]);
    expect(events).toEqual([]);
    expect(state.dwelling).toEqual({});
  });

  it('ends an active trigger, names the rule, and starts cooldown', () => {
    const machine = createApproachMachine(CONFIG, [sleepingFrom(Infinity), menuFrom(50_000)]);
    const { state, events } = run(machine, [frame(0, 0.9), frame(1_000, 0.9), frame(50_000, 0.9)]);
    expect(events.at(-1)).toEqual({
      type: 'approach-ended',
      targetId: 'mon',
      atMs: 50_000,
      reason: 'suppressed',
      suppressionId: 'menu-open',
    });
    expect(state.cooldownUntilMs).toBe(55_000);
  });

  it('reports the first matching rule in injection order', () => {
    const machine = createApproachMachine(CONFIG, [sleepingFrom(60_000), menuFrom(50_000)]);
    const { events } = run(machine, [frame(0, 0.9), frame(1_000, 0.9), frame(60_000, 0.9)]);
    expect(events.at(-1)).toMatchObject({ suppressionId: 'mon-asleep' });
  });

  it('wins over the exit radius when both apply', () => {
    const machine = createApproachMachine(CONFIG, [menuFrom(2_000)]);
    const { events } = run(machine, [frame(0, 0.9), frame(1_000, 0.9), frame(2_000, 9)]);
    expect(events.at(-1)).toMatchObject({ reason: 'suppressed' });
  });
});

describe('one active trigger', () => {
  const two = (t: number, a: number, b: number): ApproachFrame => ({
    nowMs: t,
    tier: 'room',
    viewer: { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } },
    targets: [
      { id: 'b', position: { x: 0, y: 0, z: -b } },
      { id: 'a', position: { x: 0, y: 0, z: -a } },
    ],
  });

  it('picks the target that dwelt longest', () => {
    const { events } = run(undefined, [two(0, 0.9, 3), two(500, 0.9, 0.5), two(1_000, 0.9, 0.5), two(1_500, 0.9, 0.5)]);
    expect(events).toEqual([{ type: 'approach-started', targetId: 'a', atMs: 1_000 }]);
  });

  it('breaks a dwell tie by distance', () => {
    expect(run(undefined, [two(0, 0.9, 0.4), two(1_000, 0.9, 0.4)]).events[0]).toMatchObject({ targetId: 'b' });
  });

  it('breaks a full tie by id', () => {
    expect(run(undefined, [two(0, 0.7, 0.7), two(1_000, 0.7, 0.7)]).events[0]).toMatchObject({ targetId: 'a' });
  });

  it('ignores other targets while one is active', () => {
    const { state, events } = run(undefined, [two(0, 0.9, 0.9), two(1_000, 0.9, 0.9), two(5_000, 0.9, 0.9)]);
    expect(events).toHaveLength(1);
    expect(state.dwelling).toEqual({});
  });
});

describe('frame validation', () => {
  const machine = createApproachMachine(CONFIG);
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects nowMs %s and leaves state usable', (t) => {
    const state = machine.advance(machine.initialState, frame(0, 0.9)).state;
    expect(() => machine.advance(state, frame(t, 0.9))).toThrow(RangeError);
    expect(machine.advance(state, frame(1_000, 0.9)).events).toHaveLength(1);
  });

  it('rejects a NaN viewer or target coordinate', () => {
    const viewer = { position: { x: Number.NaN, y: 1.6, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
    expect(() => machine.advance(machine.initialState, frame(0, 0.9, { viewer }))).toThrow(/viewer/);
    const targets = [{ id: 'mon', position: { x: 0, y: Number.NaN, z: 0 } }];
    expect(() => machine.advance(machine.initialState, frame(0, 0.9, { targets }))).toThrow(/target mon/);
  });
});

describe('determinism and time', () => {
  it('returns equal output for equal input and never mutates state', () => {
    const machine = createApproachMachine(CONFIG);
    const state = machine.advance(machine.initialState, frame(0, 0.9)).state;
    const snapshot = JSON.stringify(state);
    const a = machine.advance(state, frame(1_000, 0.9));
    const b = machine.advance(state, frame(1_000, 0.9));
    expect(a).toEqual(b);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('clamps a frame from the past to the last time seen', () => {
    const { state } = run(undefined, [frame(5_000, 0.9), frame(4_000, 0.9)]);
    expect(state.lastNowMs).toBe(5_000);
    expect(state.dwelling).toEqual({ mon: 5_000 });
  });

  it('state survives a JSON round trip', () => {
    const machine = createApproachMachine(CONFIG);
    const mid = machine.advance(machine.initialState, frame(0, 0.9)).state;
    const revived = JSON.parse(JSON.stringify(mid)) as ApproachState;
    expect(machine.advance(revived, frame(1_000, 0.9))).toEqual(machine.advance(mid, frame(1_000, 0.9)));
  });
});
