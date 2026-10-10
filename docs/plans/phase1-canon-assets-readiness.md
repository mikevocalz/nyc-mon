# Phase 1 canon, creature assets and content readiness

Status: **Draft / requires creator decisions**. Derived from `docs/canon/OPEN_QUESTIONS.md`, `docs/canon/DECISIONS.md`, `docs/phase-1-brief.md` and the 2026-10-08 handoff on `feat/alexa-plus`. This does not override canon or change the working Phase 1 implementation in PR #11.

## Unresolved authoring inputs

- **Capture case / egg skins:** resolve Q4/Q11, and provide final single-egg case proportions, hinge, folded handle, materials and three line-specific egg art assets. Follow existing scanner-red decision. A placeholder is not approval of the final design.
- **Naming & character identity:** resolve reserved use of "Ratti", family-vs-individual culture notes (Q12), pronunciation, Baby speech (Q32) and per-Bloodline Peek behavior (Q44). Don't infer the Caller's identity from race, gender or locale. Preserve previously valid names when upgrading saves.
- **Care mechanics:** creator must ratify Q18–Q25 (meter naming, decay/recovery, needs thresholds, absence, food classes/favorites, Baby portions, manual/scheduled rest). Current D-15/D-16 numbers are explicitly interim; never silently call them canon.
- **Scale and assets:** resolve Q29 Baby scale. Supply and approve GLB rig/clip inventories for the 3 starter Bloodlines × 5 stages (typed empty slots already exist in PR #9); art for Meet, incubation, hatch, feed, sleep, Peek, Dex and care. Record licenses, creators, geometry budgets and accessibility alternatives.
- **Production syncing:** nickname endpoint, journal sync, server hatch-confirm and restore, and cross-device conflict-resolution tests are seams called out by PR #11, not finished backend features.
- **Voice:** real enrollment, familiar voice consent, biometric retention and minors are **not** part of this draft. PR #16's separate ADR and privacy/legal review must precede capturing any real voiceprints.

## Buildable follow-up slices (after decisions)

1. Authoritative asset inventory plus validation script: every supported Bloodline/stage resolves to exactly the supplied model/animation clips, with explicit missing-asset handling and no silent fake geometry.
2. Data/content migration: Payload entries for creator-approved foods, preferences, voice pronunciations, appropriate cultural dialogue and rights provenance. Keep individual identity distinct from species defaults.
3. Renderer hook-up: use existing Viro scene contract/store and per-platform rendering rules, with Three.js/WebGPU/TypeGPU for the specified world/effects and Kinetrell for motion. Do not create a competing state store.
4. Native and web verification: low-memory, background/restore, iPhone/Android, reduced motion, VoiceOver/TalkBack, hatch push after permission grant, offline queue and legacy-name migration.
5. Record each ruling in `docs/canon/DECISIONS.md`, close the corresponding open question, then promote only scoped implementation PRs. Leave unresolved questions as `TODO(canon)`.

## Definition of done

- Zero unapproved canonical facts embedded as defaults.
- Assets reviewed on real devices with frame-time/memory budgets, repeatable provenance and no missing clip references.
- One `MonInstance` across phone/web/XR, deterministic save migration and server restore tests.
- `pnpm` locked install, typecheck, lint, core/app/UI tests, accessibility, and physical-device QA evidence.
- PR description has before/after screenshots or captures where visual and explicit evidence for claims.

## Exclusions and dependencies

Do not duplicate PR #11 (Phase 1 screens), #18 (Quest native presence), #16 (voice and transport ADR), #17 (kit accessibility issues), or #10 (parked Phase 2 location encounters). This draft is a handoff for **creator inputs and dependent implementation**, not a claim that any assets or backends have shipped.
