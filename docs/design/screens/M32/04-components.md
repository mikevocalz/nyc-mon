# M32 Mon Space: components

Every visual pattern is a kit component with a story before the screen uses it (R3). New parts are marked new; their owner lane is in brackets.

| Part | Component | Status | Notes |
|---|---|---|---|
| The LCD | `MemoryLcd` (`MemoryLcdProps`, contract §5) | new [lane d] | TSL on the three WebGPU stack (Decision #28). Props: `scheme`, `inverted`, `reducedMotion`, `reduceTransparency`, `mon`, `layer`, `led`. Stories: Day, Night, LightsOut, ReducedMotion, ReduceTransparency, Call, FalseCall, Paused |
| LCD draw spec | `LcdLayerSpec` | new [lane d] | Icons, hearts, poop piles, call glyph, segment numerals, status text runs. Text runs never bloom and never ghost |
| Heart row | drawn in `LcdLayerSpec`; RN twin for VoiceOver | new [lane d / c] | 0–4 from `heartsFor()`; lit = filled glyph, unlit = outline |
| Attention lamp | `MemoryLcd` `led` prop over `resolveLedRhythm` | reuse rhythm, new placement [lane d] | `led-rhythm.ts` tokens only; red `led` token in a black lens |
| A/B/C keys | `Button` kit variant for the three keys | new variant [lane c] | 56 pt targets, labelled "Next", "Select", "Back"; hardware keys mapped in the screen |
| Icon bar | drawn in the LCD; each icon also a hidden-visual accessible button | new [lane c] | Order fixed (see `03-direction.md`) |
| Status page | LCD page + `KeyValueList` for VoiceOver | reuse + new LCD page [lane c] | Hearts, boundaries, weight, age, stage |
| Pause confirm | `SheetSurface` + `Button` | reuse | Cancel first, primary "Pause" |
| Notify ask sheet | `SheetSurface` + `Button` | reuse | One-time opt-in (D20b) |
| Announcements | `Announcer` | reuse | Polite, on change only |
| Haptics | `haptics` vocabulary | reuse; add `attention` mapped to an existing preset [lane c] | Never raw calls |
| Sound | `playCareCue` | new [lane f] | No-op when sound is off or the silent switch is on |
| Peek | M16 game | reuse | Opened by Play |
| Widget | WidgetKit target reading `KeychainSnapshot` | new [lane e] | Accessory circular, rectangular, small |

No new colour ships without a `contrast.ts` row (Law 10): LCD paper, ink, lit-ink and backlight tokens land with lane (d).
