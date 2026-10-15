# M14 Feed: critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 8 | Head-tracking the lifted tile and a per-bloodline eat clip make feeding a moment between two characters | Depends entirely on clips that do not exist yet |
| Visuals and Graphics | 5 | Tray stays quiet so the Mon carries the scene | No food art exists; the tray cannot be judged until content lands |
| Interaction | 8 | Drag, tap, trackpad flick + tap, and Quest ray drag all reach the same action | Overfeed threshold behaves unpredictably (sim edge, `01-research.md`) |
| Inclusivity | 8 | Drag has a single-pointer alternative (2.5.7); states spoken | Food pictures need alt text from content |

## Product decisions

| # | Decision | Disposition | Reason |
|---|---|---|---|
| F-1 | M14 does not ship without `content/food`. Until it exists, Home's Feed button and the trackpad food route are disabled with a visible reason in the build (dev and internal only), and milestone 4 does not close | DEFER (blocker is canon: Q22, Q24; Q23 for portions) | No invented food (Law 1); an empty tray is a dead end; a Mon that asks for food the Caller cannot give is a broken loop |
| F-2 | "Full" is advice, not a lock: tiles stay live, the consequence is spelled out | BUILD | Respects the Caller's choice; the consequence is gentle (sluggish 45 min) and canon-safe |
| F-3 | Declined always offers the route that resolves it (asleep → Rest) or says when to retry in plain terms | BUILD | No dead ends |
| F-4 | Propose to `sim-core`: judge overfeed on the post-meal value | DEFER to sim-core | Consistency (H4); the current rule makes the same action produce different results at 0.85 and 0.9 |

## Blockers

1. `content/food` + `FoodDefSchema` (F-1).
2. Per-bloodline clips `eat_{food_class}`, `eat_react_good`, `eat_react_bad`, `refuse` (Mike's models; P3 for `refuse`).
3. `FoodTile` with stories (`Default`, `Focused`, `Dragging`, `Disabled`, `LargeText`, `ReducedMotion`).
