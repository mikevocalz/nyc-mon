# 05 Critique: companion UI

Source: `origin/feat/nvidia-05-submission-package` at `6f59ab27`. Skills: `ux-heuristics-review` and `frontend-design` loaded. `design:design-critique` is installed but was not loaded; its hierarchy/consistency checklist was applied by hand (**manual pass**). Impeccable and Appllama are not installed; their quality-bar checks were not run.

Verdict: ⚠️ Several issues to address. The plumbing is honest (real OAuth, server-classified tool outcomes, revision-checked memory, no fallback model). The page hides that honesty behind raw text and missing feedback.

## Hierarchy

The page is one flat column of equal-weight items: title, a model sentence, a sign-in button, a text field, a send button, the log, a second title, a privacy paragraph, a load button, a field, a switch, three buttons, a revision line. Every paragraph is the same 14px black. Three orange solid buttons compete (Send, Save, plus Sign in when signed out).

What the eye should find first, in order: who I'm talking to and which model answers (header), the conversation (main area), then saved preferences (secondary). Today the log has no container, so replies have no more weight than the privacy paragraph under them.

## Consistency

- "Memory", "approved memory", "saved preferences" and "approved preferences" name one thing (`:125`, `:127`, `:128`, `:131`, `:132`, `:133`). Pick "preferences" for the data and use it on every control.
- Error copy is written in two registers: player-facing ("Sign in again to keep talking") and operator-facing ("check its nonsecret configuration", "simulator server"). The judge sees both.
- The main simulator spells "Callah" as "Caller" on screen via `captionText`; this page does not (03).
- Text fields use the night `well` look on a daylit page; the kit's own guidance is `daylit` for that case (`TextField.tsx:68`).

## Heuristics

**H1 Visibility of system status**
- No feedback after save, export, forget, sign-in or sign-out.
- During a turn the only signal is the button text "Working…". Nebius is buffered, so the wait can reach the 60 s timeout with nothing changing on screen.

**H2 Match with the real world**
- Tool ids (`feed_mon`) and outcome codes (`step-limit`) appear as text.

**H3 User control and freedom**
- Forget deletes with no confirm and no undo.
- No way to start a new conversation other than reloading, though the server tells users to "Start a new one" (`model.ts:362`).

**H5 Error prevention**
- Note field disabled until a separate Load click, with no explanation.
- Consent switch stays enabled when there is nothing loaded to consent to (`:129`).

**H6 Recognition over recall**
- The judge has to remember to press Load before editing.

**H8 Minimalism**
- 2,500 characters of JSON per tool call in the log.

**H9 Error recovery**
- All Nebius failures read the same generic line. The honest text already exists (`nebius.ts:40`) and is dropped by `describeModelError`.
- Mid-turn token expiry signs out with no message (by source; not verified).

## Ranked fixes (judge impact first)

| Rank | Fix | Heuristic | Patch in 06 |
|---|---|---|---|
| 1 | Show provider failures honestly: map `NebiusError` and `CompanionMemoryError` to specific copy | H9 | P1 |
| 2 | Render tool outcomes as plain sentences; JSON in a collapsed `Details` outside the live region | H2, H8 | P2 |
| 3 | Load saved preferences automatically on connect; drop the Load button | H5, H6 | P3 |
| 4 | Show the sign-in-expired message when a refresh is refused mid-turn; reset `busy` | H9 | P4 |
| 5 | One `role="status"` line for wait, save, export, forget, sign-in, sign-out | H1 | P5 |
| 6 | Confirm Forget in a `Dialog`, danger action | H3, H5 | P6 |
| 7 | Map empty replies by outcome; run Mon lines through `captionText` | H2 | P7 |
| 8 | Layout and type tokens: `Main`, `max-w-content-feed`, gutters, `type-station` / `type-title` / `type-body`, one `h1` | hierarchy | P8 |
| 9 | Error as `Banner tone="danger"`; boot failure inside the same frame | H9 | P9 |
| 10 | `surface="daylit"` on both fields; one `cta` (Send) | consistency | P10 |

Deferred, recorded here so it isn't lost:
- **A pre-action confirmation before care tools run.** The brief lists "care-action confirmation" as a screen. Today the model calls `feed_mon` and the page reports the server's result afterwards. Adding a confirm step changes the agent loop (`agentLoop.ts`), which belongs to the inference lane, not this one. DEFER: the after-the-fact outcome line (P2) is the honest minimum and ships inside this lane.
- **Enter to send.** Needs `onSubmitEditing` through `TextField`; check that the kit passes it through on web before wiring. Not verified.

## Fixes applied

None. This lane is read-only by instruction; all fixes are specified in `06-handoff.md` for the integrator.
