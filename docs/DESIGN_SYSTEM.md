# NYC-MON design system: daylit proposal

Owner: `design-director`. Written 2026-10-04. Status: **proposal**. No token in `packages/theme/tokens.ts` has changed. The diffs below are for whoever owns `@acme/theme` to land as a PR, with `packages/theme/contrast.ts` rows added in the same PR (Law 10: a token without a measurement does not exist).

Inputs: `docs/canon/DECISIONS.md` #4 (daylit default; dark for night and the hatch), #7 (red LED; orange for CTA and hatch), #8 (H-Lynk chrome), #16 (the H-Lynk Core: matte red body, black scanner head, black controls); `prompts/BUILD_PROMPT_v3.md` §1.1, §1.3; `docs/REPO_MAP.md` §6; `docs/design/CONTRAST.md`; `docs/design/hlynk/DIRECTION.md`.

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
| `concrete-100` | #EBECED | sunken wells |
| `concrete-200` | #D2D4D6 | dividers, input edges on raised |
| `concrete-300` | #B8BBBE | inactive tile faces |
| `concrete-400` | #9A9EA2 | decorative keylines |
| `concrete-500` | #7C8085 | large text / ui only on `concrete-50` |
| `concrete-600` | #61656A | muted text (`text-muted` on raised and page) |
| `concrete-700` | #484C51 | secondary text, disabled H-Lynk key glyph |
| `concrete-800` | #303337 | night-scoped panels |
| `concrete-900` | #1C1E21 | darkest neutral; not used on the H-Lynk (its blacks are `signage-black`) |

### New primitive: `signage`

| Token | Hex | Role |
|---|---|---|
| `signage-black` | #000000 | type on daylit neutrals; the H-Lynk Core's scanner head, antenna, bezel, keys and trackpad face (#16). The MTA sign system sets white Helvetica on a black band (1970 Graphics Standards Manual, https://standardsmanual.com/products/nyctamanual); this is that black, pure, not a tinted near-black. |
| `signage-white` | #FFFFFF | type on `concrete-800/900`, on night, and the only ink allowed on the red Core body |

### New semantic: `led`

The LED and scanner emitters always sit in the black scanner head (#16), so they need no per-scheme well.

| Token | Value | Note |
|---|---|---|
| `led-on` | `apple-500` #F80000 | #7; inside the black head only |
| `led-off` | `apple-900` #5E0000 | decorative: the unlit lens |

### New group: `hlynk` (H-Lynk Core, Decision #16)

The body is plastic, so it does not change between daylit and night; only the page behind it and the scene inside the screen follow #4.

| Token | Value | Part |
|---|---|---|
| `hlynk.body` | `apple-600` #D50000 | matte red Core body. The darkest kit red where black controls hold 3:1; `apple-700` fails (black keys 2.80:1) |
| `hlynk.black` | `signage-black` #000000 | scanner head, antenna, bezel, key faces, trackpad face |
| `hlynk.ring` | `apple-500` #F80000 | trackpad ring, inset 4 pt on the black face |
| `hlynk.glyph` | `silver-300` #DFE0E1 | key glyphs |
| `hlynk.glyphPressed` | `signage-white` #FFFFFF | pressed key glyph |
| `hlynk.glyphDisabled` | `concrete-700` #484C51 | disabled key glyph (exempt) |
| `hlynk.ink` | `signage-white` #FFFFFF | any text on the body |
| `hlynk.hatchRim` | `orange-500` #FC7C00 | trackpad rim during the hatch only (#7) |

`standard` (charcoal/gunmetal) and `pro` (white/silver with red edge lights) tiers get their own groups, measured, when they ship.

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
| LED / emitter in the black head | `apple-500` #F80000 | `signage-black` #000000 | 4.99 | ui 3 | pass |
| trackpad ring on pad face | `apple-500` | `signage-black` | 4.99 | ui 3 | pass |
| black key / pad / head edge on Core body | `signage-black` | `apple-600` #D50000 | 3.83 | ui 3 | pass: the edge identifies each control |
| key glyph | `silver-300` #DFE0E1 | `signage-black` | 15.89 | ui 3 | pass |
| key glyph pressed | `signage-white` | `signage-black` | 21.00 | ui 3 | pass |
| text on Core body | `signage-white` | `apple-600` | 5.48 | text 4.5 | pass |
| hatch rim on pad face | `orange-500` | `signage-black` | 8.02 | ui 3 | pass |
| hatch orange on night | `orange-500` | `night` | 7.76 | text 4.5 | pass (already in `CONTRAST.md`) |
| Core body on daylit page | `apple-600` | `concrete-50` | 4.98 | decorative | exempt (passes anyway): the shell is not a control |
| Core body on night page | `apple-600` | `night` #00041C | 3.70 | decorative | exempt (passes anyway) |
| disabled key glyph | `concrete-700` | `signage-black` | 2.43 | disabled | exempt: inactive key |

### Forbidden pairs (add to `FORBIDDEN`)

| Pair | Ratio | Needs | Rule |
|---|---:|---|---|
| `apple-500` on `apple-600` | 1.30 | 3 | The LED, emitters and the trackpad ring never touch bare body plastic; they sit on black. |
| `apple-400` on `apple-600` | 1.53 | 3 | Same for the lighter red. |
| `signage-black` text on `apple-600` | 3.83 | 4.5 | Black is a control face on the body, never text. Text on the body is white. |
| `concrete-900` on `apple-600` | 3.05 | 3 | Too thin a margin for key edges; Core keys are pure black. |
| `signage-black` on `apple-700` | 2.80 | 3 | Why the body is not the deeper red. |
| `orange-500` on `concrete-50` | 2.38 | 3 | Orange is a face on daylit, never ink. |
| `white` on `apple-500` | 4.21 | 4.5 | already forbidden; restated because an LED chip is tempting |

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
| `motion-led-breath` | 4 s period, 35 → 100% | steady + progress tick row in the head | `incubating` |
| `motion-scan-fan` | one upward sweep, 400 ms | absent | M01 boot (scan moments are Phase 2) |
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

// H-Lynk Core group (Decision #16; consumed by the H-Lynk kit components only)
hlynk: {
  core: {
    body:          apple[600],
    black:         signage.black,
    ring:          apple[500],
    glyph:         silver[300],
    glyphPressed:  signage.white,
    glyphDisabled: concrete[700],
    ink:           signage.white,
    hatchRim:      orange[500],
  },
  // standard, pro: added and measured when those tiers ship
},
led: { on: apple[500], off: apple[900] },
```

Risk the theme owner must check: kit components that rely on `text` being `night` (#00041C) for a royal-tinted black. The swap to pure black is a visual change, not a contrast one (19.06 vs 19.12 on the page).
