# M13 Home (Baby): research

Route `/(home)` with `stage: "Baby"` · Shell: H-Lynk · States: content / needs-you / asleep / background-resumed · Spec: `docs/phase-1-brief.md` §4.3 M13, §2.1, §2.4, §3.1–3.6; canon `V11 ¶51` (Energy, Fullness, one Social meter; Mons request food), `V11 ¶43` (Mons are people), Law 8; Decisions #8, #14, #16, #18; OPEN_QUESTIONS Q18–Q21, Q26, Q41–Q44.

## Who opens Home, and why

| Persona | Job | What they fear |
|---|---|---|
| Dani (teen Caller, daily) | When I open the H-Lynk, I want to see in two seconds whether my Mon is fine or asking for something, so I can answer it or just hang out | Being told off for leaving; a wall of meters |
| Jayden (under-13) | When my Mon looks at me, I want to know what it wants without reading much | Missing the ask and feeling it was my fault |
| Renée (parent) | When my kid plays, I want the app to let them put it down | Pressure loops, notifications at bedtime, "your pet is sad" |
| Sol (returning, lapsed 3 weeks) | When I come back, I want my Mon to still be mine and glad to see me | The game punishing the gap, or a "start over" egg |

## What the code says today (verified in the tree, 2026-10-08)

- Care lives in `@acme/core/sim` (`packages/core/sim/care.ts`): `advanceCare(state, now)`, `applyCareAction(state, action, at)`, `listUnmetNeeds(care)`; tuning in `sim/tuning.ts` `DEFAULT_CARE_TUNING`, every number marked `TODO(canon)`.
- `CareStateSchema` has no HP, sickness or death (Law 8). The worst neglect produces is empty meters.
- `useMonStore` (`packages/app/features/mon/mon.store.ts`) exposes `selectActiveCare`, documented as "as last persisted (not advanced to now)". No store selector advances care to the current time for display. Home needs one (see `04-components.md`, primitive P2).
- `MonSceneInput.mon.intent` is `idle | approach | eat | sleep | play | evolve` (`docs/spatial/CONTRACT.md`). The brief's "tap the Mon: `attention`" has no intent value; `attention` exists only as a clip name in §3.2.
- `HLynkShell` `status` has `off | boot | incubating | ready | needsYou`. A sleeping or content Mon has no LED state (see `03-direction.md`, LED rule).

## Systems finding: the default tuning makes "needs you" the normal state

From `DEFAULT_CARE_TUNING` and `HATCHLING_CARE` (`fullness 0.5`, awake decay `1/8` per hour):

| Meter | Starts | Crosses the food-request line (0.4) | Crosses needs-you (0.25) |
|---|---|---|---|
| Fullness | 0.5 at hatch | 0.8 h | 2.0 h |
| Energy | 1.0 | n/a | 9.0 h awake |
| Social | 0.6 | n/a | about 7.6 h (half-life 6 h) |

A Caller who opens the app morning and evening sees the needs-you LED on every open. That turns the status light into a guilt light, which the no-pressure stance (`apps/web/components/home/copy.ts` `care.closing`: "A low meter is a request. Nothing is lost while you are away.") cannot survive. Nothing is lost mechanically (Law 8), but a red blink every visit reads as loss. This is a tuning question for Q19–Q21, not a screen fix, and it is the first open question this lane returns.

## Risks

- **Guilt by design.** Needs-you on every return (above). Copy and LED must describe a request, never a failure.
- **Speech-bubble asks.** §2.1: a Baby's request is "a look, a sound, a reach", never "I'm hungry" text. The text equivalent lives in the status row in the UI voice.
- **Pronouns.** PS-005 / Q14: no pronoun for an individual Mon. Every string uses the Mon's name or "your Mon".
- **Two starters after a merge** (Decision #18). Home must ask which one is active; the store already has `setActiveMon`.
- **Thumb reach on SE.** The shell's 3:4 screen ends at y = 528 of 667; the care bar must sit inside the screen's bottom band, which is within the bottom 40% (y ≥ 400).
- **No model yet.** `MON_MODEL_SLOTS` are all null; the renderer draws its placeholder (`packages/assets/creatures` Baby art). Home must read right with a still picture.

## Usability questions (hallway test, 5 users)

1. Within three seconds of opening, can players say whether their Mon wants something, and what?
2. Do players find Feed, Rest and Play without being told, and do they understand that the trackpad tap does "the next thing your Mon wants"?
3. After a day away, do players describe the return as "my Mon missed me" or "I failed"? Any "failed" answer is a blocker.
