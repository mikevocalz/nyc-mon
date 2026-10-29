# M32 Mon Space: critique

Heuristic pass (ux-heuristics-review, design guidance mode) on `03-direction.md`, 2026-10-29. Reviewer: lane (a). The §6 rule wants a reviewer other than the author; the lead's review of this PR is that second pass.

Verdict: solid foundation, four things to hold the build to.

**H1 Visibility of system status**
- A call shows three ways at once: lamp, call glyph and the status line. Keep them in step; the lamp never lights without the line.
- Paused must be unmistakable: dark lamp, "Paused" line, every icon disabled with the reason.

**H3 User control and freedom**
- C always backs out one level; Escape does the same. Pause asks first; resume does not.

**H5 Error prevention**
- Declines explain before anything happens: snack or play during a cold, medicine with no cold, a boundary with no false call. None costs anything.

**H6 Recognition rather than recall**
- Nine glyphs are a lot to learn. The caption under the bar names the focused icon, and the bar starts on the icon that answers the open call.

**H7 Flexibility and efficiency**
- Direct tap on an icon for novices; A/B/C and arrows/Return/Escape for the classic rhythm and iPad keyboards.

**H8 Aesthetic and minimalist design**
- Three heart rows and one line on the main page. Weight, boundaries, age and stage live on the status page.

## Product decisions

| # | Call | Disposition | Why |
|---|---|---|---|
| S-1 | Care mistakes never shown on any screen | STRIKE | D20e; calm UX for a child audience |
| S-2 | Mon calls notify only after an explicit opt-in in Mon Space | BUILD | D20b; the egg-alert grant promised "Nothing else" |
| S-3 | Interactive widget care buttons | DEFER | Decision #36 approves a glance widget only; a care action from the Lock Screen skips the moment the app exists for |
| S-4 | Ring-dial input from the research | STRIKE here | No H-Lynk trackpad on this screen (Decision #32) |
| S-5 | Mistake totals in M18 Journal or M17 Dex | STRIKE | D20e; the contract's lifetime count stays data only |

## Priority actions

1. Measure night bloom on an A12X iPad before it ships on by default.
2. Test the full loop with VoiceOver and with a hardware keyboard on iPad.
3. Hallway-test "Set a boundary" with two child Callers: can they say what it does?
