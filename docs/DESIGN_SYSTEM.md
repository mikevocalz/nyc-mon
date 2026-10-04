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
| `tone-orange-text` … `tone-brick-text` (new) | — | `orange-800`, `royal-600`, `carolina-800`, `leaf-800`, `apple-700`, `orange-900` | a district tone as text on the page (ghost labels, slider counter). Dark keeps the night steps (`orange-400`, `royal-300`, `carolina-400`, `leaf-400`, `apple-400`, `orange-300`) |

Orange rule on daylit: `orange-500` is a **face** (button, hatch band) carrying black text. It is never text, icon or line on a light surface (2.38:1 on `concrete-50`, forbidden row already in `CONTRAST.md`). Existing light-mode `primary` text (`orange-700`) stays legal (5.10:1) but new screens use `accent` for links and `text` for emphasis.

### Measured pairs (new tokens)

Method: WCAG 2.2 relative luminance, sRGB linearisation threshold 0.04045, as in `docs/design/CONTRAST.md` and `packages/theme/contrast.ts`. The rows below are the registry's own: `node packages/theme/contrast-docs.ts` writes them from `packages/theme/contrast.ts`, and the theme tests fail when they go stale.

<!-- contrast:design-system-pairs:start -->

| Pair | Mode | Foreground | Background | Ratio | Role (min) | Result | Where used |
|---|---|---|---|---:|---|---|---|
| orange ghost label on page | light | `tone-orange-text` #884300 | `bg` #F3F4F4 | 6.69 | text (4.5) | pass | `packages/ui/district/tones.ts:123`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| orange ghost label on page | dark | `tone-orange-text` #FD9D40 | `bg` #00041C | 9.74 | text (4.5) | pass | `packages/ui/district/tones.ts:123`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| orange ghost label on hover tint | light | `tone-orange-text` #884300 | `surface-sunken + orange-500/15` #EEDBC9 | 5.48 | text (4.5) | pass | `packages/ui/district/tones.ts:123`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| orange ghost label on hover tint | dark | `tone-orange-text` #FD9D40 | `surface-sunken + orange-500/15` #26140F | 8.46 | text (4.5) | pass | `packages/ui/district/tones.ts:123`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| royal ghost label on page | light | `tone-royal-text` #004CD9 | `bg` #F3F4F4 | 6.28 | text (4.5) | pass | `packages/ui/district/tones.ts:131`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| royal ghost label on page | dark | `tone-royal-text` #80ACFC | `bg` #00041C | 8.92 | text (4.5) | pass | `packages/ui/district/tones.ts:131`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| royal ghost label on hover tint | light | `tone-royal-text` #004CD9 | `surface-sunken + royal-500/15` #C8D6EF | 4.71 | text (4.5) | pass | `packages/ui/district/tones.ts:131`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| royal ghost label on hover tint | dark | `tone-royal-text` #80ACFC | `surface-sunken + royal-500/15` #000F35 | 8.25 | text (4.5) | pass | `packages/ui/district/tones.ts:131`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| carolina ghost label on page | light | `tone-carolina-text` #295D8E | `bg` #F3F4F4 | 6.25 | text (4.5) | pass | `packages/ui/district/tones.ts:138`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| carolina ghost label on page | dark | `tone-carolina-text` #78BEF4 | `bg` #00041C | 10.12 | text (4.5) | pass | `packages/ui/district/tones.ts:138`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| carolina ghost label on hover tint | light | `tone-carolina-text` #295D8E | `surface-sunken + carolina-500/15` #D3E2ED | 5.20 | text (4.5) | pass | `packages/ui/district/tones.ts:138`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| carolina ghost label on hover tint | dark | `tone-carolina-text` #78BEF4 | `surface-sunken + carolina-500/15` #0B1B33 | 8.59 | text (4.5) | pass | `packages/ui/district/tones.ts:138`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| leaf ghost label on page | light | `tone-leaf-text` #225E1F | `bg` #F3F4F4 | 7.09 | text (4.5) | pass | `packages/ui/district/tones.ts:145`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| leaf ghost label on page | dark | `tone-leaf-text` #6FC26B | `bg` #00041C | 9.29 | text (4.5) | pass | `packages/ui/district/tones.ts:145`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| leaf ghost label on hover tint | light | `tone-leaf-text` #225E1F | `surface-sunken + leaf-500/15` #D1E3D2 | 5.80 | text (4.5) | pass | `packages/ui/district/tones.ts:145`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| leaf ghost label on hover tint | dark | `tone-leaf-text` #6FC26B | `surface-sunken + leaf-500/15` #091C18 | 8.07 | text (4.5) | pass | `packages/ui/district/tones.ts:145`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| apple ghost label on page | light | `tone-apple-text` #AE0000 | `bg` #F3F4F4 | 6.81 | text (4.5) | pass | `packages/ui/district/tones.ts:153`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| apple ghost label on page | dark | `tone-apple-text` #FA4040 | `bg` #00041C | 5.68 | text (4.5) | pass | `packages/ui/district/tones.ts:153`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| apple ghost label on hover tint | light | `tone-apple-text` #AE0000 | `surface-sunken + apple-500/15` #EDC9C9 | 4.92 | text (4.5) | pass | `packages/ui/district/tones.ts:153`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| apple ghost label on hover tint | dark | `tone-apple-text` #FA4040 | `surface-sunken + apple-500/15` #25020F | 5.37 | text (4.5) | pass | `packages/ui/district/tones.ts:153`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| brick ghost label on page | light | `tone-brick-text` #602F00 | `bg` #F3F4F4 | 10.01 | text (4.5) | pass | `packages/ui/district/tones.ts:160`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| brick ghost label on page | dark | `tone-brick-text` #FEBE80 | `bg` #00041C | 12.47 | text (4.5) | pass | `packages/ui/district/tones.ts:160`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/cards/CardSlider.shared.tsx:33` |
| brick ghost label on hover tint | light | `tone-brick-text` #602F00 | `surface-sunken + orange-800/25` #D2C2B2 | 6.35 | text (4.5) | pass | `packages/ui/district/tones.ts:160`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| brick ghost label on hover tint | dark | `tone-brick-text` #FEBE80 | `surface-sunken + orange-800/25` #22120E | 11.09 | text (4.5) | pass | `packages/ui/district/tones.ts:160`, `packages/ui/Button.tsx:73`, `packages/ui/IconButton.tsx:79`, `packages/ui/Button.tsx:132`; tint layer fades in on group-hover; measured on the sunken page surface |
| disabled ghost label on page | both | `ink-400` #90929C | `concrete-50` #F3F4F4 | 2.81 | disabled (0) | exempt | `packages/ui/Button.tsx:48`, `packages/ui/IconButton.tsx:79`; inactive control: aria-disabled, no press handler |
| field error message on page | light | `danger` #D50000 | `bg` #F3F4F4 | 4.98 | text (4.5) | pass | `packages/ui/cards/neon-field.ts:22`, `packages/ui/ErrorMessage.tsx:21`, `packages/ui/cards/NeonCheckbox.tsx:80`, `packages/ui/audio/VoiceRecorder.native.tsx:288` |
| field error message on page | dark | `danger` #FA4040 | `bg` #00041C | 5.68 | text (4.5) | pass | `packages/ui/cards/neon-field.ts:22`, `packages/ui/ErrorMessage.tsx:21`, `packages/ui/cards/NeonCheckbox.tsx:80`, `packages/ui/audio/VoiceRecorder.native.tsx:288` |
| daylit: signage-black on concrete-50 | both | `signage-black` #000000 | `concrete-50` #F3F4F4 | 19.06 | text (4.5) | pass | token contract |
| daylit: signage-black on concrete-100 | both | `signage-black` #000000 | `concrete-100` #EBECED | 17.75 | text (4.5) | pass | token contract |
| daylit: signage-black on white | both | `signage-black` #000000 | `white` #FFFFFF | 21.00 | text (4.5) | pass | token contract |
| daylit: muted concrete-600 on concrete-50 | both | `concrete-600` #61656A | `concrete-50` #F3F4F4 | 5.33 | text (4.5) | pass | token contract |
| daylit: muted concrete-600 on concrete-100 | both | `concrete-600` #61656A | `concrete-100` #EBECED | 4.96 | text (4.5) | pass | token contract |
| daylit: muted concrete-600 on white | both | `concrete-600` #61656A | `white` #FFFFFF | 5.87 | text (4.5) | pass | token contract |
| daylit: secondary concrete-700 on concrete-50 | both | `concrete-700` #484C51 | `concrete-50` #F3F4F4 | 7.85 | text (4.5) | pass | token contract |
| daylit: secondary concrete-700 on concrete-100 | both | `concrete-700` #484C51 | `concrete-100` #EBECED | 7.31 | text (4.5) | pass | token contract |
| daylit: large/ui grey concrete-500 on page | both | `concrete-500` #7C8085 | `concrete-50` #F3F4F4 | 3.61 | large-text (3) | pass | token contract; never body text; large text and marks only |
| daylit: CTA label | both | `signage-black` #000000 | `orange-500` #FC7C00 | 8.02 | text (4.5) | pass | token contract |
| daylit: CTA pressed label | both | `signage-black` #000000 | `orange-400` #FD9D40 | 10.07 | text (4.5) | pass | token contract |
| daylit: link/focus royal-500 on concrete-50 | both | `royal-500` #0058F8 | `concrete-50` #F3F4F4 | 5.08 | text (4.5) | pass | token contract |
| daylit: danger apple-600 on concrete-50 | both | `apple-600` #D50000 | `concrete-50` #F3F4F4 | 4.98 | text (4.5) | pass | token contract |
| daylit: success leaf-700 on concrete-50 | both | `leaf-700` #2C7A29 | `concrete-50` #F3F4F4 | 4.86 | text (4.5) | pass | token contract |
| daylit: info carolina-800 on concrete-50 | both | `carolina-800` #295D8E | `concrete-50` #F3F4F4 | 6.25 | text (4.5) | pass | token contract |
| daylit: link/focus royal-500 on concrete-100 | both | `royal-500` #0058F8 | `concrete-100` #EBECED | 4.73 | text (4.5) | pass | token contract |
| daylit: danger apple-600 on concrete-100 | both | `apple-600` #D50000 | `concrete-100` #EBECED | 4.64 | text (4.5) | pass | token contract |
| daylit: success leaf-700 on concrete-100 | both | `leaf-700` #2C7A29 | `concrete-100` #EBECED | 4.53 | text (4.5) | pass | token contract |
| daylit: info carolina-800 on concrete-100 | both | `carolina-800` #295D8E | `concrete-100` #EBECED | 5.82 | text (4.5) | pass | token contract |
| daylit: hairline concrete-200 on page | both | `concrete-200` #D2D4D6 | `concrete-50` #F3F4F4 | 1.35 | decorative (0) | exempt | `packages/theme/tokens.ts:150`; `border` on daylit: dividers and frames around controls whose label identifies them |
| daylit: keyline concrete-400 on page | both | `concrete-400` #9A9EA2 | `concrete-50` #F3F4F4 | 2.45 | decorative (0) | exempt | `packages/theme/tokens.ts:78`; decorative keylines (docs/DESIGN_SYSTEM.md concrete-400); no information |
| hlynk: LED on in the black head | both | `led-on` #F80000 | `hlynk-core-black` #000000 | 4.99 | ui (3) | pass | token contract |
| hlynk: trackpad ring on pad face | both | `hlynk-core-ring` #F80000 | `hlynk-core-black` #000000 | 4.99 | ui (3) | pass | token contract |
| hlynk: black control edge on body | both | `hlynk-core-black` #000000 | `hlynk-core-body` #D50000 | 3.83 | ui (3) | pass | token contract; the key, pad and head edges identify each control; black is never text on the body |
| hlynk: key glyph | both | `hlynk-core-glyph` #DFE0E1 | `hlynk-core-black` #000000 | 15.89 | ui (3) | pass | token contract |
| hlynk: key glyph pressed | both | `hlynk-core-glyph-pressed` #FFFFFF | `hlynk-core-black` #000000 | 21.00 | ui (3) | pass | token contract |
| hlynk: text on body | both | `hlynk-core-ink` #FFFFFF | `hlynk-core-body` #D50000 | 5.48 | text (4.5) | pass | token contract |
| hlynk: hatch rim on pad face | both | `hlynk-core-hatch-rim` #FC7C00 | `hlynk-core-black` #000000 | 8.02 | ui (3) | pass | token contract |
| hlynk: hatch orange on night | both | `hlynk-core-hatch-rim` #FC7C00 | `ink-950` #00041C | 7.76 | text (4.5) | pass | token contract |
| hlynk: body on daylit page | both | `hlynk-core-body` #D50000 | `concrete-50` #F3F4F4 | 4.98 | decorative (0) | exempt | `packages/theme/tokens.ts:188`; the shell is not a control; its edge needs no ratio (measures 4.98 anyway) |
| hlynk: body on night page | both | `hlynk-core-body` #D50000 | `ink-950` #00041C | 3.70 | decorative (0) | exempt | `packages/theme/tokens.ts:188`; the shell is not a control; its edge needs no ratio (measures 3.70 anyway) |
| hlynk: LED off in the black head | both | `led-off` #5E0000 | `hlynk-core-black` #000000 | 1.48 | decorative (0) | exempt | `packages/theme/tokens.ts:174`; the unlit lens; LED state is never conveyed by the LED alone (a text chip sits in the screen) |
| hlynk: disabled key glyph | both | `hlynk-core-glyph-disabled` #484C51 | `hlynk-core-black` #000000 | 2.43 | disabled (0) | exempt | `packages/theme/tokens.ts:198`; inactive key |
| hlynk: key and trackpad focus outline on body | both | `hlynk-core-ink` #FFFFFF | `hlynk-core-body` #D50000 | 5.48 | ui (3) | pass | `packages/ui/hlynk/HLynkKey.tsx:69`, `packages/ui/hlynk/Trackpad.web.tsx:48` |
| hlynk: trackpad ring, booting or disabled | both | `led-off` #5E0000 | `hlynk-core-black` #000000 | 1.48 | disabled (0) | exempt | `packages/ui/hlynk/TrackpadFace.tsx:41`; inactive trackpad during boot (WCAG 1.4.11 inactive components) |
| hlynk: reduced-motion LED cue in the black head | both | `led-on` #F80000 | `hlynk-core-black` #000000 | 4.99 | ui (3) | pass | `packages/ui/hlynk/ScannerLed.tsx:96`, `packages/ui/hlynk/ScannerLed.tsx:104`, `packages/ui/hlynk/ScannerLed.tsx:107`; tick row, filled dot and exclamation dot that stand in for the LED rhythm |

<!-- contrast:design-system-pairs:end -->

### Forbidden pairs (add to `FORBIDDEN`)

<!-- contrast:design-system-forbidden:start -->

| Rule | Pair | Ratio | Needs | Rule text |
|---|---|---:|---:|---|
| white on apple | `white` #FFFFFF on `apple-500` #F80000 | 4.21 | 4.5 | Apple faces take night text below 18.66px bold. |
| orange on daylit page | `orange-500` #FC7C00 on `concrete-50` #F3F4F4 | 2.38 | 3 | Orange is a face on daylit (cta), never text, icon or line. |
| LED on Core body | `led-on` #F80000 on `hlynk-core-body` #D50000 | 1.30 | 3 | The LED, emitters and the trackpad ring never touch bare body plastic; they sit on black. |
| apple-400 on Core body | `apple-400` #FA4040 on `hlynk-core-body` #D50000 | 1.53 | 3 | Same for the lighter red. |
| black text on Core body | `signage-black` #000000 on `hlynk-core-body` #D50000 | 3.83 | 4.5 | Black is a control face on the body, never text. Text on the body is hlynk-core-ink (white). |
| concrete-900 keys on Core body | `concrete-900` #1C1E21 on `hlynk-core-body` #D50000 | 3.05 | 3.5 | Passes 3:1 by 0.05; too thin a margin for key edges. Core keys are pure black. |
| black keys on apple-700 | `signage-black` #000000 on `apple-700` #AE0000 | 2.80 | 3 | Why the body is not the deeper red. |

<!-- contrast:design-system-forbidden:end -->

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
