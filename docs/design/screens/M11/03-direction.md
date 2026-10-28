# M11 Incubating: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/design/DECISIONS.md` (D3, D8, D11), `packages/theme/tokens.ts` (`motionTokens`, `hlynk.core`, `typeRamp`). Route `/(home)` with an unhatched egg. Shell: H-Lynk Core. States: counting / ready / overdue, and `resume`.

## Position

M10 (incubation starts) → M06 sheet (P2, first egg only) → **M11** → (leave the app) → M23 → M12. Return paths: M01 boot with `incubating` or `egg-ready` → M11; the Home key from any companion screen while the egg incubates.

## The one move

The H-Lynk breathes with the egg. The LED's 4 s breath (`motion-led-breath`) and the "Keep it warm" haptic run on one shared clock. When the Caller holds the trackpad, the haptic pulses on the LED's inhale, one soft pulse per breath. The egg sits still in its scene; nothing else on the screen moves.

> Superseded by Decision 29 (2026-10-21): the egg used to wait unseen inside a closed capture case whose biometric pad glowed with the warm. Eggs never use the case; the egg itself is shown.

## Layout (inside the shell's 3:4 screen)

```
 ┌ scanner head ─────────────── (◉) ┐  LED: incubating breath / ready blink
 │┌────────────────────────────────┐│
 ││                                ││
 ││              ╭────╮            ││  the egg still (`EggStill`), 120 pt, the
 ││             │      │           ││  same size as M12's `HatchEgg`, sitting
 ││             │      │           ││  on the scene's ground line at 58% of
 ││              ╰────╯            ││  screen height; it does not move
 ││   ─────── ground line ───────  ││
 ││  ◯ IncubationRing   12 min left││  ring 64 pt, left; time as minutes
 ││     Metro Egg · ready at 4:12  ││  (see copy for exact strings)
 │└────────────────────────────────┘│
 │ status row: [● Incubating] [notifications off · Turn on]│
 │ [⌂] [≡]   ┏ trackpad ┓   [‹] [›] │  trackpad: hold = warm; ready: tap = open
 └──────────────────────────────────┘
```

The ring and time sit in a bottom band of the screen on a solid `signage-black` plate at 88% opacity, so the text never sits on a picture. Left-aligned, single column.

## States

| State | When | Screen | LED | Trackpad |
|---|---|---|---|---|
| counting | `now < egg.incubationEndsAt` and no `presenting`/`hatched` hatch | The egg, still; ring fills; "12 min left"; clock time of readiness | `incubating` breath, label "Incubating, 12 minutes left" | label "Keep it warm"; hold = warm (haptic + announcement); tap = same, one breath |
| ready | turned ready while the Caller is on M11, or opened within 60 s of `incubationEndsAt` | The egg, still; ring full; "Ready to hatch"; trackpad rim turns `orange-500` (hatch accent, #7) | `ready` blink | label "Hatch your egg"; tap → M12 (starts the presentation immediately) |
| overdue | entered M11 60 s or more after `incubationEndsAt` | Same as ready; the line reads "Ready since 4:12 PM" (or "since yesterday") | `ready` blink | same as ready |
| resume | hatch state is `presenting` (process died mid-hatch) | Same as ready; the line reads "Your egg started hatching" | `ready` blink | same as ready → M12 resumes at the saved phase |

Ready and overdue look the same on purpose; only the line of text differs. No red, no count of hours, no badge.

Edge of ready in the foreground: the ring completes, one `haptics.success`, one polite announcement. The scheduled OS notification is suppressed while M11 is foregrounded (see `08-handoff.md`).

## Scheme

The shell follows the clock (D8, `schemeForTime`). Daylit: egg on a `concrete-100` floor plate. Night: `night` floor plate, the egg catches a sodium-orange rim from the time-of-day rig (§3.2). The hatch's forced night belongs to M12, not here.

## Type and colour

`type-body-strong` for "12 min left", `type-caption` for the egg name and ready time, both on the black plate. The egg name comes from content (`Metro Egg`, `Corner Egg`, `Prism Egg`; Decision #9). Orange appears only on the ready trackpad rim (Decision #7: orange is the hatch accent).

## Motion (full / reduced)

| Element | Full | Reduced |
|---|---|---|
| LED | `motion-led-breath` / `motion-led-blink-ready` | steady + progress ticks / filled dot (token siblings) |
| Ring | fills continuously on the UI thread, linear to `incubationEndsAt` | steps once a minute, no tween |
| Egg | still. No wobble, no idle bounce | still |

Creature-animation note: the egg does not move on M11. Its first movement is M12's `stir`, so the hatch owns the moment the egg comes alive. The life signal during the wait is the LED breath.

> Superseded by Decision 29 (2026-10-21): the pad-glow and ready-seam rows belonged to the capture case and are removed.

## The no-list

- No seconds (except "Less than a minute"), no hh:mm:ss, no display-size timer.
- No "late", "hurry", "waiting for you", no red on overdue, no hours-past counter.
- No speed-up, no pay-to-skip, no "warm count", no streak for warming.
- No rocking, shaking, or cracking on M11.
- No Santoro speech bubble on this screen.
- No "capture" or "case" in any string (Decision 29).
