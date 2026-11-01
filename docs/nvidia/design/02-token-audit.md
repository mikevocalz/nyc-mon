# 02 Token audit: companion UI

Source: `origin/feat/nvidia-05-submission-package` at `6f59ab27`. Skill: `design:design-system` is installed but was not loaded in this run; its checklist (tokens, components, wrappers) was applied by hand. **Manual pass.**

Repo rule (`packages/theme/tokens.ts:12`): no hex outside `packages/theme/tokens.ts`.

## Result

**No hardcoded colours, pixel sizes, font stacks or inline styles in the companion page.** A search of `nvidia.tsx` for `#hex`, `NNpx` and `style=` returned nothing. `nvidia.html` and `globals.css` have no hex; `globals.css:28` uses `var(--color-bg)`. Every component comes from `@acme/ui`, `@acme/ui/html` or `@acme/ui/tw`.

The problems are the opposite kind: **missing tokens**. Text and layout fall back to browser or react-native-web defaults instead of the theme's type ramp and widths.

## Missing or misused tokens in the page

| # | File:line | Today | Renders as | Should use | Why |
|---|---|---|---|---|---|
| T1 | `nvidia.tsx:116` | `<Section className="mx-auto w-full gap-target-gap">` as the root | Full window width, no side gutter, no `<main>` | `<Main className="mx-auto w-full max-w-content-feed gap-6 px-4 py-6 md:px-6">` | `contentWidths['content-feed']` = 38rem (`tokens.ts`, emitted `--container-content-feed`, theme.css:248). Gutters are `layout.gutterPt` 16 / `gutterMdPt` 24. No max width means lines run the full desktop width |
| T2 | `nvidia.tsx:116,121,124,130` | `gap-target-gap` (12px) as general spacing | 12px everywhere | `gap-6` between sections, `gap-3` inside a group | `xrTargets['target-gap']` exists to keep two headset ray targets apart (`tokens.ts` "Pointer targets on Horizon OS"). Spacing comes from `space` (4/8/12/16/24/32/48) |
| T3 | `nvidia.tsx:117` | `<Heading>` with no class | `<h1>` at the browser default size in Space Grotesk (via `withBodyFace`) | `className="font-display text-type-station"` | `typeRamp['type-station']`: "one line per screen at most: the screen's name" |
| T4 | `nvidia.tsx:125` | `<Heading>` with no class and no level | A second `<h1>` | `level={2} className="text-type-title"` | One station per screen; section headings take `type-title` |
| T5 | `nvidia.tsx:118,124,126,135` | `<Paragraph>` with no size class | 14px (react-native-web's root Text `font: 14px System`, documented in `packages/ui/html/body-font.tsx` header; size not overridden here) | `text-type-body` for body; `text-type-caption text-text-muted` for meta lines (`:118` model line, `:135` revision line) | Ramp body is 17/24; "nothing is set smaller" than caption 13 |
| T6 | `nvidia.tsx:120` | Error `<Paragraph role="alert">` | Same colour and weight as body text | `<Banner tone="danger" live="alert" title=… description=…/>` from `@acme/ui` | Banner uses `border-danger`, `text-danger` icon, `text-text-secondary` description, all tokens. `ErrorMessage` is the field-level alternative |
| T7 | `nvidia.tsx:144` | Boot failure `<Paragraph role="alert">` | Bare text, top-left, no gutter | Same `Banner` inside the same `Main` wrapper | Same as T6 |
| T8 | `nvidia.tsx:122,128` | `TextField` default `surface="well"` | Night well (`bg-ink-950`) with orange nameplate on a daylit page | `surface="daylit"` | The kit says so: `TextField.tsx:68` "`daylit` for screens on the daylit page". Daylit focus is `focus:border-focus` (royal); the well's focus is a 1.61:1 orange step, see 04 |
| T9 | `nvidia.tsx:128` | Single-line `TextField` for a 500-character note | One line, text scrolls sideways | Keep `TextField surface="daylit"` with `hint` for the limit. Kit `Textarea` (`packages/ui/Textarea.tsx`) has no `surface` prop, so it would bring back the night well beside a daylit field. A daylit `Textarea` is a kit change for the kit owner | The content is multi-sentence, but mixing field looks costs more |
| T10 | `nvidia.tsx:123,131` | Two solid orange buttons (Send, Save) | Two equal-weight primaries | Send `variant="cta"`; Save default solid or `outline` | `cta` is "the screen's one primary call to action" (`control-look.ts:16`) |
| T11 | `nvidia.tsx:132` | Forget as `variant="outline"` | Same weight as Export and Load | `variant="danger"` behind a `Dialog` confirm | Danger maps to apple; it's the only destructive action on the page |
| T12 | `nvidia.html:2` | `<meta name="color-scheme" content="light dark">` | No effect on token colours: `theme.css:341` sets `:root { color-scheme: light }`, which wins. May let the browser paint a dark canvas before CSS loads (not verified) | `content="light"` or remove | Page is daylit by canon Decision #4 |

## Kit-level values the page inherits (not to fix in this lane)

The memory rule is "never edit the kit". These are recorded so the integrator knows where they come from; none is a hex outside `tokens.ts`.

| File:line | Value | Note |
|---|---|---|
| `packages/ui/TextField.tsx:42` (daylit) and `cards/neon-field.ts:15` (well) | `text-base` on the input | `Button.styles.ts:8-12` says labels avoid `text-base` because of the native rem-14 polyfill. On web it is 16px, so no visible issue here |
| `packages/ui/cards/neon-field.ts:27` | `text-[10px]` paste chip | Only drawn with `onPaste`; this page does not pass it |
| `packages/ui/district/tones.ts:126` | `focus:shadow-[0_0_18px_-4px_var(--color-orange-500)]` | Arbitrary shadow, token colour |
| `packages/ui/Button.styles.ts:64-65` | `py-[14px]`, `py-[18px]` | Ghost only; page uses none |
| `packages/ui/cards/NeonSwitch.tsx:18` | `h-8 w-14` track | 32px tall; below `layout.minTargetIosPt` 44. See 04 |

## Tokens checked and correct

- Page background: `globals.css:28` `var(--color-bg)` = `concrete-50` `#F3F4F4` in light.
- Fonts: `globals.css:10-21` load Archivo Black and Space Grotesk from repo assets; families match `fontFamilies`.
- Button target floor: `min-h-target` (48px, `theme.css:245`) on every `Button` root.
- Focus ring on buttons and switch: `ring-focus` with `ring-offset-bg`.
- Motion: `motion-reduce:transition-none` on Button; `useReducedMotion` in NeonSwitch.
