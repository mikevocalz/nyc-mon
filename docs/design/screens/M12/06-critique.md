# M12 Hatch: critique

Scored against §0C. §8 requires ≥ 8/10 on every row for M12, signed by `design-director` and `verifier`. This is the design-stage score; the signed score comes from the device build.

| §0C row | Score /10 | Evidence | Gap to 8 |
|---|---:|---|---|
| Delight and Fun | 8 | The LED's light passing into the egg is a story beat no reference has; the first look gives the Baby a will; the hesitate path asks the Caller for the same hold they learned on M11, so the wait pays off in the hatch | — on design. On build it depends on the clips: a 2D plate cannot lean in convincingly |
| Visuals and Graphics | 6 | Orange used once, as light from inside the egg; night scheme; no confetti or rays | 2D now is a cross-fade between paintings. Needs cut-out egg art and crack overlays (`04-components.md`) to reach 7, and the models plus the TypeGPU burst to reach 8 |
| Interaction | 8 | One choice in pre, one optional hold in hesitate, skip from 2 s, CTA under the thumb; no auto-advance; resume picks up at the saved phase | Continuity depends on M09 moving under `/(home)` |
| Inclusivity | 8 | Full authored reduced sequence; per-phase announcements; flash budget of one rise; hesitate has a no-hold action; nothing times out | Hallway test question 2 (hesitate read as rejection) is the real risk |

## Heuristics pass

- **H1 status:** each phase is visible and announced; skip appears once there is something to skip. Pass.
- **H3 control:** skip, back key (leaves to M11 with state intact; `presenting` resumes) and no forced wait. Pass.
- **H5 error prevention:** all state through `transitionHatch`; no screen-side mint. Pass.
- **H8 minimalism:** no text on screen during the show except the skip control. Pass.

## Blockers (must clear before 07 signs off)

1. Mike: first-look weights (proposal 2 lean-in : 1 hesitate) and whether a hesitate is allowed at all for under-13 Callers (the design allows it; it is shy, never refusal).
2. `sim-core`: `hatch`/`attention` intents and clip slots, and `deriveFirstLook(monInstanceId)` as a pure seeded function (`docs/spatial/CONTRACT.md` gap).
3. Art: cut-out egg skins per line (Q11 open) and three crack overlays; without them the 2D fallback is `hatch-night.webp` for every line.
4. M09 route under `/(home)` for continuity.
5. Hatch writer in the Mon store (`08-handoff.md` B1).

Cleared in this pass: confetti (none), rejection (hesitate rules), skip honesty (same end state, stated in copy), hard cut (shared creature layer), auto-play on cold start (pre state).
