import { z } from 'zod';
import { PeekRoundSchema } from './play.ts';
import { EpochMsSchema, IdSchema } from './primitives.ts';

/** TODO(canon): v11 names an eight-Affinity direction without listing the eight. */
export const AffinitySchema = z.object({ affinityId: IdSchema });

/** TODO(canon): combat Class list is not authored yet. */
export const CombatClassSchema = z.object({ classId: IdSchema });

/** Bible v11: fainting is a recoverable 0-HP battle state, never death or an egg reset. */
export const CombatStatusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready') }),
  z.object({ kind: z.literal('fainted'), since: EpochMsSchema }),
]);

/** Battle clip ids required per battle-capable Mon (Bible v11 §3D rules). Phase-2 content. */
export const BATTLE_CLIP_IDS = ['attack', 'guard', 'hit', 'stagger', 'faint', 'recover', 'victory'] as const;
export const BattleClipIdSchema = z.enum(BATTLE_CLIP_IDS);

/** Surfaces one Mon continues across (Bible v11 §Cross-device). A surface is not a new creature. */
export const SURFACE_KINDS = ['mobile', 'web', 'quest', 'pico', 'vision-pro', 'alexa'] as const;
export const SurfaceKindSchema = z.enum(SURFACE_KINDS);

/** Voice maturity (Bible v11 §VoiceStudio). One `voiceLineageId` for life. */
export const VoiceStageSchema = z.enum(['baby-talk', 'limited', 'full']);
export const VoiceLineageSchema = z.object({
  voiceLineageId: IdSchema,
  monInstanceId: IdSchema,
  stage: VoiceStageSchema,
});

/** Hood Mon encounter seam. Hood means free-living, not hostile. TODO(canon): encounter rules. */
export const HoodEncounterSchema = z.object({
  encounterId: IdSchema,
  speciesId: IdSchema,
  observedAt: EpochMsSchema,
});

/**
 * Phase-2 shared play seam (M16 handoff, "Multiplayer seam"). Phase 1 writes
 * nothing with it; it exists so a shared Peek reuses the solo round model.
 * TODO(canon): how several Mons play together is not authored.
 */
export const PlaySessionSchema = z.object({
  sessionId: IdSchema,
  monInstanceIds: z.array(IdSchema).min(1),
  participants: z.array(z.object({ callerId: IdSchema })).min(1),
  startedAt: EpochMsSchema,
  rounds: z.array(PeekRoundSchema),
});
