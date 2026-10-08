# ADR 0013: Park Phase 2 legends and street encounters; type the seams now

- **Status:** Accepted (2026-10-08, design only)
- **Date:** 2026-10-08
- **Deciders:** Mike (creator) for the canon questions; engineering for the seams
- **Canon:** `V11 ¶13`, `¶40`, `¶41`, `¶43`, `¶69`, `¶111`; `docs/phase-1-brief.md` L17; `CONTRIBUTING.md` Law 9
- **Design note:** `docs/spatial/PHASE2-LEGENDS.md`
- **Related:** `docs/spatial/CONTRACT.md`, `docs/adr/0010-spatial-scene-contract.md`, `docs/adr/0011-mode-resolution.md`, `docs/adr/0012-approach-trigger.md`

## Context

The slogan is "EVERY BLOCK HAS A LEGEND." (`V11 ¶13`), and canon puts real stakes at block level (`V11 ¶40`), but it defines no legend mechanic. Phase 1 excludes Hood Mon encounters and scanning and asks for typed stubs plus an ADR on how they attach later (`docs/phase-1-brief.md` L17).

Building real-city encounters now would mean inventing canon (what a legend is, where each starter lives, what a meeting does), shipping location features to an audience that includes minors before the safety rules are validated, and starting a crowded product category before any freedom-to-operate review. The positioning stack is also unproven in NYC: GPS.gov puts phone accuracy at 4.9 m under open sky and says it "worsens near buildings, bridges, and trees" (https://archive.gps.gov/systems/gps/performance/accuracy/), and Apple's localization imagery "doesn't include images of gated or pedestrian-only areas" (https://developer.apple.com/documentation/arkit/argeotrackingconfiguration).

The cost of not typing the seams now is a schema migration later across content, the spatial store and the mode resolver, which are being defined this week in `docs/spatial/CONTRACT.md`.

## Decision

**DEFER** Phase 2 legends and street encounters. The blocker is a set of decisions (canon and legal), not a missing subsystem, so this is a deferral, not a strike.

**Typed now, empty or null, no behavior:**

| Field / value | Where | Phase 1 value | Meaning when Phase 2 lands |
|---|---|---|---|
| `originBlock` | `MonInstance` (save) | `null` | The block a legend or Mon belongs to; open question 3 in the design note decides whose block it is |
| `habitatTags` | `MonInstance` (save) | `[]` | Built-environment categories a Mon frequents; never encodes income, race or ethnicity |
| `activeHours` | `MonInstance` (save) | `null` | Local-time windows a Mon is around; never requires late night |
| `legend` | Scene input | `null` | The live legend record, shape set when Mike defines "legend" |
| `'street'` | Mode union in the mode resolver | declared, never resolved | Phone-only outdoor mode, gated by every safety rule in the design note §5 |

The resolver must handle `'street'` in its exhaustive switch (standing standard: exhaustive `switch` on every discriminated union) and return a non-street mode in Phase 1. Headset platforms can never resolve to `'street'`. No location permission is requested in Phase 1.

No values for `habitatTags` or `activeHours` enter `content/` until Mike ratifies the starter ecology. The proposals (Yotes at parks at dawn/dusk, Bodega Cee "warm spot", Hood Ratti "low routes") and the v7 tags (`street`, `transit_set`, `courtyard`, `community_hub`) are not canon and stay out of data.

## Options considered

**A. Build a street-encounter slice in Phase 1.** Rejected. It needs canon that doesn't exist, contradicts the brief's scope line, and puts unvalidated location features in front of minors.

**B. Do nothing until Phase 2.** Rejected. The spatial contract is being written now; leaving these fields out means a breaking change to content, store and resolver later.

**C. Type the seams, build nothing, write the safety and legal gates down (chosen).** Costs four typed fields (`originBlock`, `habitatTags`, `activeHours`, `legend`) and one dead union member (`'street'`). Keeps every Phase 2 option open.

## Consequences

- Content, the store and the resolver carry fields that do nothing yet. Reviewers should expect them and must not fill them with placeholder data (Phase 1 law: no placeholder content).
- The tabletop mode is the only path to a block scene in Phase 1; it later becomes the Block Diorama without a type change.
- Any PR that requests location permission, reads GNSS, resolves `'street'` or writes ecology values is out of scope until this ADR is superseded.
- The safety rules in `docs/spatial/PHASE2-LEGENDS.md` §5 are binding on the future build. Their numeric thresholds are proposals and must be validated before they are trusted.

## Revisit when all of these hold

1. Mike has answered at least design-note questions 1, 3, 6, 7 and 9 (what a legend is, whose `originBlock`, starter ecology, what a meeting does, minors and street mode), and the answers are recorded in `docs/canon/DECISIONS.md`.
2. Counsel has completed a freedom-to-operate review of the actual Phase 2 design. This ADR is not legal advice and does not characterize any patent.
3. A positioning spike has measured fix accuracy against surveyed points in NYC street canyons, NYCHA campuses and park edges, and validated or replaced the §5 speed and crossing thresholds.
4. Polygon data terms (Department of Finance TAX_BLOCK_POLYGON, DCP 2020 NTAs, and any land-use source) have been reviewed for license and attribution.
5. `nitro-mapbox-ar` (or an alternative) has been built against this repo's Expo 58 / RN 0.88 lane if it is to be used for the diorama or map.
