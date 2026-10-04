import type { BloodlineId, LifecycleStage, MonSpeciesDef } from '@acme/core';

export interface Bloodline {
  readonly bloodlineId: BloodlineId;
  /** The roster's family name, verbatim (DECISIONS.md #11). */
  readonly bloodlineName: string;
}

/** Stable content key for a Dex record. Keyed by number until Q37 settles string form ids. */
export function speciesIdForDex(dexId: number): string {
  return `dex-${String(dexId).padStart(3, '0')}`;
}

/**
 * One Dex record as roster v11.1 registers it: number, form name, stage.
 * The roster settles nothing else, so every other canon field is TODO(canon)
 * and stays null until the v8 Dex or a creator decision supplies it.
 */
export function rosterForm(
  bloodline: Bloodline,
  dexId: number,
  formName: string,
  stage: LifecycleStage,
): MonSpeciesDef {
  return {
    speciesId: speciesIdForDex(dexId),
    dexId,
    bloodlineId: bloodline.bloodlineId,
    bloodlineName: bloodline.bloodlineName,
    formName,
    stage,
    // TODO(canon): food classes (OPEN_QUESTIONS Q22).
    foodClassIds: null,
    // TODO(canon): scale against the 1 m ground disc (Q29).
    scaleMeters: null,
    // TODO(canon): no rig before body data is canon.
    rigDefinitionId: null,
    // TODO(canon): species-card culture note (Q12, Q13).
    cultureNote: null,
    // TODO(canon): idle vignettes are authored per species once clips exist.
    idleVignettes: [],
    // TODO(canon): eight-Affinity list not authored (Q33).
    affinityId: null,
    // TODO(canon): combat Class list not authored.
    classId: null,
  };
}
