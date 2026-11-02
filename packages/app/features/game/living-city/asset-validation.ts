// Pure validators for WorldAssetRegistry entry descriptors (spec §5:
// "normalized units/pivots/orientation … reject broken assets with
// actionable diagnostics"). They run on descriptors today — the seeded
// GLB entries are linked-by-uri, so these checks guard the declared
// contract now and the measured values once GLBs are actually imported.
// No three.js, no fs: every function takes plain data and returns issues.

import {
  ANIMATION_STATES,
  candidates,
  isSemanticId,
  resolve,
  type AnimationState,
  type AssetKind,
  type AssetPivot,
  type WorldAssetEntry,
  type WorldAssetRegistry,
} from './asset-registry.ts';

export interface ValidationIssue {
  /** Semantic id the issue belongs to (or the registry-level check name). */
  readonly id: string;
  readonly variant?: string;
  readonly severity: 'error' | 'warning';
  /** Short machine-checkable name, e.g. 'units', 'pivot', 'license'. */
  readonly check: string;
  readonly message: string;
}

const error = (entry: WorldAssetEntry, check: string, message: string): ValidationIssue => ({
  id: entry.id,
  variant: entry.variant,
  severity: 'error',
  check,
  message,
});

const warning = (entry: WorldAssetEntry, check: string, message: string): ValidationIssue => ({
  id: entry.id,
  variant: entry.variant,
  severity: 'warning',
  check,
  message,
});

/** Pivots the ground-standing contract accepts per kind (spec §5: origin at ground center). */
const KIND_PIVOTS: Record<AssetKind, readonly AssetPivot[]> = {
  vehicle: ['ground-center', 'wheelbase-center'],
  pedestrian: ['feet', 'ground-center'],
  prop: ['ground-center'],
};

export function validatePivot(entry: WorldAssetEntry): ValidationIssue[] {
  if (!KIND_PIVOTS[entry.kind].includes(entry.pivot)) {
    return [
      error(
        entry,
        'pivot',
        `kind ${entry.kind} requires pivot in {${KIND_PIVOTS[entry.kind].join(', ')}}, got '${entry.pivot}' — origin must sit at ground center`,
      ),
    ];
  }
  return [];
}

/** Plausible real-world extents in metres per kind — a car in centimetres (length 450) trips this. */
const UNIT_RANGES: Record<AssetKind, { lengthM: [number, number]; widthM: [number, number]; heightM: [number, number] }> = {
  vehicle: { lengthM: [2, 14], widthM: [1.2, 3], heightM: [1, 4] },
  pedestrian: { lengthM: [0.2, 1.2], widthM: [0.2, 1.2], heightM: [0.7, 2.3] },
  prop: { lengthM: [0.05, 15], widthM: [0.05, 15], heightM: [0.05, 15] },
};

export interface ExpectedSize {
  readonly lengthM?: number;
  readonly widthM?: number;
  readonly heightM?: number;
  /** Fraction the measured value may deviate before erroring. Default 0.25. */
  readonly tolerance?: number;
}

/**
 * Bounds check: every extent finite, positive, inside the kind's plausible
 * metre range; optionally within `expected` ± tolerance (e.g. sedan ≈ 4.5 m
 * long, adult ≈ 1.7 m tall).
 */
export function validateUnits(entry: WorldAssetEntry, expected?: ExpectedSize): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const b = entry.bounds;
  if (!b) {
    issues.push(warning(entry, 'units', 'no declared bounds — collision/clearance contract is undefined'));
    return issues;
  }
  const ranges = UNIT_RANGES[entry.kind];
  for (const axis of ['lengthM', 'widthM', 'heightM'] as const) {
    const v = b[axis];
    const [min, max] = ranges[axis];
    if (!Number.isFinite(v) || v <= 0) {
      issues.push(error(entry, 'units', `bounds.${axis} must be a positive finite number of metres, got ${v}`));
    } else if (v < min || v > max) {
      issues.push(
        error(entry, 'units', `bounds.${axis}=${v} m outside plausible ${entry.kind} range ${min}–${max} m — unit scale error?`),
      );
    }
    const want = expected?.[axis];
    if (want !== undefined && Number.isFinite(v)) {
      const tolerance = expected?.tolerance ?? 0.25;
      if (Math.abs(v - want) > want * tolerance) {
        issues.push(
          error(entry, 'units', `bounds.${axis}=${v} m deviates from expected ${want} m by more than ${tolerance * 100}%`),
        );
      }
    }
  }
  return issues;
}

const LOD_TIERS = ['near', 'medium', 'far'] as const;

export function validateLods(entry: WorldAssetEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!entry.lods) return issues;
  for (const key of Object.keys(entry.lods)) {
    if (!(LOD_TIERS as readonly string[]).includes(key)) {
      issues.push(error(entry, 'lods', `unknown LOD tier '${key}' — allowed: ${LOD_TIERS.join(', ')}`));
    }
  }
  for (const tier of LOD_TIERS) {
    const uri = entry.lods[tier];
    if (uri !== undefined && uri.trim() === '') {
      issues.push(error(entry, 'lods', `lods.${tier} is an empty URI`));
    }
  }
  return issues;
}

/**
 * Animation contract: declared states must be real AnimationStates; the
 * fallback pose must be a real state. `missingAnimationStates(entry)` lists
 * the states a renderer synthesises as the fallback pose — documentation by
 * construction.
 */
export function validateAnimations(entry: WorldAssetEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const states = ANIMATION_STATES as readonly string[];
  for (const key of Object.keys(entry.animations ?? {})) {
    if (!states.includes(key)) {
      issues.push(error(entry, 'animations', `'${key}' is not an AnimationState (${ANIMATION_STATES.join('/')})`));
    } else if (!entry.animations![key as AnimationState]) {
      issues.push(error(entry, 'animations', `animations.${key} is an empty clip name`));
    }
  }
  if (entry.fallbackPose !== undefined && !states.includes(entry.fallbackPose)) {
    issues.push(error(entry, 'animations', `fallbackPose '${entry.fallbackPose}' is not an AnimationState`));
  }
  return issues;
}

/**
 * License gate: a license string is mandatory on every entry; `ready`
 * requires the provenance license check to have run (licenseVerified true);
 * `pending-verification` must never claim verified. Keeps the ledger's
 * "PENDING never ships" rule enforceable by resolve() + this check.
 */
export function validateLicense(entry: WorldAssetEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!entry.license || entry.license.trim() === '') {
    issues.push(error(entry, 'license', 'license string is required on every entry'));
  }
  if (entry.status === 'ready' && !entry.provenance.licenseVerified) {
    issues.push(
      error(entry, 'license', `status 'ready' requires provenance.licenseVerified — verify ${entry.license} at source first`),
    );
  }
  if (entry.status === 'pending-verification' && entry.provenance.licenseVerified) {
    issues.push(error(entry, 'license', `status 'pending-verification' cannot claim licenseVerified`));
  }
  return issues;
}

/** General descriptor sanity: glb needs a uri, forward/up axes consistent, etc. */
export function validateShape(entry: WorldAssetEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isSemanticId(entry.id)) {
    issues.push(error(entry, 'shape', `id '${entry.id}' is not a stable semantic id (dot-namespaced, lowercase)`));
  }
  if (!entry.variant || entry.variant.trim() === '') {
    issues.push(error(entry, 'shape', 'variant is required and must be non-empty'));
  }
  if (entry.source === 'glb' && !entry.uri) {
    issues.push(error(entry, 'shape', `source 'glb' requires uri`));
  }
  if (entry.upAxis !== undefined && entry.upAxis !== '+Y') {
    issues.push(error(entry, 'shape', `upAxis must be '+Y'`));
  }
  return issues;
}

export function validateEntry(entry: WorldAssetEntry): ValidationIssue[] {
  return [
    ...validateShape(entry),
    ...validatePivot(entry),
    ...validateUnits(entry),
    ...validateLods(entry),
    ...validateAnimations(entry),
    ...validateLicense(entry),
  ];
}

/**
 * Whole-registry rules on top of per-entry checks:
 * - (id, variant) unique.
 * - every semantic id resolves to at least one usable entry under the
 *   default policy — a missing GLB must never break a renderer.
 * - every semantic id keeps a `primitive-fallback` candidate at the tail,
 *   so the chain always bottoms out somewhere drawable.
 */
export function validateRegistry(registry: WorldAssetRegistry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, WorldAssetEntry>();
  for (const entry of registry.entries) {
    issues.push(...validateEntry(entry));
    const key = `${entry.id} ${entry.variant}`;
    const first = seen.get(key);
    if (first) {
      issues.push(error(entry, 'registry', `duplicate candidate (id '${entry.id}', variant '${entry.variant}')`));
    } else {
      seen.set(key, entry);
    }
  }
  const checkedIds = new Set<string>();
  for (const entry of registry.entries) {
    if (checkedIds.has(entry.id)) continue;
    checkedIds.add(entry.id);
    const chain = candidates(registry, entry.id);
    if (resolve(registry, entry.id) === null) {
      issues.push({
        id: entry.id,
        severity: 'error',
        check: 'registry',
        message: `semantic id '${entry.id}' resolves to nothing under the default policy — no usable candidate`,
      });
    }
    if (!chain.some((c) => c.source === 'primitive-fallback')) {
      issues.push({
        id: entry.id,
        severity: 'error',
        check: 'registry',
        message: `semantic id '${entry.id}' has no primitive-fallback candidate — the fallback chain has no guaranteed tail`,
      });
    }
  }
  return issues;
}
