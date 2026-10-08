import { describe, expect, it } from 'vitest';
import {
  type ResolvedSceneMode,
  resolveSceneMode,
  type SceneModeInput,
  type ScenePreference,
  type SceneRuntimeCapabilities,
  usableAnchors,
} from '../sim/scene-mode.ts';
import type { Pose, SceneAnchors } from '../types/index.ts';

const pose: Pose = { position: { x: 0, y: 0.75, z: -1 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };

const caps = (overrides: Partial<SceneRuntimeCapabilities> = {}): SceneRuntimeCapabilities => ({
  planeDetectionAvailable: true,
  sceneUnderstandingAvailable: true,
  localFloorAvailable: true,
  handTrackingAvailable: true,
  ...overrides,
});

const anchors = (parts: { table?: boolean; floor?: boolean; wall?: boolean }): SceneAnchors => ({
  space: 'local-floor',
  ...(parts.table === true ? { table: pose } : {}),
  ...(parts.floor === true ? { floor: pose } : {}),
  ...(parts.wall === true ? { wall: pose } : {}),
});

const headset = (input: Partial<SceneModeInput>): SceneModeInput => ({
  platform: 'headset',
  capabilities: caps(),
  anchors: anchors({ table: true, floor: true, wall: true }),
  preference: 'room',
  ...input,
});

const ROOM_ANCHORS = anchors({ table: true, floor: true, wall: true });
const NO_SCENE_CAPS = caps({ sceneUnderstandingAvailable: false, planeDetectionAvailable: false });

describe('resolveSceneMode: the ADR 0011 matrix', () => {
  const rows: readonly { name: string; input: SceneModeInput; expected: Omit<ResolvedSceneMode, 'anchors'> }[] = [
    {
      name: 'phone → screen, app H-Lynk, whatever the preference',
      input: { platform: 'phone', capabilities: null, anchors: undefined, preference: 'room' },
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'phone' },
    },
    {
      name: 'phone ignores capabilities and anchors',
      input: { platform: 'phone', capabilities: caps(), anchors: ROOM_ANCHORS, preference: 'tabletop' },
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'phone' },
    },
    {
      name: 'web → preview, app H-Lynk',
      input: { platform: 'web', capabilities: null, anchors: undefined, preference: 'room' },
      expected: { mode: 'preview', placement: null, hLynk: 'app', reason: 'web' },
    },
    {
      name: 'web ignores capabilities and anchors',
      input: { platform: 'web', capabilities: caps(), anchors: ROOM_ANCHORS, preference: 'screen' },
      expected: { mode: 'preview', placement: null, hLynk: 'app', reason: 'web' },
    },
    {
      name: 'headset with no capability probe → screen',
      input: headset({ capabilities: null }),
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'no-capabilities' },
    },
    {
      name: 'headset preferring screen → screen, even with full room anchors',
      input: headset({ preference: 'screen' }),
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'preferred-screen' },
    },
    {
      name: 'room with floor and wall anchors → room',
      input: headset({ anchors: anchors({ floor: true, wall: true }) }),
      expected: { mode: 'room', placement: 'floor', hLynk: 'wrist_panel', reason: 'room-anchors' },
    },
    {
      name: 'room without hand tracking → room with the hand panel',
      input: headset({ capabilities: caps({ handTrackingAvailable: false }) }),
      expected: { mode: 'room', placement: 'floor', hLynk: 'hand_panel', reason: 'room-anchors' },
    },
    {
      name: 'room on plane detection alone still counts as a scene model',
      input: headset({ capabilities: caps({ sceneUnderstandingAvailable: false }) }),
      expected: { mode: 'room', placement: 'floor', hLynk: 'wrist_panel', reason: 'room-anchors' },
    },
    {
      name: 'room missing the wall → tabletop on the table',
      input: headset({ anchors: anchors({ table: true, floor: true }) }),
      expected: { mode: 'tabletop', placement: 'table', hLynk: 'wrist_panel', reason: 'room-without-scene-anchors' },
    },
    {
      name: 'room missing the floor → tabletop on the table',
      input: headset({ anchors: anchors({ table: true, wall: true }) }),
      expected: { mode: 'tabletop', placement: 'table', hLynk: 'wrist_panel', reason: 'room-without-scene-anchors' },
    },
    {
      name: 'room with no anchors object → floor-placed tabletop on LOCAL_FLOOR',
      input: headset({ anchors: undefined }),
      expected: { mode: 'tabletop', placement: 'floor', hLynk: 'wrist_panel', reason: 'room-without-scene-anchors' },
    },
    {
      name: 'room with anchors but no scene model capability → anchors ignored → floor tabletop',
      input: headset({ capabilities: NO_SCENE_CAPS }),
      expected: { mode: 'tabletop', placement: 'floor', hLynk: 'wrist_panel', reason: 'room-without-scene-anchors' },
    },
    {
      name: 'tabletop with a table anchor → tabletop on the table',
      input: headset({ preference: 'tabletop' }),
      expected: { mode: 'tabletop', placement: 'table', hLynk: 'wrist_panel', reason: 'table-anchor' },
    },
    {
      name: 'tabletop without a table anchor → floor-placed tabletop',
      input: headset({ preference: 'tabletop', anchors: anchors({ floor: true, wall: true }) }),
      expected: { mode: 'tabletop', placement: 'floor', hLynk: 'wrist_panel', reason: 'no-table-anchor' },
    },
    {
      name: 'tabletop with a floor anchor and no LOCAL_FLOOR → floor-placed tabletop',
      input: headset({
        preference: 'tabletop',
        capabilities: caps({ localFloorAvailable: false, handTrackingAvailable: false }),
        anchors: anchors({ floor: true }),
      }),
      expected: { mode: 'tabletop', placement: 'floor', hLynk: 'hand_panel', reason: 'no-table-anchor' },
    },
    {
      name: 'tabletop with no anchors and no LOCAL_FLOOR → screen (no scene model at all)',
      input: headset({ preference: 'tabletop', capabilities: caps({ localFloorAvailable: false }), anchors: undefined }),
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'no-scene-model' },
    },
    {
      name: 'room with no scene model and no LOCAL_FLOOR → screen',
      input: headset({ capabilities: { ...NO_SCENE_CAPS, localFloorAvailable: false } }),
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'no-scene-model' },
    },
    {
      name: 'stale table anchor without scene capability is ignored → screen when no floor either',
      input: headset({
        preference: 'tabletop',
        capabilities: { ...NO_SCENE_CAPS, localFloorAvailable: false },
        anchors: anchors({ table: true }),
      }),
      expected: { mode: 'screen', placement: null, hLynk: 'app', reason: 'no-scene-model' },
    },
  ];

  it.each(rows)('$name', ({ input, expected }) => {
    const { anchors: _accepted, ...rest } = resolveSceneMode(input);
    expect(rest).toEqual(expected);
  });

  it('hands back no anchors when it drops them as stale', () => {
    const out = resolveSceneMode(headset({ capabilities: NO_SCENE_CAPS }));
    expect(out).toMatchObject({ mode: 'tabletop', placement: 'floor' });
    expect(out.anchors).toBeUndefined();
  });

  it('hands back the accepted anchors for room and table placement', () => {
    expect(resolveSceneMode(headset({})).anchors).toEqual(ROOM_ANCHORS);
    expect(resolveSceneMode(headset({ preference: 'tabletop' })).anchors).toEqual(ROOM_ANCHORS);
  });
});

describe('resolveSceneMode: invariants over every input combination', () => {
  const bools = [false, true] as const;
  const preferences: readonly ScenePreference[] = ['room', 'tabletop', 'screen'];
  const inputs: SceneModeInput[] = [];
  for (const platform of ['headset', 'phone', 'web'] as const) {
    for (const preference of preferences) {
      for (const hasCaps of bools) {
        for (const plane of bools) {
          for (const scene of bools) {
            for (const localFloor of bools) {
              for (const hands of bools) {
                for (const table of bools) {
                  for (const floor of bools) {
                    for (const wall of bools) {
                      for (const hasAnchors of bools) {
                        inputs.push({
                          platform,
                          preference,
                          capabilities: hasCaps
                            ? caps({
                                planeDetectionAvailable: plane,
                                sceneUnderstandingAvailable: scene,
                                localFloorAvailable: localFloor,
                                handTrackingAvailable: hands,
                              })
                            : null,
                          anchors: hasAnchors ? anchors({ table, floor, wall }) : undefined,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  it('covers the full cartesian product', () => {
    expect(inputs).toHaveLength(3 * 3 * 2 ** 9);
  });

  it('never returns street', () => {
    for (const input of inputs) expect(resolveSceneMode(input).mode).not.toBe('street');
  });

  it('only a headset leaves the app H-Lynk, and only in an immersive mode', () => {
    for (const input of inputs) {
      const out = resolveSceneMode(input);
      const immersive = out.mode === 'room' || out.mode === 'tabletop';
      expect(out.hLynk === 'app').toBe(!immersive);
      if (immersive) expect(input.platform).toBe('headset');
    }
  });

  it('the wrist panel appears exactly when hands are tracked in an immersive mode', () => {
    for (const input of inputs) {
      const out = resolveSceneMode(input);
      if (out.hLynk === 'app') continue;
      expect(out.hLynk === 'wrist_panel').toBe(input.capabilities?.handTrackingAvailable === true);
    }
  });

  it('room is only reached when preferred, with floor and wall anchors and a scene model', () => {
    for (const input of inputs) {
      if (resolveSceneMode(input).mode !== 'room') continue;
      expect(input.preference).toBe('room');
      expect(input.anchors?.floor).toBeDefined();
      expect(input.anchors?.wall).toBeDefined();
      const c = input.capabilities;
      expect(c !== null && (c.planeDetectionAvailable || c.sceneUnderstandingAvailable)).toBe(true);
    }
  });

  it('anchors are exactly the usable ones in immersive modes and absent in flat modes', () => {
    for (const input of inputs) {
      const out = resolveSceneMode(input);
      if (out.mode === 'screen' || out.mode === 'preview') {
        expect(out.anchors).toBeUndefined();
        expect(out.placement).toBeNull();
      } else {
        expect(input.capabilities).not.toBeNull();
        if (input.capabilities !== null) expect(out.anchors).toEqual(usableAnchors(input.capabilities, input.anchors));
      }
    }
  });

  it('a table placement always comes with an accepted table anchor', () => {
    for (const input of inputs) {
      const out = resolveSceneMode(input);
      if (out.placement === 'table') expect(out.anchors?.table).toBeDefined();
      if (out.mode === 'room') expect(out.placement).toBe('floor');
    }
  });

  it('a preference for screen is always honoured on a headset', () => {
    for (const input of inputs) {
      if (input.platform === 'headset' && input.preference === 'screen') {
        expect(resolveSceneMode(input).mode).toBe('screen');
      }
    }
  });
});
