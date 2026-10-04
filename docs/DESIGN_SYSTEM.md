# NYC-MON design system: daylit proposal

Owner: `design-director`. Written 2026-10-04. Status: **proposal**. No token in `packages/theme/tokens.ts` has changed. The diffs below are for whoever owns `@acme/theme` to land as a PR, with `packages/theme/contrast.ts` rows added in the same PR (Law 10: a token without a measurement does not exist).

Inputs: `docs/canon/DECISIONS.md` #4 (daylit default; dark for night and the hatch), #7 (red LED; orange for CTA and hatch), #8 (H-Lynk Entry chrome); `prompts/BUILD_PROMPT_v3.md` §1.1, §1.3; `docs/REPO_MAP.md` §6; `docs/design/CONTRAST.md`; `docs/design/hlynk/DIRECTION.md`.

## What changes and what stays

- **Stays:** the logo-sampled scales (`orange`, `royal`, `carolina`, `leaf`, `apple`, `silver`, `ink`), the night facades, Archivo Black + Space Grotesk, square corners, every measured row in `CONTRAST.md`.
- **Changes:** the light theme stops being "the dark theme with deeper tones" and becomes the default. Its neutrals come from the city (concrete), its type ink from MTA signage (black), and orange leaves body text and links: it is the primary CTA face and the hatch, nothing else.
- **Night** keeps today's dark semantic set unchanged. It applies when the device clock says night (§3.2 time-of-day rig) and during the hatch (#4). Auth, onboarding and settings follow the OS appearance; the companion shell follows the clock.

NeonBlade (https://neonbladeui.neuronrush.com/ · https://github.com/vprix21/neonblade-ui) stays the vocabulary: corner cuts, notch frames, segmented progress, glyph backgrounds. On daylit pages the vocabulary is drawn as hard keylines and solid faces, without the glow. Glow belongs to night.

## Colour

### New primitive: `concrete`

A cool, slightly blue-grey scale sampled by eye from NYC sidewalk slab and curb, not from a warm cream. Ten steps; 50 is the daylit page.

| Token | Hex | Role |
|---|---|---|
| `concrete-50` | #F3F4F4 | daylit page (`bg`, `surface`) |
| `concrete-100` | #EBECED | sunken wells, trackpad face (daylit) |
| `concrete-200` | #D2D4D6 | H-Lynk Entry body (daylit), dividers |
| `concrete-300` | #B8BBBE | key faces (daylit) |
| `concrete-400` | #9A9EA2 | body keyline (decorative) |
| `concrete-500` | #7C8085 | large text / ui only on `concrete-50` |
| `concrete-600` | #61656A | muted text (`text-muted` on raised and page) |
| `concrete-700` | #484C51 | secondary text, night key face |
| `concrete-800` | #303337 | H-Lynk Entry body (night) |
| `concrete-900` | #1C1E21 | LED well, bezel lip, night trackpad face |

### New primitive: `signage`

| Token | Hex | Role |
|---|---|---|
| `signage-black` | #000000 | type on daylit neutrals. The MTA sign system sets white Helvetica on a black band (1970 Graphics Standards Manual, https://standardsmanual.com/products/nyctamanual); this is that black, pure, not a tinted near-black. |
| `signage-white` | #FFFFFF | type on `concrete-800/900` and on night |

### New semantic: `led`

| Token | Daylit | Night | Note |
|---|---|---|---|
| `led-on` | `apple-500` #F80000 | `apple-500` #F80000 | #7. Always drawn inside `led-well`. |
| `led-well` | `concrete-900` #1C1E21 | `night` #00041C | guarantees 3:1 whatever the body colour |
| `led-off` | `apple-900` #5E0000 | `apple-900` #5E0000 | decorative: the unlit lens |

### Semantic diff (light column only; dark is unchanged)

| Token | Today (light) | Proposed (daylit) | Why |
|---|---|---|---|
| `bg` | `ink-50` #F8F8F8 | `concrete-50` #F3F4F4 | city neutral, not banner white |
| `surface` | `ink-50` #F8F8F8 | `concrete-50` #F3F4F4 | same |
| `surface-raised` | `white` #FFFFFF | `white` #FFFFFF | unchanged |
| `surface-sunken` | `ink-100` #ECECED | `concrete-100` #EBECED | near-identical, now on the concrete scale |
| `text` | `night` #00041C | `signage-black` #000000 | §1.3 "MTA-signage black for type on neutrals" |
| `text-muted` | `ink-600` #545767 | `concrete-600` #61656A | stays neutral; the ink scale leans blue |
| `primary` | `orange-700` #A35100 | `orange-700` #A35100 | unchanged; existing screens use it as text. New screens use `cta` for the action and `accent` for links |
| `cta` (new) | — | face `orange-500` #FC7C00, label `signage-black` | #7: orange is the CTA face |
| `on-cta` (new) | — | `signage-black` #000000 | never white (white on orange fails) |
| `accent` | `royal-500` #0058F8 | `royal-500` #0058F8 | links, selection, focus |
| `border` | `ink-200` #D8D8DB | `concrete-200` #D2D4D6 | decorative |
| `glow`, `glow-hot` | alpha royal/orange | `transparent` | no glow in daylight |

Orange rule on daylit: `orange-500` is a **face** (button, hatch band) carrying black text. It is never text, icon or line on a light surface (2.38:1 on `concrete-50`, forbidden row already in `CONTRAST.md`). Existing light-mode `primary` text (`orange-700`) stays legal (5.10:1) but new screens use `accent` for links and `text` for emphasis.

### Measured pairs (new tokens)

Method: WCAG 2.2 relative luminance, sRGB linearisation threshold 0.04045, as in `docs/design/CONTRAST.md` and `packages/theme/contrast.ts`. Ratios computed 2026-10-04 with that formula; they go into `contrast.ts` with the token PR.

| Pair | Foreground | Background | Ratio | Role (min) | Result |
|---|---|---|---:|---|---|
| text on page | `signage-black` #000000 | `concrete-50` #F3F4F4 | 19.06 | text 4.5 | pass |
| text on sunken | `signage-black` | `concrete-100` #EBECED | 17.75 | text 4.5 | pass |
| text on raised | `signage-black` | `white` | 21.00 | text 4.5 | pass |
| text on Entry body | `signage-black` | `concrete-200` #D2D4D6 | 14.13 | text 4.5 | pass |
| key glyph (daylit) | `signage-black` | `concrete-300` #B8BBBE | 10.89 | ui 3 | pass |
| muted on page | `concrete-600` #61656A | `concrete-50` | 5.33 | text 4.5 | pass |
| muted on sunken | `concrete-600` | `concrete-100` | 4.96 | text 4.5 | pass |
| muted on raised | `concrete-600` | `white` | 5.87 | text 4.5 | pass |
| secondary on page | `concrete-700` #484C51 | `concrete-50` | 7.85 | text 4.5 | pass |
| secondary on sunken | `concrete-700` | `concrete-100` | 7.31 | text 4.5 | pass |
| large/ui grey on page | `concrete-500` #7C8085 | `concrete-50` | 3.61 | large-text / ui 3 | pass (not body text) |
| CTA label | `signage-black` | `orange-500` #FC7C00 | 8.02 | text 4.5 | pass |
| CTA pressed label | `signage-black` | `orange-400` #FD9D40 | 10.07 | text 4.5 | pass |
| link / focus on page | `royal-500` #0058F8 | `concrete-50` | 5.08 | text 4.5 | pass |
| link / focus on sunken | `royal-500` | `concrete-100` | 4.73 | text 4.5 | pass |
| danger on page | `apple-600` #D50000 | `concrete-50` | 4.98 | text 4.5 | pass |
| danger on sunken | `apple-600` | `concrete-100` | 4.64 | text 4.5 | pass |
| success on page | `leaf-700` #2C7A29 | `concrete-50` | 4.86 | text 4.5 | pass |
| success on sunken | `leaf-700` | `concrete-100` | 4.53 | text 4.5 | pass (thin margin) |
| info on page | `carolina-800` #295D8E | `concrete-50` | 6.25 | text 4.5 | pass |
| LED in daylit well | `apple-500` #F80000 | `concrete-900` #1C1E21 | 3.97 | ui 3 | pass |
| LED in night well | `apple-500` | `night` #00041C | 4.83 | ui 3 | pass |
| trackpad edge (daylit) | `concrete-600` | `concrete-200` | 3.95 | ui 3 | pass |
| trackpad edge (night) | `concrete-400` #9A9EA2 | `concrete-800` #303337 | 4.71 | ui 3 | pass |
| key glyph (night) | `concrete-300` | `concrete-800` | 6.58 | ui 3 | pass |
| night text on Entry body | `signage-white` | `concrete-800` | 12.69 | text 4.5 | pass |
| hatch orange on night | `orange-500` | `night` | 7.76 | text 4.5 | pass (already in `CONTRAST.md`) |
| Entry body on page | `concrete-200` | `concrete-50` | 1.35 | decorative | exempt: the body's edge is drawn by the keyline and the screen lip |
| body keyline | `concrete-400` | `concrete-50` | 2.45 | decorative | exempt: the shell is not a control |

### Forbidden pairs (add to `FORBIDDEN`)

| Pair | Ratio | Needs | Rule |
|---|---:|---|---|
| `apple-500` on `concrete-200` | 2.83 | 3 | The LED never sits on bare body plastic; always in `led-well`. |
| `apple-500` on `royal-500` | 1.33 | 3 | Same, if Q5 makes the body royal. |
| `orange-500` on `concrete-50` | 2.38 | 3 | Orange is a face on daylit, never ink. |
| `concrete-500` on `concrete-200` | 2.67 | 3 | Mid grey is not an edge on the Entry body; use `concrete-600`. |
| `white` on `apple-500` | 4.21 | 4.5 | already forbidden; restated because the LED chip is tempting |

## Type

Families stay: Archivo Black (`display`) for the few words that should feel like a jersey or a station name; Space Grotesk (`sans`) for everything else. Both files are already in `packages/assets/fonts/`. No third family.

Mobile scale (pt; Dynamic Type scales from these defaults, up to XXL per §0C):

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `type-station` | 34 / 38 | Archivo Black | one line per screen at most: the screen's name, a Mon's name at the hatch |
| `type-title` | 24 / 30 | Space Grotesk 700 | screen question ("What year were you born?") |
| `type-body` | 17 / 24 | Space Grotesk 400 | default |
| `type-body-strong` | 17 / 24 | Space Grotesk 600 | inline emphasis, values |
| `type-label` | 15 / 20 | Space Grotesk 500 | buttons, field labels, keys |
| `type-caption` | 13 / 18 | Space Grotesk 400 | legal links, hints; never below 13 |

Rules: sentence case everywhere, including buttons. No all-caps eyebrows. `type-station` is the only display use on mobile; the existing `display-*` web scale in `tokens.ts` stays for the site. Numbers in timers use tabular figures (`fontVariant: ['tabular-nums']`).

## Space and layout

4 pt base. Steps: 4, 8, 12, 16, 24, 32, 48. Screen gutter 16 pt (24 pt from `md`). Primary action sits in the bottom 40% (§4), 16 pt above the safe bottom inset. Minimum target 44 × 44 pt (Apple HIG) and 48 × 48 dp on Android.

## Motion

Every token has an authored reduced-motion sibling (§0A.2). The reduced value is a design, not "duration 0" by default.

| Token | Full | Reduced | Use |
|---|---|---|---|
| `motion-tap` | 120 ms, `standard` easing, scale 0.97 | colour change only, 120 ms | press feedback |
| `motion-step` | 200 ms, `standard`, 24 pt slide | 120 ms cross-fade, no slide | carousel and focus steps |
| `motion-enter` | 300 ms, `emphasized`, fade + 8 pt rise | 200 ms fade, no rise | content entering |
| `motion-scheme` | 500 ms token cross-fade | instant | daylit ↔ night |
| `motion-power-on` | 240 ms LED ramp + screen fade | LED steps to on, screen cuts on | M01 |
| `motion-led-breath` | 4 s period, 35 → 100% | steady + progress ring | `incubating` |
| `motion-led-blink` | 2 blinks (ready) / 3 blinks (needs you), each 150 ms on/150 ms off | steady + shape cue | LED states |

Durations reuse the existing `motion.duration` values (120 / 200 / 300 / 500 ms) and easings in `tokens.ts`. The 4 s breath and 240 ms ramp are new.

## Proposed `tokens.ts` diff (for the theme owner)

```ts
// new primitives
const concrete = {
  50: '#F3F4F4', 100: '#EBECED', 200: '#D2D4D6', 300: '#B8BBBE', 400: '#9A9EA2',
  500: '#7C8085', 600: '#61656A', 700: '#484C51', 800: '#303337', 900: '#1C1E21',
} as const;
const signage = { black: '#000000', white: '#FFFFFF' } as const;

// semantic, light column only
bg:               { light: concrete[50],  dark: brand.night },
surface:          { light: concrete[50],  dark: brand.night },
'surface-sunken': { light: concrete[100], dark: '#000212' },
text:             { light: signage.black, dark: brand.white },
'text-muted':     { light: concrete[600], dark: brand.silver },
border:           { light: concrete[200], dark: '#1A2E6E' },
cta:              { light: orange[500],   dark: brand.orange },
'on-cta':         { light: signage.black, dark: brand.night },
glow:             { light: 'transparent', dark: '#0058F8A6' },
'glow-hot':       { light: 'transparent', dark: '#FC7C0080' },

// H-Lynk shell group (consumed by HLynkShell only)
hlynk: {
  body:      { daylit: concrete[200], night: concrete[800] },
  keyline:   { daylit: concrete[400], night: concrete[700] },
  lip:       { daylit: concrete[900], night: brand.night },
  ledWell:   { daylit: concrete[900], night: brand.night },
  ledOn:     apple[500],
  ledOff:    apple[900],
  padFace:   { daylit: concrete[100], night: concrete[900] },
  padEdge:   { daylit: concrete[600], night: concrete[400] },
  keyFace:   { daylit: concrete[300], night: concrete[700] },
  keyGlyph:  { daylit: signage.black, night: concrete[300] },
},
```

Risk the theme owner must check: kit components that rely on `text` being `night` (#00041C) for a royal-tinted black. The swap to pure black is a visual change, not a contrast one (19.06 vs 19.12 on the page).
