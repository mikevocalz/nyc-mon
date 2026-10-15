# M17 Dex entry / Mon profile: critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 6 | The signage band ties the Dex to the H-Lynk; a transparent photo is a shareable object | Thin page until canon fills likes and culture |
| Visuals and Graphics | 7 | Species card vs individual sheet is a clear two-part hierarchy | Portrait is the placeholder webp until models |
| Interaction | 8 | One scroll, one optional mode | — |
| Inclusivity | 8 | Facts as text rows; lifecycle spoken once; no colour-only state | — |

## Product decisions

| # | Decision | Disposition | Reason |
|---|---|---|---|
| X-1 | Bond row not shown | DEFER (Q26) | A visible bond invents a stat's UI; a bar becomes a grind target |
| X-2 | Likes row not shown | DEFER (Q24; missing `content/food`) | No invented favourites |
| X-3 | Culture note row not shown | DEFER (Q12, Q13) | `cultureNote` is null for all three; culture belongs to the individual (`V11 ¶44`) |
| X-4 | Later lifecycle slots unnamed, no stage words | BUILD | No Small/Mid/Max names revealed (lead instruction, PS-029); Law 7 |
| X-5 | Photo mode deferred until the renderer can capture a transparent frame of a real model; the Photo button is not rendered until then | DEFER (needs native capability + models) | The placeholder webp art has a painted background, so "transparent PNG of the current pose" is not possible; a live button that cannot deliver is a dead button |
| X-6 | Export goes through the share sheet first, not a Photos write | BUILD (when X-5 clears) | No permission prompt; the OS sheet offers Save Image |
| X-7 | Exported PNG carries no text, date, name or metadata | BUILD | Under-13 privacy |

## Blockers

1. `LifecycleTrack` with stories (`Baby`, `LargeText`, `Night`).
2. `captureTransparentFrame` in `packages/render` (native capability check on `react-native-webgpu`).
3. `expo-sharing` (or `expo-media-library`) added to `apps/mobile` with its config-plugin entries; `expo prebuild --clean` afterwards.
