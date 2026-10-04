import type { Bloodline, BloodlineId, EvolutionNode, LifecycleStage, MonSpeciesDef } from '@acme/core';

/** A bloodline's identity without its chain: the roster's family number and name. */
export interface BloodlineRef {
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
  bloodline: BloodlineRef,
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

function formsAt(forms: readonly MonSpeciesDef[], stage: LifecycleStage): readonly MonSpeciesDef[] {
  return forms.filter((form) => form.stage === stage);
}

function onlyFormAt(forms: readonly MonSpeciesDef[], stage: LifecycleStage): MonSpeciesDef {
  const matches = formsAt(forms, stage);
  const [only] = matches;
  if (matches.length !== 1 || only === undefined) {
    throw new Error(`Bloodline needs exactly one ${stage} form, found ${matches.length}`);
  }
  return only;
}

function toNode(form: MonSpeciesDef, evolvesTo: readonly EvolutionNode[]): EvolutionNode {
  return {
    speciesId: form.speciesId,
    dexId: form.dexId,
    formName: form.formName,
    stage: form.stage,
    // TODO(canon): no EvolutionEvent is authored, so nothing can fire (Law 7).
    evolutionDetails: [],
    evolvesTo: [...evolvesTo],
  };
}

/**
 * Builds a bloodline's evolution tree from its forms, per DECISIONS.md #12:
 * Egg → Baby → Small → Mid in a line, then Mid → each Max form as a branch.
 */
export function buildBloodline(ref: BloodlineRef, forms: readonly MonSpeciesDef[]): Bloodline {
  const maxForms = formsAt(forms, 'Max');
  if (maxForms.length === 0) throw new Error(`${ref.bloodlineId} has no Max form`);
  const mid = toNode(
    onlyFormAt(forms, 'Mid'),
    maxForms.map((max) => toNode(max, [])),
  );
  const small = toNode(onlyFormAt(forms, 'Small'), [mid]);
  const baby = toNode(onlyFormAt(forms, 'Baby'), [small]);
  const egg = toNode(onlyFormAt(forms, 'Egg'), [baby]);
  return { bloodlineId: ref.bloodlineId, bloodlineName: ref.bloodlineName, chain: egg };
}
