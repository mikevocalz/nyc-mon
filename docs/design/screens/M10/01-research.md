# M10 Incubation choice: research

Route `/(onboarding)/incubate` · Shell: H-Lynk Core · States: choose / confirmed · Spec: `docs/phase-1-brief.md` §4.2 M10, §2.1, §2.4, §3.4; `V11 ¶49`; canon Decisions #5, #8; design P2 (M06 sheet follows M10); open Q4 (capture case), Q11 (egg skins), Q27 (does length matter).

Position after Decision #5: M08 Meet → **M10** → M06 notification sheet (P2, only if undecided) → M11 Incubating. The Caller arrives with one chosen egg (route param `bloodline`), and leaves with an egg in the case and a timer running.

## Jobs to be done

- **Dani (teen Caller):** When I pick how long the egg incubates, I want to fit the hatch into my day (between classes, before bed), so I'm there when it hatches.
- **Jayden (under-13):** When I see three times, I want to know which one is "best", so I don't pick wrong. (The honest answer: none is better.)
- **Renée (parent):** When my child starts the timer, I want no purchase to speed it up and no nagging if they don't come back on time.
- **Marcus (lapsed):** When I pick 1 hour and come back the next day, I want the egg still there and still fine (v7: "No distress animation implies harm when the owner is away", `M7 L388`).

## Risks

- **"Longer must be better."** Games teach that a longer wait buys a better reward. Here it buys nothing: `mintMonInstance` in `packages/core/sim/hatch.ts` reads `incubationMinutes` only to set `incubationEndsAt` and `hatchedAt`. The brief asks for this to be said plainly. Canon has not ruled (Q27); the copy states what Phase 1 does and changes if Mike rules otherwise. `docs/design/research/JOURNEY.md` risk 6 names the drop-off: a Caller picks 60 thinking it's better, then quits.
- **A default steers.** A preselected 15 or 60 reads as the recommended answer. No default (same reasoning as D9, L1, M08 D13 proposed).
- **Permanence and double-commit.** Confirming writes the `EggRecord` and reserves the `monInstanceId` (`deriveMonInstanceId(eggId)`). A double tap or a back-and-forward must never create a second egg (Law 6 spirit: one individual per egg, one egg per Caller in Phase 1).
- **The case is canon-thin.** v11 describes the "single-egg capture/containment case" (`V11 ¶64`, `¶65`) but does not say the egg incubates inside it (Q4), and "capture" sits badly next to "Scanning is not recruitment" (`V11 ¶43`). The brief says "Case closes with the egg". UI copy says "case" and never "capture". No case art exists; `hatch-night.webp` shows an open metal case in a scene, not a usable asset.
- **The notification ask lands right after.** P2 moves M06 here. If M10 already feels like a form, a permission sheet on top makes two asks in a row. M10's confirm must feel finished (the case closes, the LED starts breathing) before the sheet rises.
- **Time-of-day words.** "Ready at 4:45 PM" is plain and useful; a live countdown on this screen invites watching. The countdown belongs to M11.
- **Under-13, consent pending.** The egg is created locally and its server write waits (ADR 0001 queue). Nothing on M10 changes, except the status row item.

## Usability questions

1. After reading the screen, can players say whether the 1-hour egg hatches a different or better Mon than the 15-minute one?
2. Do players pick a time that matches when they'll next open the app, and can they say when the egg will be ready?
3. Is it clear the egg went into the case and the timer started, before the notification sheet appears?
