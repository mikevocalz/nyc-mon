// WorldAssetRegistry — Living City PR04 (spec §5).
//
// One shared, data-only registry of the meshes/actors renderers may draw,
// keyed by stable semantic ids (`vehicle.sedan`, `ped.adult`, …). Vehicles
// and pedestrians consume the SAME registry so a simulation class never
// names a file: it names a semantic id, and the registry decides which
// source (glb → procedural → primitive-fallback) currently backs it.
//
// Pure module: no three.js, no GLTFLoader, no fetch. Entries are
// descriptors; renderers (PR05+) turn them into geometry. A missing or
// failed GLB can never break a renderer because every semantic id carries
// a ready primitive-fallback candidate at the tail of its chain.

/** Animation states an actor mesh may provide (spec §5 contract). */
export const ANIMATION_STATES = [
  'idle',
  'walk',
  'run',
  'wait',
  'turn',
  'cross',
  'look',
  'react',
  'sit',
  'board',
] as const;
export type AnimationState = (typeof ANIMATION_STATES)[number];

export type AssetKind = 'vehicle' | 'pedestrian' | 'prop';

/** Where the descriptor's geometry comes from. Ordered: resolve() walks glb → procedural → primitive-fallback. */
export type AssetSource = 'glb' | 'procedural' | 'primitive-fallback';

/**
 * `ready`              — license + descriptor verified; renderers may use it now.
 * `pending-verification` — linked by URI but the ledger's hedge is still open
 *                        (hash re-fetch, zip license check). Skipped by
 *                        resolve() unless the caller opts in with allowPending.
 * `fallback`           — known-degraded stand-in; usable, lowest trust.
 */
export type AssetStatus = 'ready' | 'pending-verification' | 'fallback';

export type AssetPivot = 'ground-center' | 'wheelbase-center' | 'feet';
export type ForwardAxis = '+Z' | '-Z' | '+X' | '-X';

/** Metres. lengthM = the forward-axis extent (pedestrian depth), widthM = lateral, heightM = vertical. */
export interface AssetBounds {
  readonly lengthM: number;
  readonly widthM: number;
  readonly heightM: number;
}

/** URI per LOD tier; renderers pick by distance. Any subset may be declared. */
export interface AssetLods {
  readonly near?: string;
  readonly medium?: string;
  readonly far?: string;
}

/** Human-reviewable provenance. licenseVerified is only true after the exact vendored/referenced package was re-checked (asset-ledger rule). */
export interface AssetProvenance {
  readonly sourcePageUrl?: string;
  readonly originalFileUrl?: string;
  readonly generatorUrl?: string;
  readonly author?: string;
  readonly licenseVerified: boolean;
  readonly note?: string;
}

/** One candidate source for a semantic id. Several entries share an id; `variant` tells them apart. */
export interface WorldAssetEntry {
  /** Stable semantic id, e.g. `vehicle.sedan`. Never names a file or pack. */
  readonly id: string;
  /** Unique within `id`, e.g. `kenney-sedan`, `three-car-generator`, `box`. */
  readonly variant: string;
  readonly kind: AssetKind;
  readonly source: AssetSource;
  /**
   * Where the source lives, without loading it:
   * - glb: packaged-relative URI (`assets/living-city/…`). Files are linked,
   *   not vendored, until the ledger hedge clears.
   * - procedural / primitive-fallback: a recipe ref (`proc:box-car`,
   *   `three:examples/jsm/generators/city/CarGenerator.js#sedan`).
   */
  readonly uri?: string;
  /** Recipe parameters for procedural/primitive sources (scale, palette, recipe-specific). */
  readonly params?: Readonly<Record<string, number | string>>;
  /** state → clip name. Missing states are rendered as `fallbackPose` (default `idle`). */
  readonly animations?: Partial<Record<AnimationState, string>>;
  readonly fallbackPose?: AnimationState;
  /** Declared bounds in metres — the collision/clearance contract. Verified against real GLB bounds on import. */
  readonly bounds?: AssetBounds;
  readonly pivot: AssetPivot;
  readonly forwardAxis?: ForwardAxis;
  readonly upAxis?: '+Y';
  readonly lods?: AssetLods;
  /** SPDX-ish tag: `CC0-1.0`, `MIT`, `internal`, or a `requires-review` label. Never empty. */
  readonly license: string;
  readonly status: AssetStatus;
  readonly provenance: AssetProvenance;
}

export interface WorldAssetRegistry {
  readonly entries: readonly WorldAssetEntry[];
}

/** Resolve preference order — spec §5 chain glb → procedural → primitive-fallback. */
const SOURCE_PRIORITY: Record<AssetSource, number> = {
  glb: 0,
  procedural: 1,
  'primitive-fallback': 2,
};

const SEMANTIC_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;

export function isSemanticId(id: string): boolean {
  return SEMANTIC_ID_PATTERN.test(id);
}

export function createWorldAssetRegistry(entries: readonly WorldAssetEntry[]): WorldAssetRegistry {
  return { entries: [...entries] };
}

/** All semantic ids currently registered, sorted for stable iteration/snapshots. */
export function semanticIds(registry: WorldAssetRegistry): string[] {
  return [...new Set(registry.entries.map((e) => e.id))].sort();
}

export function getEntry(
  registry: WorldAssetRegistry,
  id: string,
  variant: string,
): WorldAssetEntry | undefined {
  return registry.entries.find((e) => e.id === id && e.variant === variant);
}

/** Candidates for one semantic id, ordered glb → procedural → primitive-fallback (registration order inside a tier). */
export function candidates(registry: WorldAssetRegistry, id: string): WorldAssetEntry[] {
  return registry.entries
    .filter((e) => e.id === id)
    .sort((a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]);
}

export interface ResolveOptions {
  /** Preview unverified GLBs in a dev harness. Default false: pending-verification entries are skipped. */
  readonly allowPending?: boolean;
}

/**
 * The descriptor a renderer should use for a semantic id: the highest-
 * priority candidate whose status is usable. `ready` and `fallback` are
 * usable; `pending-verification` needs opts.allowPending. Returns null only
 * when the id is unknown or every candidate is excluded — seeds guarantee a
 * ready primitive tail so renderers never see null for a seeded id.
 */
export function resolve(
  registry: WorldAssetRegistry,
  id: string,
  options?: ResolveOptions,
): WorldAssetEntry | null {
  for (const entry of candidates(registry, id)) {
    if (entry.status === 'pending-verification' && !options?.allowPending) continue;
    return entry;
  }
  return null;
}

/** Full ordered fallback chain for diagnostics/tests — includes pending entries. */
export function resolveChain(registry: WorldAssetRegistry, id: string): WorldAssetEntry[] {
  return candidates(registry, id);
}

/**
 * Returns a new registry with `entry` added, replacing any existing entry
 * with the same (id, variant). Registries are immutable snapshots so a hot
 * asset swap is an atomic swap of the whole map, not in-place mutation.
 */
export function register(registry: WorldAssetRegistry, entry: WorldAssetEntry): WorldAssetRegistry {
  const rest = registry.entries.filter((e) => !(e.id === entry.id && e.variant === entry.variant));
  return { entries: [...rest, entry] };
}

/** Removes one (id, variant) candidate. The swap test uses this: drop the glb, the same id keeps rendering procedurally. */
export function unregister(
  registry: WorldAssetRegistry,
  id: string,
  variant: string,
): WorldAssetRegistry {
  return { entries: registry.entries.filter((e) => !(e.id === id && e.variant === variant)) };
}

/** Flips a candidate's status (e.g. pending-verification → ready after a hash check). Registry stays immutable. */
export function markStatus(
  registry: WorldAssetRegistry,
  id: string,
  variant: string,
  status: AssetStatus,
): WorldAssetRegistry {
  return {
    entries: registry.entries.map((e) =>
      e.id === id && e.variant === variant ? { ...e, status } : e,
    ),
  };
}

/** Every animation state an entry actually provides. */
export function providedAnimationStates(entry: WorldAssetEntry): AnimationState[] {
  const keys = Object.keys(entry.animations ?? {}) as AnimationState[];
  return keys.filter((k) => (ANIMATION_STATES as readonly string[]).includes(k));
}

/** States a renderer must synthesise as the entry's fallback pose. */
export function missingAnimationStates(entry: WorldAssetEntry): AnimationState[] {
  const provided = new Set(providedAnimationStates(entry));
  return ANIMATION_STATES.filter((s) => !provided.has(s));
}

/** Pose used when a requested state isn't in `animations`. Defaults to `idle`. */
export function fallbackPose(entry: WorldAssetEntry): AnimationState {
  return entry.fallbackPose ?? 'idle';
}
