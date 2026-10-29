# M32 Mon Space: direction

Inputs: `01-research.md`, `02-references.md`, canon Decisions #4, #7, #8, #12, #15, #23, #28, #32–#36, design D20. Route: native `/(home)/mon-space` for the active Mon (lane (c) owns the final file path; the web companion is `/mon-space`, Decision #23). Shell: **none**. No H-Lynk body, head, keys or trackpad (Decision #32). Scheme: day or night from the existing time-of-day rig (Decision #4).

## The one move

The screen is a Memory LCD and the Mon lives in it. When the Mon calls, a red lamp blinks at the top edge, a call glyph appears on the LCD and one line says what it wants. The Caller cycles to the matching icon and selects it. The Mon steps out of the LCD in full-colour 3D to eat, play or be cleaned up after, then steps back in.

## Layout (compact portrait)

```
 ┌──────────────────────────────┐ ← safe top inset
 │ ‹ Back            (●) lamp   │ Back (C) top-left; attention lamp in a black lens
 │┌────────────────────────────┐│
 ││ ░ LCD paper, dot grid ░░░░ ││
 ││ Fullness ♥♥♥♡              ││ 4-heart rows, one per canon meter
 ││ Energy   ♥♥♡♡              ││
 ││ Social   ♥♥♥♥              ││
 ││          ▄▀▀▄   ▪▪ piles   ││ Mon sprite in the LCD; poop piles bottom-right
 ││          ▀▄▄▀   ! call     ││ call glyph beside the Mon while a call is open
 ││ 〔 Asking for food 〕        ││ status line (one sentence, polite live region)
 ││ [M][S][P][L][C][+][B][i][‖]││ icon bar, 1-bit glyphs; focused icon is inverted
 ││ Share a meal               ││ caption: the focused icon's full label
 │└────────────────────────────┘│
 │   [ ◀ A ]  [ B select ]  [ C ✕ ] │ on-screen A/B/C keys, 56 pt, under the thumb
 └──────────────────────────────┘ ← home indicator kept clear
```

The letters in the sketch stand for the nine 1-bit LCD glyphs (meal, snack, play, lights, clean, medicine, boundary, status, pause), which lane (d) draws in `LcdLayerSpec`.

## Interaction model

| Classic | Touch | Hardware keyboard | Haptic | Sound (`playCareCue`) |
|---|---|---|---|---|
| A, cycle | Tap A, or swipe left/right on the LCD; tapping an icon focuses it | Left/Right arrows (Up/Down move between rows on the status page) | `selection` | `select` |
| B, select | Tap B, or tap the focused icon again | Return or Space | `tap`, then `success` when the care lands | `select`, then the action's cue (`flush`, `dose`) |
| C, cancel | Tap C, or the Back control | Escape | `tap` | `cancel` |

- C backs out one level: status page → icon bar → leave Mon Space. C on the icon bar with nothing open leaves the screen.
- Every icon is also a direct button for VoiceOver, Switch Control and pointer users, so nobody has to cycle.
- The focused icon persists while the screen is open; it starts on the icon that answers the open call, so one B press answers it.

## Icon menu

Order is fixed (H4: same place every visit).

| # | Icon | Action | Notes |
|---|---|---|---|
| 1 | Meal | `feed` (meal) | Answers hunger. Weight +1 |
| 2 | Snack | `feed` with the snack food | Weight +2; declined during a cold |
| 3 | Play | `play` (opens Peek) | Answers social; weight −1; declined during a cold |
| 4 | Lights | `lights` on/off; awake and lights off = `rest` | Answers bedtime and energy. Label flips "Lights off" / "Lights on" |
| 5 | Clean | `clean` | Flushes every pile. Greyed with its reason when there is nothing to clean |
| 6 | Medicine | `medicine` | One dose. Without a cold it explains instead of acting |
| 7 | Set a boundary | `discipline` | Answers a false call. Otherwise explains, no penalty |
| 8 | Status | opens the status page | Hearts, boundaries (4 segments), weight, age, stage |
| 9 | Pause | `pause` / `resume` | Confirms before pausing. While paused every other icon is disabled with the reason |

## Heart rows

Three rows, Fullness, Energy, Social, each 0–4 hearts from `heartsFor()` (D20a). A lit heart is a filled LCD glyph, an unlit heart an outline; both are visible so the count reads without colour. No numbers, no red. The status page repeats the rows and adds boundaries as four segments, "Weight {n}" in segment numerals, "Age {days}" and the stage word.

## Attention lamp

`MemoryLcdProps.led`: `off`, `call` or `false-call`, both lit states using `motion-led-blink-needs-you` (three 150 ms blinks every 10 s; `maxFlashesPerSecond` holds it at 3 or fewer in any second). The lamp is red (`led` token) in a black lens; at night it blooms. Reduced motion: steady, with the exclamation dot. The lamp never lights without the status line saying why. While paused the lamp is dark.

## Day and night

| | Day (daylit) | Night |
|---|---|---|
| LCD ground | Paper grey, reflective, no light of its own | Backlit; ink and ground invert to lit pixels on a dark ground |
| Pixels | Dark cells, visible matrix, slight ghosting | Lit cells with half-resolution bloom on lit pixels and the lamp only |
| Lights out (bedtime) | The LCD inverts and dims; the Mon sleeps | Same, with the backlight lowered |
| Glow | None | Lit pixels and the lamp. Never on text runs, never full-screen |

Bloom is off under Reduce Transparency and on the lowest graphics tier. Text runs bypass the bloom layer (`vpet-modern-design-directions.md` §3.4).

## Motion moments

| Moment | Full | Reduced (authored) |
|---|---|---|
| Idle | Seeded idle vignettes (`step()` via `stepMonCare`), sprite moves with light ghosting | One pose change per vignette slot, cross-fade, ghosting 0 |
| Step out / in | The 3D Mon steps forward out of the LCD plane, acts, steps back | Cross-fade between sprite and 3D pose; no tween |
| Call | Lamp blinks, call glyph appears, `attention` cue and haptic | Steady lamp with dot, glyph appears, no sound if sound is off |
| Flush | Piles slide off the LCD edge | Piles disappear |
| Evolve | LCD inverts for one beat, the 3D form swaps, the new form name prints | No invert; name fades in |
| Lights out | LCD inverts over 300 ms | Instant invert |

## No-list

- No death, no grave, no departure, no egg reset (Law 8, Decision #15). No word from the banned list: sick, dead, died, killed, neglected, punish.
- No care-mistake count, no "missed" history, no "while you were away" summary (D20e).
- No weight band words (D20f). No numbers on hearts. No danger red on any care state.
- No H-Lynk frame, keys or trackpad (Decision #32). No speech bubble, no pronoun for the Mon.
- No interactive care from the widget or a notification; both open Mon Space.
