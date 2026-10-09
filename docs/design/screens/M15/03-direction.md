# M15 Rest: direction

Route `/(home)/rest`. The H-Lynk shell stays; the screen inside it goes to the night scheme (the shell body stays red: "plastic is plastic", `DIRECTION.md`).

## The one move

Lights out is a real lighting change. On Rest the time-of-day rig cross-fades the room to its night key (sodium street light through a window, §3.2), the Mon plays `sleep_in` and curls up, and the Energy ring becomes the only HUD element, filling slowly. Then the Caller can leave. Waking is a deliberate hold on the trackpad, with the cost written above it.

## Layout (compact)

```
 │┌────────────────────────────┐│
 ││ Squeaklet        ◔ Energy  ││ Energy ring only
 ││                            ││
 ││      [ Mon asleep ]        ││ night room, rig at night key
 ││                            ││
 ││ Asleep. Energy is coming   ││ status line, type-body
 ││ back. You can close the    ││
 ││ H-Lynk.                    ││
 ││ [ Wake Squeaklet ]         ││ labelled twin of the trackpad hold
 │└────────────────────────────┘│
 │ [⌂] [≡]  ┏━hold to wake━┓ [‹] [›] │
```

| Breakpoint | Change |
|---|---|
| Compact short | status line moves to the bar's leading edge; wake button stays in the screen |
| Medium / expanded / Quest 1280×800 | trailing pane shows the status line and wake button at `content-form` width; the shell screen keeps only the Mon and the ring |

## States

| State | Trigger | Scene | UI |
|---|---|---|---|
| awake→sleep | Rest pressed on M13 or trackpad tap when Energy is the ask | rig cross-fades to night (`motion-scheme` 500 ms), `sleep_in` clip | Energy ring, line "Settling in" |
| sleeping | `activity.kind === 'asleep'` | `sleep_loop`, slow breathing; motes dim (§3.3 Energy-driven motes) | `m15.sleeping.*` line; wake button; trackpad hold to wake |
| wake (early) | Energy < 0.6 | Mon stirs on first touch of the trackpad (`attention`, sleepy variant) | cost line visible before the hold starts; hold 600 ms or tap the button then confirm |
| wake (rested) | Energy ≥ 0.6, or sim `woke: rested` | `wake` clip, stretch | no cost line; same controls |

When the sim wakes the Mon on its own (`woke`, `rested`) while the screen is open, the scene plays `wake` and the route returns to M13 after the clip. If the app was closed, M13 simply shows an awake Mon.

## Type and colour

Night scheme throughout the screen: text `#F8F8F8` on `#0A1230` scrim; ring fill carolina. The cost line is `type-body`, `text` colour, not danger: it is information, not a warning. Wake button `Button variant="outline"` (night), never orange.

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Lights out | rig cross-fade 500 ms, `sleep_in` | `instant` scheme change, static sleeping pose |
| Sleeping | `sleep_loop` breathing, dim motes | static pose, no motes |
| Hold to wake | trackpad ring fills over 600 ms | button press then a confirm step, no hold |
| Wake | `wake` clip, rig cross-fade back | instant scheme, static awake pose |

## No-list

- No visible countdown or clock ("2 h 14 min until rested"). The ring shows recovery.
- No "Are you sure?" guilt modal. The cost is one plain line, shown up front.
- No sleep audio that plays when the app is backgrounded.
- No snoring "Zzz" speech glyph over the Mon; sleep is body language.
