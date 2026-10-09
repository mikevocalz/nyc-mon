import { z } from 'zod';
import { LifecycleStageSchema } from './lifecycle.ts';
import { IdSchema, UnitIntervalSchema } from './primitives.ts';
import { BloodlineIdSchema } from './species.ts';

/**
 * Where the Mon is presented (ADR 0010, 0011). `street` is the Phase-2 city
 * layer: it is part of the type so renderers handle it exhaustively, and
 * `resolveSceneMode` never returns it in Phase 1.
 */
export const SCENE_MODES = ['screen', 'tabletop', 'room', 'street', 'preview'] as const;
export const SceneModeSchema = z.enum(SCENE_MODES);

/** The modes `resolveSceneMode` can produce in Phase 1. */
export const PHASE1_SCENE_MODES = ['screen', 'tabletop', 'room', 'preview'] as const;
export const Phase1SceneModeSchema = z.enum(PHASE1_SCENE_MODES);

/** Where the H-Lynk UI lives: the flat app, a panel held by the hand or controller, or a panel on the wrist joint. */
export const H_LYNK_SURFACES = ['app', 'hand_panel', 'wrist_panel'] as const;
export const HLynkSurfaceSchema = z.enum(H_LYNK_SURFACES);

/**
 * Presentation state derived from care (`deriveMonMood`). Each value names a
 * care fact already in `CareState`; none adds a meter or a story claim.
 */
export const MON_MOODS = ['content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social'] as const;
export const MonMoodSchema = z.enum(MON_MOODS);

/** What the rig should play next (`deriveAnimationIntent`). Model slots carry one clip name per intent. */
export const ANIMATION_INTENTS = ['idle', 'approach', 'eat', 'sleep', 'play', 'evolve'] as const;
export const AnimationIntentSchema = z.enum(ANIMATION_INTENTS);

/** A point in metres. Every pose in the contract is in OpenXR LOCAL_FLOOR space: +Y up, floor at y = 0. */
export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

const UNIT_QUAT_TOLERANCE = 1e-3;

/** A rotation as a unit quaternion, `w` last (OpenXR `XrQuaternionf` order). */
export const QuatSchema = z
  .object({ x: z.number(), y: z.number(), z: z.number(), w: z.number() })
  .refine((q) => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) <= UNIT_QUAT_TOLERANCE, {
    message: 'orientation must be a unit quaternion',
  });

/** Position plus orientation, metres, LOCAL_FLOOR space. */
export const PoseSchema = z.object({ position: Vec3Schema, orientation: QuatSchema });

/**
 * Surfaces the headset found. Each anchor is optional on its own; the whole
 * object is absent on phone and web, where there is no scene model.
 */
export const SceneAnchorsSchema = z.object({
  space: z.literal('local-floor'),
  table: PoseSchema.optional(),
  floor: PoseSchema.optional(),
  wall: PoseSchema.optional(),
});

/** The care meters the renderer reads. Same names and range as `CareState`. */
export const SceneCareMetersSchema = z.object({
  energy: UnitIntervalSchema,
  fullness: UnitIntervalSchema,
  social: UnitIntervalSchema,
});

/** The Mon as the renderer sees it. Built only by `buildMonSceneInput`. */
export const MonSceneMonSchema = z.object({
  monInstanceId: IdSchema,
  speciesId: IdSchema,
  bloodlineId: BloodlineIdSchema,
  stage: LifecycleStageSchema,
  care: SceneCareMetersSchema,
  mood: MonMoodSchema,
  intent: AnimationIntentSchema,
});

/** Block identifier for a Mon's origin (Phase 2). Open string: canon has not listed blocks. */
export const OriginBlockIdSchema = z.string().min(1).max(128).brand<'OriginBlockId'>();

/** Habitat tag (Phase 2). Open string: canon has not listed habitats, so no union is frozen here. */
export const HabitatTagSchema = z.string().min(1).max(64).brand<'HabitatTag'>();

const MINUTES_PER_DAY = 1440;

/**
 * Local-time window a Mon is active in (Phase 2). Minutes after local
 * midnight; `endMinute < startMinute` wraps past midnight.
 */
export const ActiveHoursSchema = z.object({
  startMinute: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
  endMinute: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
});

/** Identifier of a block legend record (Phase 2). */
export const LegendIdSchema = z.string().min(1).max(128).brand<'LegendId'>();

/**
 * The Phase-2 legend reference a scene will carry: which block legend is
 * active around the Mon. Ids only; no legend content exists in canon yet.
 */
export const LegendRefSchema = z.object({ legendId: LegendIdSchema, blockId: OriginBlockIdSchema });

/** What the Mon stands on in an immersive mode. `null` in flat modes (`screen`, `preview`). */
export const SCENE_PLACEMENTS = ['table', 'floor'] as const;
export const ScenePlacementSchema = z.enum(SCENE_PLACEMENTS);

/**
 * Everything a renderer needs to draw one Mon in one place (ADR 0010).
 * `legend` is `null` in Phase 1; Phase 2 widens it to `LegendRefSchema.nullable()`.
 * Mode, placement, anchors and H-Lynk must agree: flat modes carry no
 * placement, no anchors and the `app` H-Lynk; `tabletop` has a placement and
 * a table placement has a table anchor; `room` stands on the floor and has
 * floor and wall anchors. `street` is unconstrained until Phase 2 defines it.
 */
export const MonSceneInputSchema = z
  .object({
    mon: MonSceneMonSchema,
    mode: SceneModeSchema,
    placement: ScenePlacementSchema.nullable(),
    anchors: SceneAnchorsSchema.optional(),
    hLynk: HLynkSurfaceSchema,
    legend: z.null(),
  })
  .refine(
    (scene) => {
      switch (scene.mode) {
        case 'screen':
        case 'preview':
          return scene.placement === null && scene.anchors === undefined && scene.hLynk === 'app';
        case 'tabletop':
          return (
            scene.placement !== null &&
            scene.hLynk !== 'app' &&
            (scene.placement !== 'table' || scene.anchors?.table !== undefined)
          );
        case 'room':
          return (
            scene.placement === 'floor' &&
            scene.hLynk !== 'app' &&
            scene.anchors?.floor !== undefined &&
            scene.anchors.wall !== undefined
          );
        case 'street':
          return true;
      }
    },
    { message: 'mode, placement, anchors and hLynk disagree' },
  );

/** One clip name per intent. `null` until the rig for that slot is delivered. */
export const ModelClipMapSchema = z.object({
  idle: z.string().min(1).nullable(),
  approach: z.string().min(1).nullable(),
  eat: z.string().min(1).nullable(),
  sleep: z.string().min(1).nullable(),
  play: z.string().min(1).nullable(),
  evolve: z.string().min(1).nullable(),
});

/**
 * The 3D asset for one bloodline at one stage. Mike supplies the glb files;
 * until then `glbUri` and every clip are `null` and renderers show their
 * placeholder.
 */
export const MonModelSlotSchema = z.object({
  bloodlineId: BloodlineIdSchema,
  stage: LifecycleStageSchema,
  glbUri: z.string().min(1).nullable(),
  clips: ModelClipMapSchema,
});
