# M11 Incubating: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/design/DECISIONS.md` (D3, D8, D11), `packages/theme/tokens.ts` (`motionTokens`, `hlynk.core`, `typeRamp`). Route `/(home)` with an unhatched egg. Shell: H-Lynk Core. States: counting / ready / overdue, and `resume`.

## Position

M10 (case closes) → M06 sheet (P2, first egg only) → **M11** → (leave the app) → M23 → M12. Return paths: M01 boot with `incubating` or `egg-ready` → M11; the Home key from any companion screen while the egg incubates.

## The one move

The H-Lynk breathes with the egg. The LED's 4 s breath (`motion-led-breath`), the glow of the case's biometric pad, and the "warm the case" haptic all run on one shared clock. When the Caller holds the trackpad, the pad on the case brightens on the LED's next inhale and the haptic pulses on the same beat, one soft pulse per breath. Nothing else on the screen moves. The egg is never shown: the case is closed, which is the point of the wait.

## Layout (inside the shell's 3:4 screen)

```
 ┌ scanner head ─────────────── (◉) ┐  LED: incubating breath / ready blink
 │┌────────────────────────────────┐│
 ││                                ││
 ││          ╭── handle ──╮        ││  CaptureCase (NEW, Skia vector), closed,
 ││     ┌────┴────────────┴────┐   ││  three-quarter front view, sitting on the
 ││     │                      │   ││  scene's ground line at 58% of screen height
 ││     │              ▢ pad   │   ││  rounded-square pad, front face, right of
 ││     │                      │   ││  centre; glows when warmed
 ││     └──────────────────────┘   ││
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
| counting | `now < egg.incubationEndsAt` and no `presenting`/`hatched` hatch | Closed case; ring fills; "12 min left"; clock time of readiness | `incubating` breath, label "Incubating, 12 minutes left" | label "Warm the case"; hold = warm (haptic + pad glow); tap = same, one breath |
| ready | turned ready while the Caller is on M11, or opened within 60 s of `incubationEndsAt` | Case lid edge lit `orange-500` along its seam (hatch accent, #7); ring full; "Ready to hatch" | `ready` blink | label "Open the case"; tap → M12 (starts the presentation immediately) |
| overdue | entered M11 60 s or more after `incubationEndsAt` | Same as ready; the line reads "Ready since 4:12 PM" (or "since yesterday") | `ready` blink | same as ready |
| resume | hatch state is `presenting` (process died mid-hatch) | Same as ready; the line reads "Your egg started hatching" | `ready` blink | same as ready → M12 resumes at the saved phase |

Ready and overdue look the same on purpose; only the line of text differs. No red, no count of hours, no badge.

Edge of ready in the foreground: the ring completes, the seam lights over `motion-enter` (300 ms), one `haptics.success`, one polite announcement. The scheduled OS notification is suppressed while M11 is foregrounded (see `08-handoff.md`).

## Scheme

The shell follows the clock (D8, `schemeForTime`). Daylit: case on a `concrete-100` floor plate. Night: `night` floor plate, case catches a sodium-orange rim from the time-of-day rig (§3.2). The hatch's forced night belongs to M12, not here.

## Type and colour

`type-body-strong` for "12 min left", `type-caption` for the egg name and ready time, both on the black plate. The egg name comes from content (`Metro Egg`, `Corner Egg`, `Prism Egg`; Decision #9). Orange appears only on the ready seam (Decision #7: orange is the hatch accent).

## Motion (full / reduced)

| Element | Full | Reduced |
|---|---|---|
| LED | `motion-led-breath` / `motion-led-blink-ready` | steady + progress ticks / filled dot (token siblings) |
| Ring | fills continuously on the UI thread, linear to `incubationEndsAt` | steps once a minute, no tween |
| Pad glow on warm | opacity 0.25 → 1 on the LED's inhale, back on exhale, 4000 ms period | pad lit steady at 1 while held, off on release (200 ms fade) |
| Ready seam | `motion-enter` 300 ms | instant |
| Case | still. No wobble, no idle bounce. An egg in a closed metal case does not move the case | still |

Creature-animation note: the case never wobbles. The temptation is the classic "egg rocks when it's close". Here the egg is inside a metal box; a rocking box reads as the Mon trying to get out, which is a distress beat the brief rules out. The life signal is the light, not the object.

## The no-list

- No seconds (except "Less than a minute"), no hh:mm:ss, no display-size timer.
- No "late", "hurry", "waiting for you", no red on overdue, no hours-past counter.
- No egg art visible through the case; the reveal is M12's.
- No speed-up, no pay-to-skip, no "warm count", no streak for warming.
- No rocking, shaking, or cracking on M11.
- No Santoro speech bubble on this screen.
- No "capture" in any string (Q4).
