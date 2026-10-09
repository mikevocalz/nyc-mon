# M15 Rest: components

Shared primitives P1–P4: `../M13/04-components.md`.

| Element | Component | Notes |
|---|---|---|
| Frame | `HLynkShell scheme="night"` | the screen's scene goes night; body unchanged |
| Ring | `CareMeterRing need="energy"` (P1) | |
| Hold to wake | shell `trackpad` with `onCommit` + `commitLabel` (`TrackpadCommit`) | hold 600 ms is built into `Trackpad` |
| Wake button | `TrackpadActions` `onCommit` + `commitLabel` (one press, no hold) followed by the in-screen confirm row | the twin required by WCAG 2.5.1 / 2.2.1 |
| Confirm row | two `Button`s: `variant="outline"` "Wake {name}", `variant="ghost"` "Let {name} sleep" | shown only for the early-wake path from the button; the hold already is the commit |
| Status line | `Text type-body` in a polite live region | |

No new components. One renderer requirement: the time-of-day rig must accept a forced `night` key while asleep regardless of the clock (`packages/render`, §3.2). That is a render API item, not kit.

Token diffs: none.
