# M16 Social (play): critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | Peek is a game a toddler and a teen both get; the Mon breaking cover to be found is a personality beat | Per-bloodline flavour waits on Q44 and models; one shared hide clip would flatten three very different bodies |
| Visuals and Graphics | 6 | Uses the room's own set dressing as hiding spots | Room set dressing with three spots must exist in `packages/render` |
| Interaction | 9 | Reuses trackpad flick/tap exactly; no new gesture to learn | — |
| Inclusivity | 9 | No timer, no failure; every action has a labelled twin; VoiceOver is as fast as touch | — |

## Product decisions

| # | Decision | Disposition | Reason |
|---|---|---|---|
| S-1 | Phase-1 play is one shared mechanic (Peek); per-bloodline variation is performance only, `TODO(canon)` | BUILD (mechanic) / DEFER (flavour, Q44) | "Species-specific" has no canon source; the mechanic is game design, the behaviour is canon |
| S-2 | No score, timer or failure. A wrong peek still counts as found | BUILD | Calm UX for under-13s; WCAG 2.2.1; the meter is "Caller presence", so presence is what scores |
| S-3 | `quality` proposal: `0.6 + 0.4 × (firstTryFinds / rounds)`, clamped to [0.6, 1] | DEFER to lead + `sim-core` (tuning, not canon) | Any play is worth most of the gain; skill adds a little. Never shown |
| S-4 | Bond gain is applied by the sim and not shown | DEFER (Q26) | No UI for an undefined stat |
| S-5 | Quitting mid-game (Back / Done) still applies `play` with quality from the rounds played, if at least one round finished | BUILD | Leaving early is not a loss; zero rounds applies nothing |
| S-6 | Multiplayer seam: a `PlaySession` type with `participants: CallerId[]` (length 1 in Phase 1) in `@acme/core` schemas; no UI | DEFER (Phase 2) | The brief asks for a documented seam only |

## Blockers

1. Room set dressing with three hide spots (`render`).
2. `play` clip and hide/peek performances per bloodline (Mike's models).
3. Lead sign-off on S-1 and S-3: they are game-design proposals made by this lane.
