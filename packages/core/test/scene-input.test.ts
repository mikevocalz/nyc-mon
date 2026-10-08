import { describe, expect, expectTypeOf, it } from 'vitest';
import { loadSave } from '../save/migrate.ts';
import {
  ANIMATION_INTENTS,
  LIFECYCLE_STAGES,
  MON_MOODS,
  MonInstanceSchema,
  MonModelSlotSchema,
  MonSceneInputSchema,
  PoseSchema,
  SCENE_MODES,
} from '../schemas/index.ts';
import { createInitialCareState } from '../sim/care.ts';
import {
  buildMonSceneInput,
  deriveAnimationIntent,
  deriveMonMood,
  emptyModelSlots,
  IDLE_PRESENCE,
  MODEL_SLOT_STAGES,
  type ScenePresence,
} from '../sim/scene-input.ts';
import { type ResolvedSceneMode, resolveSceneMode } from '../sim/scene-mode.ts';
import { DEFAULT_CARE_TUNING } from '../sim/tuning.ts';
import type { AnimationIntent, CareState, ModelClipMap, MonSceneInput, SceneAnchors } from '../types/index.ts';
import { makeMon, T0 } from './harness.ts';

const LOW = DEFAULT_CARE_TUNING.needsAttentionBelow - 0.01;
const OK = Math.max(DEFAULT_CARE_TUNING.needsAttentionBelow, DEFAULT_CARE_TUNING.foodRequestBelow) + 0.1;

function care(overrides: Partial<CareState> = {}): CareState {
  return {
    ...createInitialCareState('mon_test', T0),
    energy: OK,
    fullness: OK,
    social: OK,
    pendingRequest: null,
    sluggishUntil: null,
    activity: { kind: 'awake' },
    ...overrides,
  };
}

describe('deriveMonMood', () => {
  it.each([
    ['content with every meter fine', care(), 'content'],
    ['asleep beats every need', care({ activity: { kind: 'asleep', since: T0 }, energy: 0, fullness: 0 }), 'asleep'],
    ['sluggish while sluggishUntil is after updatedAt', care({ sluggishUntil: T0 + 1, fullness: 0 }), 'sluggish'],
    ['not sluggish once sluggishUntil equals updatedAt', care({ sluggishUntil: T0 }), 'content'],
    ['a pending food request is needs-fullness', care({ pendingRequest: { need: 'fullness', since: T0 } }), 'needs-fullness'],
    ['low fullness beats low energy and social', care({ fullness: LOW, energy: LOW, social: LOW }), 'needs-fullness'],
    ['low energy beats low social', care({ energy: LOW, social: LOW }), 'needs-energy'],
    ['low social alone', care({ social: LOW }), 'needs-social'],
    ['a meter exactly at the threshold is met', care({ social: DEFAULT_CARE_TUNING.needsAttentionBelow }), 'content'],
  ] as const)('%s', (_name, input, expected) => {
    expect(deriveMonMood(input)).toBe(expected);
  });

  it('only ever returns a declared mood', () => {
    for (const energy of [0, LOW, OK]) {
      for (const fullness of [0, LOW, OK]) {
        for (const social of [0, LOW, OK]) {
          expect(MON_MOODS).toContain(deriveMonMood(care({ energy, fullness, social })));
        }
      }
    }
  });
});

describe('deriveAnimationIntent', () => {
  const at = (nowMs: number, rest: Partial<ScenePresence> = {}): ScenePresence => ({ ...IDLE_PRESENCE, nowMs, ...rest });
  const cue = { intent: 'eat', untilMs: 2_000 } as const;

  it.each([
    ['idle by default', care(), at(0), 'idle'],
    ['approach while the trigger is active', care(), at(0, { approachActive: true }), 'approach'],
    ['sleep while asleep, even if approached', care({ activity: { kind: 'asleep', since: T0 } }), at(0, { approachActive: true }), 'sleep'],
    ['a running cue beats sleep and approach', care({ activity: { kind: 'asleep', since: T0 } }), at(1_999, { cue, approachActive: true }), 'eat'],
    ['a cue ends at untilMs', care(), at(2_000, { cue, approachActive: true }), 'approach'],
    ['play cue', care(), at(0, { cue: { intent: 'play', untilMs: 1 } }), 'play'],
    ['evolve cue', care(), at(0, { cue: { intent: 'evolve', untilMs: 1 } }), 'evolve'],
  ] as const)('%s', (_name, c, presence, expected) => {
    expect(deriveAnimationIntent(c, presence)).toBe(expected);
  });
});

describe('buildMonSceneInput', () => {
  const mon = makeMon();
  const pose = { position: { x: 0, y: 0.74, z: -0.6 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
  const anchors: SceneAnchors = { space: 'local-floor', table: pose };
  const caps = {
    planeDetectionAvailable: true,
    sceneUnderstandingAvailable: true,
    localFloorAvailable: true,
    handTrackingAvailable: true,
  };
  const phone = resolveSceneMode({ platform: 'phone', capabilities: null, anchors: undefined, preference: 'room' });
  const build = (scene: ResolvedSceneMode, c: CareState = care()) =>
    buildMonSceneInput({ mon, care: c, bloodlineId: 'F01', scene, presence: IDLE_PRESENCE });

  it('builds a scene input from the resolver that parses and carries legend null', () => {
    const scene = resolveSceneMode({ platform: 'headset', capabilities: caps, anchors, preference: 'tabletop' });
    const input = build(scene, care({ social: LOW }));
    expect(MonSceneInputSchema.parse(input)).toEqual(input);
    expect(input).toEqual({
      mon: {
        monInstanceId: 'mon_test',
        speciesId: 'species-test',
        bloodlineId: 'F01',
        stage: 'Baby',
        care: { energy: OK, fullness: OK, social: LOW },
        mood: 'needs-social',
        intent: 'idle',
      },
      mode: 'tabletop',
      placement: 'table',
      anchors,
      hLynk: 'wrist_panel',
      legend: null,
    });
  });

  it('drops anchors the resolver rejected as stale, so the Mon stands on the floor', () => {
    const scene = resolveSceneMode({
      platform: 'headset',
      capabilities: { ...caps, planeDetectionAvailable: false, sceneUnderstandingAvailable: false },
      anchors,
      preference: 'tabletop',
    });
    const input = build(scene);
    expect(input.placement).toBe('floor');
    expect('anchors' in input).toBe(false);
    expect(MonSceneInputSchema.safeParse(input).success).toBe(true);
  });

  it('omits anchors and placement on phone', () => {
    const input = build(phone);
    expect('anchors' in input).toBe(false);
    expect(input.placement).toBeNull();
    expect(input.hLynk).toBe('app');
  });

  it('every resolver answer builds a scene input the schema accepts', () => {
    const bools = [false, true] as const;
    for (const platform of ['headset', 'phone', 'web'] as const) {
      for (const preference of ['room', 'tabletop', 'screen'] as const) {
        for (const scene of bools) {
          for (const floor of bools) {
            for (const table of bools) {
              for (const wall of bools) {
                const a: SceneAnchors = {
                  space: 'local-floor',
                  ...(table ? { table: pose } : {}),
                  ...(floor ? { floor: pose } : {}),
                  ...(wall ? { wall: pose } : {}),
                };
                const resolved = resolveSceneMode({
                  platform,
                  preference,
                  capabilities: { ...caps, sceneUnderstandingAvailable: scene, planeDetectionAvailable: scene },
                  anchors: a,
                });
                expect(MonSceneInputSchema.safeParse(build(resolved)).success).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('the schema rejects a table placement without a table anchor, and anchors in a flat mode', () => {
    const input = build(phone);
    expect(MonSceneInputSchema.safeParse({ ...input, mode: 'tabletop', placement: 'table', hLynk: 'hand_panel' }).success).toBe(false);
    expect(MonSceneInputSchema.safeParse({ ...input, anchors }).success).toBe(false);
    expect(MonSceneInputSchema.safeParse({ ...input, mode: 'room', placement: 'floor', hLynk: 'wrist_panel', anchors }).success).toBe(false);
  });

  it('refuses care that belongs to another Mon', () => {
    expect(() => build(phone, care({ monInstanceId: 'someone-else' }))).toThrow(/does not belong/);
  });

  it('legend is typed as null in Phase 1', () => {
    expectTypeOf<MonSceneInput['legend']>().toEqualTypeOf<null>();
    expect(MonSceneInputSchema.safeParse({ ...build(phone), legend: { legendId: 'x', blockId: 'y' } }).success).toBe(false);
  });

  it('street is declared in the schema but unreachable through the resolver by type', () => {
    expect(SCENE_MODES).toContain('street');
    expectTypeOf<ResolvedSceneMode['mode']>().toEqualTypeOf<'screen' | 'preview' | 'tabletop' | 'room'>();
  });
});

describe('poses', () => {
  it('accepts a unit quaternion and rejects a non-unit one', () => {
    const position = { x: 0, y: 0, z: 0 };
    expect(PoseSchema.safeParse({ position, orientation: { x: 0, y: 0.7071068, z: 0, w: 0.7071068 } }).success).toBe(true);
    expect(PoseSchema.safeParse({ position, orientation: { x: 0, y: 0, z: 0, w: 2 } }).success).toBe(false);
  });
});

describe('model slots', () => {
  it('clip map keys are exactly the animation intents', () => {
    expectTypeOf<keyof ModelClipMap>().toEqualTypeOf<AnimationIntent>();
    expect(Object.keys(emptyModelSlots(['F01'])[0]?.clips ?? {}).sort()).toEqual([...ANIMATION_INTENTS].sort());
  });

  it('slot stage order matches LIFECYCLE_STAGES', () => {
    expect(MODEL_SLOT_STAGES).toEqual(LIFECYCLE_STAGES);
  });

  it('one empty slot per bloodline × stage, all null', () => {
    const slots = emptyModelSlots(['F01', 'F02', 'F12']);
    expect(slots).toHaveLength(15);
    for (const slot of slots) {
      expect(MonModelSlotSchema.parse(slot)).toEqual(slot);
      expect(slot.glbUri).toBeNull();
      expect(Object.values(slot.clips).every((clip) => clip === null)).toBe(true);
    }
    expect(slots.map((s) => `${s.bloodlineId}:${s.stage}`)).toEqual(
      ['F01', 'F02', 'F12'].flatMap((b) => LIFECYCLE_STAGES.map((stage) => `${b}:${stage}`)),
    );
  });
});

describe('Phase-2 slots on MonInstance', () => {
  const legacy = {
    monInstanceId: 'mon_1',
    speciesId: 'dex-002',
    nickname: null,
    callerId: 'caller-1',
    hatchedAt: T0,
    bond: 0,
    stage: 'Baby',
    voiceLineageId: null,
  };

  it('a Mon written before the slots existed parses with null and empty defaults', () => {
    expect(MonInstanceSchema.parse(legacy)).toEqual({ ...legacy, originBlock: null, habitatTags: [], activeHours: null });
  });

  it('an existing v1 save without the slots still loads', () => {
    const raw = JSON.stringify({
      version: 1,
      savedAt: T0,
      caller: null,
      eggs: [],
      hatches: [],
      mons: [legacy],
      care: [],
      queue: { deviceId: 'device-1', nextSeq: 1, entries: [] },
    });
    expect(loadSave(raw).mons[0]).toEqual({ ...legacy, originBlock: null, habitatTags: [], activeHours: null });
  });

  it('accepts Phase-2 values when present', () => {
    const later = { ...legacy, originBlock: 'block-x', habitatTags: ['tag-a'], activeHours: { startMinute: 1_320, endMinute: 360 } };
    expect(MonInstanceSchema.parse(later)).toEqual(later);
  });

  it('rejects an out-of-range active window', () => {
    expect(MonInstanceSchema.safeParse({ ...legacy, activeHours: { startMinute: 0, endMinute: 1_440 } }).success).toBe(false);
  });
});
