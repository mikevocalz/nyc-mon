# NYC-MON — Canon content sync (2026-10-28)

**Status:** source-backed reconciliation; **not** a new canon ruling or a gameplay-evolution launch.

## Authority and provenance

1. [Creator decisions](https://github.com/mikevocalz/nyc-mon/blob/main/docs/canon/DECISIONS.md) and the [v11.1 115-form roster](https://github.com/mikevocalz/nyc-mon/blob/main/docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md) determine **Dex IDs, names and lifecycle stages**.
2. The creator's `NYC_Mon_Master_Bible_v11.md` (Version 11, 4 October 2026) supplies the inherited **v8 ten-type Dex, art-direction size targets, form intros, 37 Max item/mastery cues and the Borough & Habitat Encounter Atlas**. These are copied as limited, labeled data extracts in `packages/content/mons/inherited-v11-details.ts` and `borough-encounters.ts`; the full working Bible is **not** added to this public repository by this sync.
3. [Current Canon Index](https://github.com/mikevocalz/nyc-mon/blob/main/docs/canon/source/NYC_MON_CURRENT_CANON_INDEX_v11.md) and [Gameplay Bible v12](https://github.com/mikevocalz/nyc-mon/blob/main/docs/canon/GAMEPLAY_BIBLE_V12.md) win over inherited v8 material wherever they conflict. In particular, **eight Affinities replace ten-type combat**, but there is **no approved conversion map**.
4. No names, home districts, measurements, evolution conditions or extra stages have been synthesized from concept art or real animal distribution.

## Data coverage after this sync

| Surface | Coverage | Contract |
|---|---:|---|
| Registered Dex, `rosterEntries` | **115 / 115** | Stable Dex IDs, bloodlines, roster names and stages, including explicit null where open |
| Resolved `bloodlines` | **18 / 19** | F01–F18 complete Egg → Baby → Small → Mid → one-or-more Max branches |
| Runnable-schema `allSpecies` | **109 / 115** | F01–F18 only; F19 isolated until lifecycle approval |
| Phase-1 starter bloodlines/eggs | **4 / 4** | F01, F02, F12 in original selection order, then F04 LanternFye (Signal Egg #020) in slot 4 ([Decision 38](https://github.com/mikevocalz/nyc-mon/blob/main/docs/canon/DECISIONS.md)). The Signal Egg's 3D mesh is the restored tan spotted egg Mike chose to ship; it does not match the red polka-dot art reference |
| Inherited legacy type labels | **109 / 109** | Read-only archival labels; never a combat `affinityId` |
| Per-form size direction | **109 / 109** | Text targets/ranges; `scaleMeters` remains null until numeric scale is authored |
| Per-form descriptive lore | **109 / 109** | Inherited authored introductions; not an individual's culture/biography |
| Max evolution item + mastery cues | **37 / 37** | Source-backed prerequisites **only**, not executable `EvolutionEvent` entries |
| Borough-level encounter profiles | **18 / 18** | Broad, habitat-first tiers; not a fixed district for any species |
| Approved home district | **0 / 115** | `districtId: null`; world district ownership has not been canonically assigned |
| Approved eight-Affinity migration | **0 / 115** | `affinityId: null`; no mapping from old ten types |
| Runnable evolution events | **0** | Intentionally unimplemented under [Law 7](https://github.com/mikevocalz/nyc-mon/blob/main/CONTRIBUTING.md); Phase 1 remains Egg → Baby only |

## Nine starter Max forms: sourced unlock cues

The v11 master includes the following inherited item/mastery conditions. These **do not automatically fire evolution**: the active system also needs a creator-approved event definition, eligibility/bond rules, authoritative server validation and Phase-1/full-game feature gating.

| Dex | Form | Evolution item | Mastery requirement |
|---:|---|---|---|
| #005 | Ratti Royale | Street Cred Crystal | Street Cred trial |
| #006 | Agua Ratti | Aqua Crystal | Rescue/flow trial for the chosen family |
| #007 | Phantom Ratti | Phantom Crystal | Night-route rescue trial |
| #012 | Bodega Baddiee Cee | Bodega Heart Orb | Corner defense trial |
| #013 | Knocka Cee | Knocker Orb | Rhythm/coordination trial |
| #014 | Midnight Cee | Midnight Orb | Stealth rescue trial |
| #065 | Fuego-Yote | Fire Crystal | Pressure-control trial |
| #066 | Yote del Eléctrico | Electric Crystal | Precision-route trial |
| #067 | Agua-Yote | Aqua Crystal | Rescue/flow trial for the chosen family |

The inherited progression baseline identifies **level 25** as the Max evolution minimum, but level alone is insufficient under current v11/v12 conditional-evolution rules. No bond threshold, quest-completion ID, item-consumption rule, ordering requirement or runtime trigger was invented.

## Remaining creator decisions / implementation gates

- **F19 `#110`**: Rentgoose-family Egg has no approved name. Keep `formName: null`, not `[OPEN]` as user-facing copy.
- **F19 `#114`**: Lordy Hordie is explicitly `Late-stage — v11 mapping open`. Keep `stage: null`, not an invented sixth stage or a fake Max. Until resolved, all six F19 forms appear in the **registered Dex only**, not `allSpecies` or runnable Bloodline chains; `#115` Grand Gander remains the known Max.
- **Mid → Max actual events**: authorize conditions, branch resolution, item inventory semantics, minBond if any, and feature gates before adding `evolutionDetails` or firing runtime events. Max branches must be mutually exclusive for one evolving individual.
- **Ten-type → eight-Affinity migration**: approve a mapping; do not copy `legacyTypeNames` into `affinityId`.
- **Districts**: author species-specific spawn/quest districts only if that is the intended product model. The existing v8 atlas explicitly uses **borough + microhabitat + time/season + progression**, not one species-to-borough pin. No real wildlife locations.
- **Sizing**: art-direction text is not a numeric rig/collision measurement; author measured `scaleMeters` using the shared 1 m ground disc.
- **Culture**: v11 defines culture at character/lineage/community levels; do not infer an individual culture, language or accent from a legacy combat type or location.

## Validation gates

Run `pnpm --filter @acme/content test`, `pnpm --filter @acme/content typecheck`, `pnpm --filter @acme/core typecheck`, and the repository CI. The content tests compare all 115 `rosterEntries` with the checked-in v11.1 table, validate the 18 complete chains, preserve the four starters in slot order, verify the nine original starter unlock items, and ensure **no** Phase-1 evolution event can fire.

**Merge policy:** review PR and CI evidence first; do not merge this sync into `main` without approval.
