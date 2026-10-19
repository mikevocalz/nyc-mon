# G02 Game lobby: critique

Scored against `docs/phase-1-brief.md` §0C. Stage: direction (no build yet). Reviewer: `design-director`; `verifier` co-signs at implementation. Standards the review is measured against (standards, not contributors): Dieter Rams and Teenage Engineering for restraint; Pentagram (Bierut, Scher) and Vignelli's NYCTA manual for the signage typography; Sega, Capcom and Bandai Namco cabinet UX for the attract-to-start rhythm; Persona 5 and Nier: Automata UI for typographic contrast on a dark panel; the WCAG 2.2 authors; Studio Dumbar for motion discipline; Mobbin for the screen references in `02-references.md`.

Heuristic verdict: ⚠️ Several issues to address (all at the data boundary, none in the hierarchy).

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | One angled orange START on a signage board; the energy trace runs once and rests | Delight depends on resume being instant and exact; a visible teleport kills it |
| Visuals and Graphics | 8 | Night-faced panel in both schemes, corner cuts, one orange, no gradient | Rive artboards not drawn; the district keyline on the header is unproven at 2 dp |
| Interaction | 8 | START is the only decision; the leaderboard never blocks it (§14 fixture 11) | Recovery dialog adds a step on failure; acceptable, must be rare |
| Inclusivity | 7 | Rows carry name and rank only; status by text, never colour alone; reduced-motion siblings authored | Uppercase legend is a readability risk at XXL Dynamic Type; see `07-a11y.md` |

## Design critique

**Overall impression.** The screen reads as one board and one button. The biggest opportunity is making the `unavailable` leaderboard look designed rather than missing.

| Finding | Severity | Recommendation |
|---|---|---|
| The `unavailable` state is the default for months; an empty panel at the top of the hierarchy reads as broken | 🟡 Moderate | Keep the header and the three-row height; set the one sentence in `type-body` on `ink-50`, not `text-muted`, so it reads as a statement |
| "Continue your game" and the pill's "Resume" could be read as the same action by a tester who sees both in one session | 🟡 Moderate | Keep the lobby phrase; the hallway test in `01-research.md` Q1 checks it |
| The recovery dialog's secondary "Start a new game" can delete a save if confirmed carelessly | 🔴 Critical | The new-game path from a failed resume keeps the old save until the server confirms the new one; the dialog says "Your current save stays until the new game is saved" |
| Web lobby has no gameplay to lead into | 🟡 Moderate | Open decision for the lead (`08-handoff.md`); until ruled, web START routes to `/mon-space` |

**Visual hierarchy.** First read: START (orange, bottom band). Second: the night panel. Third: the wordmark. That is the inverse of §3's top-to-bottom order but the correct action order; the eye lands on the action, then reads up. Keep it.

**Consistency.** Corner cuts on the panel and START, square everywhere else, one orange, scheme-following page: all per `docs/DESIGN_SYSTEM.md`. The uppercase legend is the one deliberate exception (Decision in `03-direction.md`).

**What works.** The honest empty and unavailable states; the one-sentence resume line; no second CTA.

## Dieter Rams review

```
DIETER RAMS REVIEW — G02 Game lobby
Core job: put the Caller back into the city exactly where they were, with one press

SCORECARD
 1. Innovative          Adequate — exact resume is the novelty; the lobby itself is deliberately ordinary
 2. Useful              Strong — one action, nothing in its way
 3. Aesthetic           Strong — signage board, one orange, corner cuts
 4. Understandable      Strong — "Continue your game · Last seen in Harlem" says what START does
 5. Unobtrusive         Strong — no promos, no streaks, no chests
 6. Honest              Strong — rankings say "aren't live yet"; no ghost rows, no blur-tease
 7. Long-lasting        Adequate — depends on the leaderboard not growing chrome when real data lands
 8. Thorough            Adequate — every failure has copy; Rive semantics unproven until the artboards exist
 9. Efficient/clean     Strong — one Rive trace per open, no loop after START
10. As little as possible Strong — four elements

⚠ TOP VIOLATIONS
1. Thorough — recovery paths are copy-only until WorldResumeService exists → lane E ships ResumeOutcome before the lobby ships
2. Long-lasting — a future "ready" leaderboard will tempt arrows and tiers → the data contract in 08-handoff carries rank, name, score, isSelf and nothing else

✓ KEEP
• Honest unavailable state
• One orange, one decision
• No "Resume" on the lobby

▶ THE ONE EDIT
Delete the district keyline on the panel header. It is the only decoration whose job a tester could not name.
```

Applied: the district keyline stays as an option behind `district` on `LeaderboardPanel` (`04-components.md`) and ships off by default. **Decision: DEFER** until the hallway test shows players connect it to "Last seen in {district}".

## Blockers (must clear before 07-a11y / 08-handoff)

1. `GameLobby`, `LeaderboardPanel`, `AngledStartButton` do not exist; each needs a Rive source project (§8) and a story (R3).
2. `WorldResumeService` and the `ResumeOutcome` union (lane E) must exist before START can promise exact resume.
3. The web behaviour of START (lead decision).

## Non-blocking

- Hallway test Q1 to Q5 in `01-research.md`.
- Measure lobby-to-first-frame on iPhone SE 3 once the transition exists (§14 performance).
