# M11 Incubating: critique

Scored against §0C. Reviewer stance: creature animation, motion, spatial interaction, accessibility.

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | The shared breath clock (LED, pad, haptic on one beat) is a quiet, specific moment nobody else ships; holding the trackpad feels like a hand on the case | It is subtle by design. If the hallway test shows nobody finds the warm, the trackpad label "Warm the case" is the fix, not a louder effect |
| Visuals and Graphics | 6 | Closed square case under the black scanner head reads as H-Lynk kit, not pet-app cartoon | `CaptureCase` is a vector stand-in until a model exists; a weak drawing would sink the screen. Needs an art pass, not just code |
| Interaction | 8 | One action per state, on the trackpad, with a labelled equivalent; open lands under the thumb; no polling loop | Hold-with-duration is a new trackpad API; must not break the 600 ms commit semantics elsewhere |
| Inclusivity | 8 | Minutes not seconds; overdue without blame; warm has visual + spoken equivalents; LED meaning never colour-only | Quest 2D: no haptic at all, so the pad glow carries the warm alone |

## Heuristics pass (only those that bite)

- **H1 status:** time left and clock time both shown; ready state changes LED rhythm, seam light and text together. Pass.
- **H2 real world:** "case", "warm", "ready at 4:12 PM" are plain. Pass.
- **H5 error prevention:** the warm hint pre-empts the false belief that warming speeds hatching. Pass if the usability question 2 passes.
- **H8 minimalism:** the first-visit caption hides on later visits so returning Callers see only time and case. Pass.

## Blockers (must clear before 07)

1. `CaptureCase` art direction approved by Mike (Q4 still open: is the case the cradle?). Until then the screen may ship only behind the Phase-1 internal flag.
2. Trackpad `onHoldStart`/`onHoldEnd` and `haptics.warm` land in `packages/ui` with stories (R3).
3. `IncubationRing` built (Skia) with its reduced sibling.

Cleared in this pass: countdown pressure (minutes only), overdue guilt (fact, not count), Poké Ball read (square case rules in `04-components.md`).
