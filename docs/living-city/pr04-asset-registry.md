# PR04 — WorldAssetRegistry + GLB import tooling

Living City spec §5 / §13 row PR04. Branch `lane-lc-registry` (based on
`origin/main`, independent of the v3 chain).

## Scope

A data-only, renderer-agnostic **WorldAssetRegistry** keyed by stable
semantic ids (`vehicle.sedan`, `ped.adult`, `prop.signalhead`, …) shared by
future vehicle and pedestrian renderers, plus pure descriptor validators and
a zero-dependency GLB container checker. No three.js imports, no
GLTFLoader — renderers consume descriptors.

## Paths

| Path | Role |
|---|---|
| `packages/app/features/game/living-city/asset-registry.ts` | Types + `WorldAssetRegistry`, `resolve` / `resolveChain` / `candidates`, immutable `register` / `unregister` / `markStatus`, animation-coverage helpers. Pure data module. |
| `packages/app/features/game/living-city/asset-validation.ts` | `validatePivot`, `validateUnits`, `validateLods`, `validateAnimations`, `validateLicense`, `validateShape`, `validateEntry`, `validateRegistry`. Pure validators returning `ValidationIssue[]`. |
| `packages/app/features/game/living-city/seed-assets.ts` | `SEED_ASSETS`: 6 semantic ids, 15 candidate entries. |
| `packages/app/features/game/living-city/asset-registry.test.ts` | 14 node:test cases (see Tests). |
| `tooling/assets/validate-glb.mjs` | Dependency-free GLB parser: magic/version/length, chunk table, JSON chunk, POSITION bounds + metre heuristic, clip names. CLI + exported `parseGlb`. |
| `docs/living-city/ASSET_NOTICES.md` | License notice table + hedges. |
| `docs/living-city/pr04-asset-registry.md` | This file. |

## Contract

`WorldAssetEntry` = `{ id, variant, kind, source: 'glb'|'procedural'|'primitive-fallback', uri?, params?, animations?, fallbackPose?, bounds?, pivot, forwardAxis?, upAxis?, lods?, license, status, provenance }`.

- **Fallback chain.** `candidates()` sorts glb → procedural →
  primitive-fallback; `resolve()` returns the first usable candidate
  (`ready`/`fallback`; `pending-verification` only with
  `{ allowPending: true }`). Every seeded id ends in a ready
  primitive-fallback — `validateRegistry` errors otherwise. Adaptation of
  the spec's per-entry `fallbackId`: the chain lives on the id, not per
  entry.
- **Status semantics.** `ready` = verified, usable; `pending-verification` =
  linked-by-URI under a ledger hedge (skipped by default resolve);
  `fallback` = degraded but usable stand-in.
- **Animations.** Optional `animations` map state→clip over the spec's ten
  states `idle/walk/run/wait/turn/cross/look/react/sit/board`; missing
  states render as `fallbackPose` (default `idle`). `providedAnimationStates`
  / `missingAnimationStates` make coverage computable.
- **License gate.** `ready` ⇒ `provenance.licenseVerified === true`;
  `pending-verification` ⇒ not verified. Enforced by `validateLicense`.

## Seeded registry — per-entry status

| Semantic id | Variant | Source | Status | License |
|---|---|---|---|---|
| `vehicle.sedan` | kenney-sedan | glb | pending-verification | CC0-1.0 |
| `vehicle.sedan` | three-car-generator | procedural | ready | MIT |
| `vehicle.sedan` | box | primitive-fallback | ready | internal |
| `vehicle.van` | kenney-van | glb | pending-verification | CC0-1.0 |
| `vehicle.van` | proc-van | procedural | ready | internal |
| `vehicle.van` | box | primitive-fallback | ready | internal |
| `vehicle.bus` | proc-bus | procedural | ready | internal |
| `vehicle.bus` | box | primitive-fallback | ready | internal |
| `ped.adult` | quaternius-ubc | glb | pending-verification | CC0-1.0 |
| `ped.adult` | three-person-generator | procedural | ready | MIT |
| `ped.adult` | box | primitive-fallback | ready | internal |
| `ped.kid` | kenney-animated | glb | pending-verification | CC0-1.0 |
| `ped.kid` | three-person-generator-kid | procedural | ready | MIT |
| `ped.kid` | box | primitive-fallback | ready | internal |
| `prop.signalhead` | three-trafficlight-generator | procedural | ready | MIT |
| `prop.signalhead` | box | primitive-fallback | ready | internal |

`vehicle.bus` intentionally has no glb candidate (ledger: no verified CC0
bus yet) — proves the chain tolerates a missing GLB tier.

## Stays pending-verification (hedges from asset-ledger.md)

- Kenney `sedan.glb`/`van.glb`: re-fetch Car Kit 3.1 from kenney.nl,
  SHA-256 compare against the fable-bundled copies, then vendor under
  `assets/living-city/…` and flip to `ready` via `markStatus`.
- Quaternius UBC/UAL (`ped.adult`): verify the exact zip's bundled license.
- Kenney animated characters (`ped.kid`): verify bundled license; rig
  differs from Quaternius → retarget.
- Mixamo: never registered (Adobe terms; no raw redistribution).
- GLB bounds in seeds are declared targets — measured bounds get verified
  on real import by `validate-glb.mjs` + `validateUnits`.

## Tests / acceptance

`node --test 'features/game/living-city/*.test.ts'` in `packages/app` —
14/14 pass; `tsc --noEmit` clean; `eslint` clean. Covers: resolve order,
pending-skip + `allowPending` preview, the **live sedan swap** (verify glb
→ glb resolves; unregister glb → procedural; unregister procedural →
primitive, same id), bus's missing-glb chain, unknown-id null, duplicate /
missing-tail registry errors, unit math (sedan 4.5 m, adult 1.7 m,
centimetre-scale rejected), pivot per kind, LOD tiers, animation-contract
completeness, license rules.

`validate-glb.mjs` smoke-tested on synthetic GLBs: valid file reports
`4.50×1.80×1.45 m` + clip names; bad magic rejected; 450 m extent flagged
as a units warning with nonzero exit. **PENDING:** wire the tool into CI /
a `pnpm` script when the first real GLB is vendored (none yet — by design).

## Dependencies / device

No new dependencies; no three.js import in any new file. Device/device-perf
verification: **PENDING** — nothing renders yet (PR05+ consumes
descriptors). No claims of hardware performance.

## Rollback

Delete `packages/app/features/game/living-city/`,
`tooling/assets/validate-glb.mjs`, and the two docs. Nothing else in the
repo imports these files; no save-format, scene or dependency changes.
