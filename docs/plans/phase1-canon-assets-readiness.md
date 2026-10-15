# Phase 1 canon, creature assets and content readiness

Status: draft, requires creator decisions. Derived from `docs/canon/OPEN_QUESTIONS.md`, `docs/canon/DECISIONS.md`, `docs/phase-1-brief.md` and the 2026-10-08 handoff on `feat/alexa-plus` (merged as PR #12 on 2026-10-15). Re-verified against `main` at `311ab58` on 2026-10-15; every item below carries its evidence. Canon moved to v12 with PR #4 (Decisions #23 to #28, dated 2026-10-06): `docs/canon/GAMEPLAY_BIBLE_V12.md` covers navigation, lifecycle, combat, Battle Grounds, Stories and LiveOps, and settles none of the Phase 1 care, food, scale, egg-skin or culture questions listed here. This document overrides no canon and changes nothing in the Phase 1 loop PR #11 shipped.

Legend: open = still needs the ruling or the asset; done = ruled or shipped, with the reference; partly = some of it landed.

## Unresolved authoring inputs

- Capture case and egg skins. Open. Q4 (the case as incubator) and the egg-skin half of Q11 have no decision; the egg names are done (Decision #9: #001 Metro Egg, #008 Corner Egg, #061 Prism Egg) and the scanner LED is red (Decision #7). What ships today: generated concept art in `packages/assets/creatures/` (three Babies, three eggs, the hatch night; `index.ts` marks them stand-ins per PS-007 and PS-028, made with Figma `generate_image` on 2026-10-07), and Welcome panel 2 draws unmarked egg silhouettes because Q11's only approved look is "no colours or markings" (`packages/app/features/onboarding/boot.ts`). Still needed: final single-egg case proportions, hinge, folded handle, materials and three Bloodline-specific egg art assets. A placeholder is not approval of the final design.
- Naming and character identity. Open. The player's Hood Ratti is never named "Ratti" by default (Decision #1), but the reservation itself is unruled: `packages/core/sim/mon-name.ts` says "'Ratti' ruling and Q17 are open, and no name is reserved without a canon call". Q12 (culture notes), Q32 (Baby speech) and Q44 (per-Bloodline Peek behaviour, `TODO(canon)` in design D-15b) are open. Done: Decision #11 ("Bloodline" on every surface), Decision #13 ("Bodega Cee" stays the casual story name), no pronoun for a Mon in Phase 1 (PS-005). Never infer the Caller's identity from race, gender or locale. Preserve previously valid names when upgrading saves.
- Care mechanics. Open. Q18 to Q25 are unanswered. The numbers the app runs are the interim tuning in `packages/core/sim/tuning.ts` (design decision D-15d in `docs/design/DECISIONS.md`); every value there is marked `TODO(canon)` against Q19 to Q25 and must never be called canon. Needed from the creator: meter naming, decay and recovery, needs thresholds, absence rules, food classes and favorites, Baby portions, manual or scheduled rest.
- Scale and assets. Open. Q29 (Baby scale) is unanswered. `packages/content/mons/define.ts` leaves `scaleMeters`, `rigDefinitionId`, `foodClassIds`, `cultureNote`, `idleVignettes`, `affinityId` and `classId` null for every roster form; the typed slots exist in `packages/core/schemas/species.ts`. No `.glb` or `.gltf` is on `main`; PR #18 (Quest presence, draft) is blocked on the same models. Needed: approved GLB rig and clip inventories for the 3 starter Bloodlines × 5 stages, plus art for Meet, incubation, hatch, feed, sleep, Peek, Dex and care, each with license, creator, geometry budget and an accessibility alternative recorded.
- Production syncing. Partly. On `main`: `POST /v1/eggs/:id/hatch`, `GET /v1/me/eggs` and nickname carried on the egg and Mon writes (`packages/payload/src/admin/console/v1/game.ts`, with idempotency tests under `v1/__tests__/`). Not on `main`: journal sync (no journal code under `packages/payload/src`) and the client server-restore pass, which `boot.ts` still marks Phase 3 ("a session on a fresh install lands on sign-in until it exists"). Cross-device conflict-resolution tests for the Mon save do not exist.
- Voice. Open and out of scope here. Real enrollment, familiar-voice consent, biometric retention and minors wait on PR #16's proposed ADR 0019 (draft) and its privacy and legal review; ADR 0007 (no echo, mic presence) is the only voice decision on `main`. No real voiceprint is captured before that.

## Buildable follow-up slices (after decisions)

1. Authoritative asset inventory plus a validation script: every supported Bloodline and stage resolves to exactly the supplied model and animation clips, with explicit missing-asset handling and no silent fake geometry.
2. Data and content migration: Payload entries for creator-approved foods, preferences, voice pronunciations, cultural dialogue and rights provenance. `LanguageLexicon` (PR #5) is the only content collection on `main`; foods, preferences and provenance have no collection yet. Keep individual identity distinct from species defaults.
3. Renderer hook-up: the existing Viro scene contract and store (ADR 0010 to 0012) and per-platform rendering rules, Three.js with WebGPU and TypeGPU for world and effects (Decision #28), Kinetrell for motion. No competing state store.
4. Native and web verification: low memory, background and restore, iPhone and Android, reduced motion, VoiceOver and TalkBack, hatch push after a permission grant, offline queue and legacy-name migration.
5. Record each ruling in `docs/canon/DECISIONS.md`, close the matching open question, then promote only scoped implementation PRs. Unresolved questions stay `TODO(canon)`.

## Definition of done

- Zero unapproved canonical facts embedded as defaults.
- Assets reviewed on real devices against frame-time and memory budgets, with repeatable provenance and no missing clip references.
- One `MonInstance` across phone, web and XR, with deterministic save migration and server restore tests.
- `pnpm` locked install, typecheck, lint, core, app and UI tests, accessibility, and physical-device QA evidence.
- The PR description carries before and after captures where a claim is visual.

## Exclusions and dependencies

Do not duplicate PR #11 (Phase 1 screens, merged), #17 (kit accessibility issues, merged as `docs/plans/kit-issues.md`), #10 (Phase 2 location encounters parked, merged as ADR 0013), #16 (voice and transport ADRs, draft) or #18 (Quest native presence, draft). This document is a handoff for creator inputs and the implementation that depends on them; it claims no asset or backend has shipped beyond what the evidence above names.

## Verification 2026-10-15

| Item | State | Evidence |
| --- | --- | --- |
| Q4 case as incubator | open | `docs/canon/OPEN_QUESTIONS.md` §A, no "Answered" marker |
| Q11 egg names / egg skins | done / open | Decision #9; OPEN_QUESTIONS Q11 "the yes/no below is still open" |
| Scanner LED red | done | Decision #7 |
| "Ratti" reservation, Q17 | open | `packages/core/sim/mon-name.ts` |
| Q12, Q32, Q44 | open | OPEN_QUESTIONS §B, §D, §I; design D-15b |
| Q18 to Q25 care numbers | open | `packages/core/sim/tuning.ts` `TODO(canon)` block; design D-15d |
| Q29 Baby scale | open | `packages/content/mons/define.ts` `scaleMeters: null` |
| GLB rigs and clips | open | no `.glb`/`.gltf` on `main`; PR #18 blocked on models |
| Server hatch, egg list, nickname | done | `packages/payload/src/admin/console/v1/game.ts` |
| Journal sync, server restore on boot | open | no journal code in `packages/payload/src`; `boot.ts` "Phase 3" |
| Voice enrollment ADR | open | PR #16 draft (ADR 0019 proposed) |
| Canon version | v12 | PR #4, Decisions #23 to #28 |
| PR #11, #17, #10 | merged | gh PR list |
| PR #16, #18 | open drafts | gh PR list |
