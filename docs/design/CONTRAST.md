# NYC-MON contrast table

Measured 2026-10-04 against `packages/theme/tokens.ts` (the only hex source; `theme.css` and `theme-native.css` are generated from it). WCAG 2.2 relative luminance with the 0.04045 linearisation threshold. Translucent colours (`/NN`) are composited over the layers beneath them before measuring.

The registry lives in `packages/theme/contrast.ts`; `packages/theme/contrast.test.ts` runs it (`pnpm --filter @acme/theme test`). Every table row below is generated from that registry, so if the two disagree, the code is right and this file is stale.

## Thresholds

| Role | Minimum | WCAG |
|---|---:|---|
| text | 4.5:1 | 1.4.3, body text under 24px (18.66px bold) |
| large-text | 3:1 | 1.4.3, 24px+, or 18.66px+ bold |
| ui | 3:1 | 1.4.11, control edges, state marks, icons, chart marks |
| decorative | exempt | carries no information; a reason is required |
| disabled | exempt | inactive component; a reason is required |

## Summary

- 225 measured rows: 198 pass, 10 fail, 17 exempt (decorative or disabled).
- Semantic tokens are measured in light and dark. Palette steps (`orange-500`, `ink-950`) do not change with the theme and get one `both` row.
- Every semantic token on every surface passes as a token contract. All 10 failures come from how screens combine tokens: opacity modifiers on text and focus rings, a tab bar that uses a themed background under hard-coded white, and white labels on the apple face.
- The kit's night facades (cards, fields, nav, tables, charts) pass everywhere. The tone tables in `packages/ui/district/tones.ts` already pick night or white per face by measurement.

## Findings

Each failing row, with the suggested swap. None of these were fixed in this pass.

| # | Where | Pair | Measured | Needs | Suggested swap |
|---|---|---|---:|---:|---|
| 1 | `packages/app/features/schedule/MiniCalendar.tsx:111` | out-of-month day, `text-text-muted/50` on `surface-raised` | light 2.29, dark 3.36 | 4.5 | `text-text-muted` (7.15 light, 10.08 dark). Mark out-of-month with weight or size, not opacity. |
| 2 | `packages/app/features/schedule/BookingSurface.tsx:74` | past day, `text-text-muted/50` on `surface` | light 2.24, dark 3.35 | 4.5 | `text-text-muted` (6.73 / 11.13). Past days still call `selectDate` (line 58), so they are not exempt as disabled. If they should be inactive, set `accessibilityState.disabled` and stop the press. |
| 3 | `apps/mobile/components/AppTabBar.tsx:91`, `:103` | grid tab idle, `text-white/70` on `bg-bg/95` | light 1.04 | 4.5 | The grid bar (`:122`) uses the themed `bg-bg/95` under hard-coded white, so in light theme the labels vanish. Make the bar a night facade: `bg-ink-950/95` with `text-silver-300` (15.36), or wrap it in `NightScope`. Dark passes. |
| 4 | `apps/mobile/components/AppTabBar.tsx:78`, `:90` | grid tab active, `text-primary` on `bg/95 + primary/15` | light 4.29 | 4.5 | Same fix as 3. On night, `primary` over the 15% tint passes. |
| 5 | `packages/ui/Button.tsx:23`, `packages/ui/IconButton.tsx:20`, `packages/ui/SearchBar.tsx:26` | focus ring `ring-focus/60` on `bg` | light 2.68 | 3 | `ring-focus` at full strength (5.27 light, 7.89 dark). |
| 6 | `apps/web/components/site/SiteHeader.tsx:200` | focus ring `ring-focus/50` on `surface` | light 2.24, dark 2.66 | 3 | `ring-focus`. `ring-focus/50` also appears in `packages/ui/cards/NeonSwitch.tsx:19` and other kit files; the same swap applies. |
| 7 | `packages/ui/dropdown.ts:29`, `packages/ui/nav/NavBar.tsx:83` | active item, `text-white` on `bg-apple-500` | 4.21 | 4.5 | `text-ink-950` (4.83), what `TONE_CLASSES.apple.onFace` already uses (`tones.ts:144`). |

Related, not counted as a failure: `ring-offset-2` without a `ring-offset-*` colour (Button.tsx:23, IconButton.tsx:20, NeonSwitch.tsx:19) draws Tailwind v4's default `#fff` offset band between control and ring. On night that band is loud but visible; on the light page it is invisible (1.0:1 on `ink-50`), which leaves the ring alone to carry focus. Set `ring-offset-bg` or `ring-offset-surface` with the ring fix.

## §1.3 rules against the real tokens

The prompt's Knicks numbers were approximations. The repo samples its anchors from the logo: orange `#FC7C00`, royal `#0058F8`, night `#00041C`, banner white `#F8F8F8`. Measured:

| §1.3 approximation | Repo pair | Repo ratio | Verdict |
|---|---|---:|---|
| White on blue ≈ 5.6 | `white` on `royal-500` | 5.60 | body text OK |
| Orange on blue ≈ 2.2 | `orange-500` on `royal-500` | 2.14 | fails text and 3:1 UI |
| Black on orange ≈ 8 | `ink-950` (night) on `orange-500` | 7.76 | button label OK |
| White on orange ≈ 2.6 | `white` on `orange-500` | 2.62 | fails |
| Blue on white ≈ 5.6 | `royal-500` on `ink-50` | 5.27 | OK |

**Is orange on royal used anywhere?** No. A same-line scan of `packages/ui`, `packages/app`, `apps/web/{app,components}` and `apps/mobile/{app,components}` finds no `text-/border-/stroke-/fill-orange-*` next to `bg-royal-*`. The closest case is the chart keyline: `keylineFor()` (`packages/ui/district/series.ts:75`) draws a royal keyline under orange strokes (`NeonLineChart.tsx:129`). The stroke sits on night (7.76), and the keyline is registered as decorative.

**White on orange buttons anywhere?** No. The scan finds no `text-white`/`text-ink-50` beside `bg-orange-500` or `bg-primary`. Orange faces take night text: `TONE_CLASSES.orange.onFace` (`tones.ts:117`), `dropdown.ts:19`, `NavBar.tsx:69`, and `on-primary` resolves to night in dark mode. In light mode `primary` is `orange-700` and `on-primary` is white: 5.62, an orange-700 face, not the brand orange.

**Orange is an accent on night and neutrals.** Orange as text on night uses `orange-400` (9.74) or `orange-500` (7.76). Orange on the light page measures 2.46 and fails even 3:1, so light-mode `primary` is `orange-700`. The same holds for carolina (2.42) and leaf (2.70); light mode uses `info` (`carolina-800`) and `success` (`leaf-700`).

**Royal is structure, not text, on night.** `royal-500` on night is 3.63: fine for borders and chart marks, short of 4.5 for text. Royal labels use `royal-300` (8.92).

The test keeps these honest: each forbidden pair below must still measure under its threshold (otherwise the rule is stale), and the same-line scan fails the build if a white-on-orange or orange-on-royal class pair appears in component code. The scan is a heuristic. It reads tone tables and `tv()` slot maps, where a face and its label share a line, and misses classes composed across lines.

## Measured table
### Usage

| Pair | Mode | Foreground | Background | Ratio | Role (min) | Result | Where used |
|---|---|---|---|---:|---|---|---|
| text on surface | light | `text` #00041C | `surface` #F8F8F8 | 19.12 | text (4.5) | pass | `packages/ui/Text.tsx:39`, `packages/ui/Heading.tsx:25`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| text on surface | dark | `text` #F8F8F8 | `surface` #00041C | 19.12 | text (4.5) | pass | `packages/ui/Text.tsx:39`, `packages/ui/Heading.tsx:25`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| muted text on surface | light | `text-muted` #545767 | `surface` #F8F8F8 | 6.73 | text (4.5) | pass | `packages/ui/Text.tsx:40`, `apps/mobile/components/AppTabBar.tsx:105`, `packages/app/features/schedule/BookingSurface.tsx:63` |
| muted text on surface | dark | `text-muted` #BEC0C2 | `surface` #00041C | 11.13 | text (4.5) | pass | `packages/ui/Text.tsx:40`, `apps/mobile/components/AppTabBar.tsx:105`, `packages/app/features/schedule/BookingSurface.tsx:63` |
| muted text on raised | light | `text-muted` #545767 | `surface-raised` #FFFFFF | 7.15 | text (4.5) | pass | `apps/mobile/components/EventActionsSheet.tsx:50`, `packages/app/features/home/home-content.tsx:76`, `packages/ui/Text.tsx:40` |
| muted text on raised | dark | `text-muted` #BEC0C2 | `surface-raised` #0A1230 | 10.08 | text (4.5) | pass | `apps/mobile/components/EventActionsSheet.tsx:50`, `packages/app/features/home/home-content.tsx:76`, `packages/ui/Text.tsx:40` |
| primary text on surface | light | `primary` #A35100 | `surface` #F8F8F8 | 5.30 | large-text (3) | pass | `packages/app/features/error/screen.shared.tsx:19`; font-display text-display-xl (60px) |
| primary text on surface | dark | `primary` #FC7C00 | `surface` #00041C | 7.76 | large-text (3) | pass | `packages/app/features/error/screen.shared.tsx:19`; font-display text-display-xl (60px) |
| primary text on raised | light | `primary` #A35100 | `surface-raised` #FFFFFF | 5.62 | text (4.5) | pass | `packages/ui/Text.tsx:42`, `packages/ui/Heading.tsx:27` |
| primary text on raised | dark | `primary` #FC7C00 | `surface-raised` #0A1230 | 7.02 | text (4.5) | pass | `packages/ui/Text.tsx:42`, `packages/ui/Heading.tsx:27` |
| primary icon in primary/10 well | light | `primary` #A35100 | `surface-raised + primary/10` #F6EEE6 | 4.88 | ui (3) | pass | `packages/app/features/home/home.data.ts:28`, `packages/app/features/home/home.data.ts:33` |
| primary icon in primary/10 well | dark | `primary` #FC7C00 | `surface-raised + primary/10` #221D2B | 6.29 | ui (3) | pass | `packages/app/features/home/home.data.ts:28`, `packages/app/features/home/home.data.ts:33` |
| accent text on raised | light | `accent` #0058F8 | `surface-raised` #FFFFFF | 5.60 | text (4.5) | pass | `packages/ui/Text.tsx:41`, `packages/app/features/home/home-content.tsx:77`, `packages/app/features/editor/AttachSheet.tsx:88` |
| accent text on raised | dark | `accent` #4BA8F0 | `surface-raised` #0A1230 | 7.14 | text (4.5) | pass | `packages/ui/Text.tsx:41`, `packages/app/features/home/home-content.tsx:77`, `packages/app/features/editor/AttachSheet.tsx:88` |
| accent icon in accent/10 well | light | `accent` #0058F8 | `surface-raised + accent/10` #E6EEFE | 4.81 | ui (3) | pass | `packages/app/features/home/home.data.ts:29`, `packages/app/features/home/home.data.ts:34` |
| accent icon in accent/10 well | dark | `accent` #4BA8F0 | `surface-raised + accent/10` #112143 | 6.17 | ui (3) | pass | `packages/app/features/home/home.data.ts:29`, `packages/app/features/home/home.data.ts:34` |
| accent bell icon on raised | light | `accent` #0058F8 | `surface-raised` #FFFFFF | 5.60 | ui (3) | pass | `apps/mobile/components/AppHeader.tsx:70` |
| accent bell icon on raised | dark | `accent` #4BA8F0 | `surface-raised` #0A1230 | 7.14 | ui (3) | pass | `apps/mobile/components/AppHeader.tsx:70` |
| danger text on raised | light | `danger` #D50000 | `surface-raised` #FFFFFF | 5.48 | text (4.5) | pass | `packages/ui/Text.tsx:44`, `packages/app/features/editor/AttachSheet.tsx:168`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| danger text on raised | dark | `danger` #FA4040 | `surface-raised` #0A1230 | 5.14 | text (4.5) | pass | `packages/ui/Text.tsx:44`, `packages/app/features/editor/AttachSheet.tsx:168`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| danger text on danger/10 hover | light | `danger` #D50000 | `surface-raised + danger/10` #FBE6E6 | 4.57 | text (4.5) | pass | `apps/mobile/components/EventActionsSheet.tsx:44`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| danger text on danger/10 hover | dark | `danger` #FA4040 | `surface-raised + danger/10` #221732 | 4.76 | text (4.5) | pass | `apps/mobile/components/EventActionsSheet.tsx:44`, `apps/mobile/components/EventActionsSheet.tsx:54` |
| on-primary on primary | light | `on-primary` #FFFFFF | `primary` #A35100 | 5.62 | text (4.5) | pass | `packages/app/features/home/home-content.tsx:48`, `packages/app/features/explore/explore.store.ts:17`, `apps/mobile/components/AppTabBar.tsx:105` |
| on-primary on primary | dark | `on-primary` #00041C | `primary` #FC7C00 | 7.76 | text (4.5) | pass | `packages/app/features/home/home-content.tsx:48`, `packages/app/features/explore/explore.store.ts:17`, `apps/mobile/components/AppTabBar.tsx:105` |
| on-primary/90 on primary | light | `on-primary/90` #F6EEE6 | `primary` #A35100 | 4.88 | text (4.5) | pass | `packages/app/features/home/home-content.tsx:53`, `packages/app/features/home/home-content.tsx:54` |
| on-primary/90 on primary | dark | `on-primary/90` #191019 | `primary` #FC7C00 | 7.10 | text (4.5) | pass | `packages/app/features/home/home-content.tsx:53`, `packages/app/features/home/home-content.tsx:54` |
| on-primary on primary-pressed | light | `on-primary` #FFFFFF | `primary-pressed` #884300 | 7.37 | text (4.5) | pass | `packages/app/features/explore/explore.store.ts:18`, `apps/mobile/components/AppTabBar.tsx:79` |
| on-primary on primary-pressed | dark | `on-primary` #00041C | `primary-pressed` #FD9D40 | 9.74 | text (4.5) | pass | `packages/app/features/explore/explore.store.ts:18`, `apps/mobile/components/AppTabBar.tsx:79` |
| on-accent on accent | light | `on-accent` #FFFFFF | `accent` #0058F8 | 5.60 | text (4.5) | pass | `packages/app/features/explore/explore.store.ts:19`, `apps/mobile/app/(drawer)/split/_layout.tsx:300` |
| on-accent on accent | dark | `on-accent` #00041C | `accent` #4BA8F0 | 7.89 | text (4.5) | pass | `packages/app/features/explore/explore.store.ts:19`, `apps/mobile/app/(drawer)/split/_layout.tsx:300` |
| inverse text on text | light | `text-inverse` #F8F8F8 | `text` #00041C | 19.12 | text (4.5) | pass | `packages/ui/Text.tsx:43`, `packages/ui/Heading.tsx:29` |
| inverse text on text | dark | `text-inverse` #00041C | `text` #F8F8F8 | 19.12 | text (4.5) | pass | `packages/ui/Text.tsx:43`, `packages/ui/Heading.tsx:29` |
| out-of-month day (muted/50) | light | `text-muted/50` #AAABB3 | `surface-raised` #FFFFFF | 2.29 | text (4.5) | **FAIL** | `packages/app/features/schedule/MiniCalendar.tsx:111`; days stay readable and pressable; not disabled |
| out-of-month day (muted/50) | dark | `text-muted/50` #646979 | `surface-raised` #0A1230 | 3.36 | text (4.5) | **FAIL** | `packages/app/features/schedule/MiniCalendar.tsx:111`; days stay readable and pressable; not disabled |
| past day (muted/50) | light | `text-muted/50` #A6A8B0 | `surface` #F8F8F8 | 2.24 | text (4.5) | **FAIL** | `packages/app/features/schedule/BookingSurface.tsx:74`; past days still call selectDate (BookingSurface.tsx:58); not disabled |
| past day (muted/50) | dark | `text-muted/50` #5F626F | `surface` #00041C | 3.35 | text (4.5) | **FAIL** | `packages/app/features/schedule/BookingSurface.tsx:74`; past days still call selectDate (BookingSurface.tsx:58); not disabled |
| unavailable slot (muted/60) | light | `text-muted/60` #91939D | `surface-sunken` #ECECED | 2.60 | disabled (0) | exempt | `packages/app/features/schedule/BookingSurface.tsx:107`; accessibilityState disabled (BookingSurface.tsx:96) |
| unavailable slot (muted/60) | dark | `text-muted/60` #72747C | `surface-sunken` #000212 | 4.43 | disabled (0) | exempt | `packages/app/features/schedule/BookingSurface.tsx:107`; accessibilityState disabled (BookingSurface.tsx:96) |
| grid tab label idle (white/70) | light | `white/70` #FDFDFD | `bg + bg/95` #F8F8F8 | 1.04 | text (4.5) | **FAIL** | `apps/mobile/components/AppTabBar.tsx:91`, `apps/mobile/components/AppTabBar.tsx:103`, `apps/mobile/components/AppTabBar.tsx:122`; gridMode bar is bg-bg/95, a themed token; no NightScope around it |
| grid tab label idle (white/70) | dark | `white/70` #B3B4BB | `bg + bg/95` #00041C | 9.79 | text (4.5) | pass | `apps/mobile/components/AppTabBar.tsx:91`, `apps/mobile/components/AppTabBar.tsx:103`, `apps/mobile/components/AppTabBar.tsx:122`; gridMode bar is bg-bg/95, a themed token; no NightScope around it |
| grid tab label active | light | `primary` #A35100 | `bg + bg/95 + primary/15` #EBDFD3 | 4.29 | text (4.5) | **FAIL** | `apps/mobile/components/AppTabBar.tsx:78`, `apps/mobile/components/AppTabBar.tsx:90` |
| grid tab label active | dark | `primary` #FC7C00 | `bg + bg/95 + primary/15` #261618 | 6.63 | text (4.5) | pass | `apps/mobile/components/AppTabBar.tsx:78`, `apps/mobile/components/AppTabBar.tsx:90` |
| focus ring /60 on page | light | `focus/60` #6398F8 | `bg` #F8F8F8 | 2.68 | ui (3) | **FAIL** | `packages/ui/Button.tsx:23`, `packages/ui/IconButton.tsx:20`, `packages/ui/SearchBar.tsx:26`; ring-offset-2 with Tailwind v4 default offset colour #fff sits between the control and the ring |
| focus ring /60 on page | dark | `focus/60` #2D669B | `bg` #00041C | 3.39 | ui (3) | pass | `packages/ui/Button.tsx:23`, `packages/ui/IconButton.tsx:20`, `packages/ui/SearchBar.tsx:26`; ring-offset-2 with Tailwind v4 default offset colour #fff sits between the control and the ring |
| focus ring /50 on page | light | `focus/50` #7CA8F8 | `surface` #F8F8F8 | 2.24 | ui (3) | **FAIL** | `apps/web/components/site/SiteHeader.tsx:200` |
| focus ring /50 on page | dark | `focus/50` #265686 | `surface` #00041C | 2.66 | ui (3) | **FAIL** | `apps/web/components/site/SiteHeader.tsx:200` |
| focus ring on page | light | `focus` #0058F8 | `bg` #F8F8F8 | 5.27 | ui (3) | pass | `packages/ui/dropdown.ts:15`, `packages/ui/nav/NavBar.tsx:62`, `packages/ui/nav/NavBar.tsx:65` |
| focus ring on page | dark | `focus` #4BA8F0 | `bg` #00041C | 7.89 | ui (3) | pass | `packages/ui/dropdown.ts:15`, `packages/ui/nav/NavBar.tsx:62`, `packages/ui/nav/NavBar.tsx:65` |
| active nav underline | light | `accent` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:93` |
| active nav underline | dark | `accent` #4BA8F0 | `surface` #00041C | 7.89 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:93` |
| profile ring active | light | `accent` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:202` |
| profile ring active | dark | `accent` #4BA8F0 | `surface` #00041C | 7.89 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:202` |
| profile ring hover | light | `border-strong` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:203` |
| profile ring hover | dark | `border-strong` #4082FA | `surface` #00041C | 5.60 | ui (3) | pass | `apps/web/components/site/SiteHeader.tsx:203` |
| unread dot | light | `danger` #D50000 | `surface-raised` #FFFFFF | 5.48 | ui (3) | pass | `apps/mobile/components/AppHeader.tsx:71` |
| unread dot | dark | `danger` #FA4040 | `surface-raised` #0A1230 | 5.14 | ui (3) | pass | `apps/mobile/components/AppHeader.tsx:71` |
| theme border | light | `border` #D8D8DB | `surface-raised` #FFFFFF | 1.42 | decorative (0) | exempt | `apps/mobile/components/EventActionsSheet.tsx:42`, `apps/mobile/components/AppHeader.tsx:68`; frame on controls whose text label or icon identifies them; separators |
| theme border | dark | `border` #1A2E6E | `surface-raised` #0A1230 | 1.45 | decorative (0) | exempt | `apps/mobile/components/EventActionsSheet.tsx:42`, `apps/mobile/components/AppHeader.tsx:68`; frame on controls whose text label or icon identifies them; separators |
| neon glow | light | `glow` #C6D8F8 | `bg` #F8F8F8 | 1.36 | decorative (0) | exempt | `packages/theme/tokens.ts:208`, `packages/ui/district/tones.ts:126`; box-shadow halo behind a surface that already has its own edge |
| neon glow | dark | `glow` #003BAB | `bg` #00041C | 2.14 | decorative (0) | exempt | `packages/theme/tokens.ts:208`, `packages/ui/district/tones.ts:126`; box-shadow halo behind a surface that already has its own edge |
| hot glow | light | `glow-hot` #F9DFC6 | `bg` #F8F8F8 | 1.20 | decorative (0) | exempt | `packages/theme/tokens.ts:211`, `apps/mobile/components/AppTabBar.tsx:78`; box-shadow halo behind a surface that already has its own edge |
| hot glow | dark | `glow-hot` #7E400E | `bg` #00041C | 2.55 | decorative (0) | exempt | `packages/theme/tokens.ts:211`, `apps/mobile/components/AppTabBar.tsx:78`; box-shadow halo behind a surface that already has its own edge |
| structure rule /40 | light | `structure/40` #95B8F8 | `bg` #F8F8F8 | 1.89 | decorative (0) | exempt | `apps/mobile/components/AppTabBar.tsx:122`, `apps/web/components/site/SiteFooter.tsx:28`; section rule; no information |
| structure rule /40 | dark | `structure/40` #002674 | `bg` #00041C | 1.47 | decorative (0) | exempt | `apps/mobile/components/AppTabBar.tsx:122`, `apps/web/components/site/SiteFooter.tsx:28`; section rule; no information |
| title on night | both | `ink-50` #F8F8F8 | `ink-950` #00041C | 19.12 | text (4.5) | pass | `packages/ui/Card.tsx:36`, `packages/ui/cards/neon-field.ts:15`, `packages/ui/ToastCard.tsx:37` |
| white on night | both | `white` #FFFFFF | `ink-950` #00041C | 20.31 | text (4.5) | pass | `packages/ui/charts/StatCard.tsx:54`, `packages/ui/nav/NavBar.tsx:72` |
| table cell on stripe | both | `silver-100` #F6F6F6 | `ink-900` #14182E | 16.20 | text (4.5) | pass | `packages/ui/DataTable.tsx:44`, `packages/ui/DataTable.tsx:53` |
| nav link on night | both | `silver-200` #ECECED | `ink-950` #00041C | 17.20 | text (4.5) | pass | `packages/ui/nav/NavBar.tsx:66`, `packages/ui/dropdown.ts:16` |
| nav link on hover | both | `silver-200` #ECECED | `ink-800` #25293D | 12.16 | text (4.5) | pass | `packages/ui/dropdown.ts:14`, `packages/ui/nav/NavBar.tsx:67` |
| body on night | both | `silver-300` #DFE0E1 | `ink-950` #00041C | 15.36 | text (4.5) | pass | `packages/ui/Card.tsx:36`, `packages/ui/Dialog.tsx:49`, `packages/ui/TabBar.tsx:36` |
| table head on ink-900 | both | `silver-300` #DFE0E1 | `ink-900` #14182E | 13.24 | text (4.5) | pass | `packages/ui/DataTable.tsx:35`, `packages/ui/DataTable.tsx:38` |
| caption on night | both | `silver-400` #CED0D1 | `ink-950` #00041C | 13.12 | text (4.5) | pass | `packages/ui/DataTable.tsx:47`, `packages/ui/charts/StatCard.tsx:57`, `packages/ui/nav/SiteFooter.tsx:73` |
| pager text on ink-900 | both | `silver-400` #CED0D1 | `ink-900` #14182E | 11.31 | text (4.5) | pass | `packages/ui/DataTable.tsx:51` |
| axis tick on night | both | `silver-500` #BEC0C2 | `ink-950` #00041C | 11.13 | text (4.5) | pass | `packages/ui/charts/NeonBarChart.tsx:64`, `packages/ui/charts/NeonLineChart.tsx:78`, `packages/ui/nav/SiteFooter.tsx:81` |
| placeholder on field well | both | `silver-500` #BEC0C2 | `ink-950` #00041C | 11.13 | text (4.5) | pass | `packages/ui/cards/neon-field.ts:16` |
| orange tone text on night | both | `orange-400` #FD9D40 | `ink-950` #00041C | 9.74 | text (4.5) | pass | `packages/ui/district/tones.ts:117`, `packages/ui/nav/SiteFooter.tsx:86` |
| royal tone text on night | both | `royal-300` #80ACFC | `ink-950` #00041C | 8.92 | text (4.5) | pass | `packages/ui/district/tones.ts:125`, `packages/ui/nav/SiteFooter.tsx:87` |
| carolina tone text on night | both | `carolina-400` #78BEF4 | `ink-950` #00041C | 10.12 | text (4.5) | pass | `packages/ui/district/tones.ts:132`, `packages/ui/nav/SiteFooter.tsx:88` |
| leaf tone text on night | both | `leaf-400` #6FC26B | `ink-950` #00041C | 9.29 | text (4.5) | pass | `packages/ui/district/tones.ts:139`, `packages/ui/charts/StatCard.tsx:72` |
| apple tone text on night | both | `apple-400` #FA4040 | `ink-950` #00041C | 5.68 | text (4.5) | pass | `packages/ui/district/tones.ts:147`, `packages/ui/cards/neon-field.ts:18`, `packages/ui/Menu.web.tsx:63` |
| brick tone text on night | both | `orange-300` #FEBE80 | `ink-950` #00041C | 12.47 | text (4.5) | pass | `packages/ui/district/tones.ts:154` |
| sort glyph carolina-300 | both | `carolina-300` #A5D4F8 | `ink-900` #14182E | 11.15 | ui (3) | pass | `packages/ui/DataTable.tsx:59` |
| sort glyph leaf-300 | both | `leaf-300` #9FD79D | `ink-900` #14182E | 10.57 | ui (3) | pass | `packages/ui/DataTable.tsx:60` |
| sort glyph apple-300 | both | `apple-300` #FC8080 | `ink-900` #14182E | 7.12 | ui (3) | pass | `packages/ui/DataTable.tsx:62` |
| orange eyebrow on glass card | both | `orange-500` #FC7C00 | `ink-50 + ink-950/85` #25293D | 5.50 | text (4.5) | pass | `packages/ui/future/GridCard.tsx:29`, `packages/ui/future/CircuitButton.tsx:49`; measured over a light page, the worst case for the 85% night glass |
| carolina eyebrow on glass card | both | `carolina-500` #4BA8F0 | `ink-50 + ink-950/85` #25293D | 5.59 | text (4.5) | pass | `packages/ui/future/GridCard.tsx:30`, `packages/ui/future/CircuitButton.tsx:50`; measured over a light page, the worst case for the 85% night glass |
| night on orange face | both | `ink-950` #00041C | `orange-500` #FC7C00 | 7.76 | text (4.5) | pass | `packages/ui/district/tones.ts:117`, `packages/ui/dropdown.ts:19`, `packages/ui/nav/NavBar.tsx:69` |
| white on royal face | both | `white` #FFFFFF | `royal-500` #0058F8 | 5.60 | text (4.5) | pass | `packages/ui/district/tones.ts:125`, `packages/ui/dropdown.ts:25`, `packages/ui/DataTable.tsx:58`, `packages/app/features/schedule/accent-classes.ts:43` |
| banner white on royal face | both | `ink-50` #F8F8F8 | `royal-500` #0058F8 | 5.27 | text (4.5) | pass | `packages/ui/district/tones.ts:125`, `packages/ui/future/CircuitButton.tsx:48` |
| night on carolina face | both | `ink-950` #00041C | `carolina-500` #4BA8F0 | 7.89 | text (4.5) | pass | `packages/ui/district/tones.ts:132`, `packages/ui/future/CircuitButton.tsx:47` |
| night on leaf face | both | `ink-950` #00041C | `leaf-500` #3FAE3A | 7.09 | text (4.5) | pass | `packages/ui/district/tones.ts:139` |
| night on apple face | both | `ink-950` #00041C | `apple-500` #F80000 | 4.83 | text (4.5) | pass | `packages/ui/district/tones.ts:147`, `packages/ui/Badge.tsx:98` |
| white on apple face | both | `white` #FFFFFF | `apple-500` #F80000 | 4.21 | text (4.5) | **FAIL** | `packages/ui/dropdown.ts:29`, `packages/ui/nav/NavBar.tsx:83`; text-sm font-semibold active item; tones.ts:144 already rules white out on apple |
| white on brick face | both | `white` #FFFFFF | `orange-800` #884300 | 7.37 | text (4.5) | pass | `packages/ui/district/tones.ts:154`, `packages/ui/dropdown.ts:30` |
| banner white on brick face | both | `ink-50` #F8F8F8 | `orange-800` #884300 | 6.94 | text (4.5) | pass | `packages/ui/district/tones.ts:154` |
| night on white face | both | `ink-950` #00041C | `ink-50` #F8F8F8 | 19.12 | text (4.5) | pass | `packages/ui/district/tones.ts:161`, `packages/ui/Badge.tsx:98` |
| selected event: white on gold-700 | both | `white` #FFFFFF | `gold-700` #A35100 | 5.62 | text (4.5) | pass | `packages/app/features/schedule/accent-classes.ts:50`, `packages/app/features/schedule/accent-classes.ts:51` |
| selected event: white on forest-700 | both | `white` #FFFFFF | `forest-700` #2C7A29 | 5.35 | text (4.5) | pass | `packages/app/features/schedule/accent-classes.ts:58`, `packages/app/features/schedule/accent-classes.ts:59` |
| selected event: white on sky-700 | both | `white` #FFFFFF | `sky-700` #3577B0 | 4.75 | text (4.5) | pass | `packages/app/features/schedule/accent-classes.ts:66`, `packages/app/features/schedule/accent-classes.ts:67` |
| selected event: white on rose-700 | both | `white` #FFFFFF | `rose-700` #AE0000 | 7.50 | text (4.5) | pass | `packages/app/features/schedule/accent-classes.ts:74`, `packages/app/features/schedule/accent-classes.ts:75` |
| orange field edge | both | `orange-500` #FC7C00 | `ink-950` #00041C | 7.76 | ui (3) | pass | `packages/ui/district/tones.ts:118`, `packages/ui/cards/neon-field.ts:34` |
| royal field edge | both | `royal-500` #0058F8 | `ink-950` #00041C | 3.63 | ui (3) | pass | `packages/ui/district/tones.ts:126`, `packages/ui/cards/neon-field.ts:34` |
| carolina field edge | both | `carolina-500` #4BA8F0 | `ink-950` #00041C | 7.89 | ui (3) | pass | `packages/ui/district/tones.ts:133`, `packages/ui/cards/neon-field.ts:34` |
| leaf field edge | both | `leaf-500` #3FAE3A | `ink-950` #00041C | 7.09 | ui (3) | pass | `packages/ui/district/tones.ts:140`, `packages/ui/cards/neon-field.ts:34` |
| apple field edge | both | `apple-500` #F80000 | `ink-950` #00041C | 4.83 | ui (3) | pass | `packages/ui/district/tones.ts:148`, `packages/ui/cards/neon-field.ts:34` |
| brick field edge | both | `orange-700` #A35100 | `ink-950` #00041C | 3.61 | ui (3) | pass | `packages/ui/district/tones.ts:155`, `packages/ui/control-look.ts:54` |
| switch off: track edge | both | `silver-600` #A3A6AB | `ink-950` #00041C | 8.32 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:26` |
| switch off: thumb on track | both | `silver-400` #CED0D1 | `ink-900` #14182E | 11.31 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:26` |
| switch on: thumb keyline on orange-500 | both | `ink-950` #00041C | `orange-500` #FC7C00 | 7.76 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| switch on: thumb keyline on carolina-500 | both | `ink-950` #00041C | `carolina-500` #4BA8F0 | 7.89 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| switch on: thumb keyline on leaf-500 | both | `ink-950` #00041C | `leaf-500` #3FAE3A | 7.09 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| switch on: thumb keyline on apple-500 | both | `ink-950` #00041C | `apple-500` #F80000 | 4.83 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| switch on: thumb fill on royal-500 | both | `ink-50` #F8F8F8 | `royal-500` #0058F8 | 5.27 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| switch on: thumb fill on orange-800 | both | `ink-50` #F8F8F8 | `orange-800` #884300 | 6.94 | ui (3) | pass | `packages/ui/cards/NeonSwitch.tsx:25`, `packages/ui/cards/NeonSwitch.tsx:31` |
| checkbox off: box edge | both | `silver-500` #BEC0C2 | `ink-950` #00041C | 11.13 | ui (3) | pass | `packages/ui/cards/NeonCheckbox.tsx:24` |
| slider thumb on track | both | `ink-50` #F8F8F8 | `ink-950` #00041C | 19.12 | ui (3) | pass | `packages/ui/Slider.web.tsx:24`, `packages/ui/Slider.web.tsx:30` |
| chart series: orange | both | `orange-500` #FC7C00 | `ink-950` #00041C | 7.76 | ui (3) | pass | `packages/ui/district/series.ts:21`, `packages/ui/charts/NeonLineChart.tsx:128` |
| chart series: royal | both | `royal-500` #0058F8 | `ink-950` #00041C | 3.63 | ui (3) | pass | `packages/ui/district/series.ts:20`, `packages/ui/charts/NeonLineChart.tsx:128` |
| chart series: carolina | both | `carolina-500` #4BA8F0 | `ink-950` #00041C | 7.89 | ui (3) | pass | `packages/ui/district/series.ts:20`, `packages/ui/charts/NeonLineChart.tsx:128` |
| chart series: leaf | both | `leaf-500` #3FAE3A | `ink-950` #00041C | 7.09 | ui (3) | pass | `packages/ui/district/series.ts:21`, `packages/ui/charts/NeonLineChart.tsx:128` |
| chart series: apple | both | `apple-500` #F80000 | `ink-950` #00041C | 4.83 | ui (3) | pass | `packages/ui/district/series.ts:21`, `packages/ui/charts/NeonLineChart.tsx:128` |
| chart series: brick | both | `orange-700` #A35100 | `ink-950` #00041C | 3.61 | ui (3) | pass | `packages/ui/district/series.ts:10`, `packages/ui/district/series.ts:22` |
| chart keyline: royal under orange | both | `royal-500` #0058F8 | `orange-500` #FC7C00 | 2.14 | decorative (0) | exempt | `packages/ui/district/series.ts:75`, `packages/ui/charts/NeonLineChart.tsx:129`; the wordmark keyline under a stroke; the stroke against night carries the data |
| night facade border | both | `ink-800` #25293D | `ink-950` #00041C | 1.41 | decorative (0) | exempt | `packages/ui/DataTable.tsx:30`, `packages/ui/SegmentedControl.web.tsx:13`, `packages/ui/charts/StoryPanel.tsx:8`; container keylines; the selected segment face and cell text identify content |
| night control keyline | both | `ink-700` #3C3F51 | `ink-950` #00041C | 1.96 | decorative (0) | exempt | `packages/ui/nav/NavBar.tsx:71`, `packages/ui/DataTable.tsx:52`, `packages/ui/cards/neon-field.ts:22`; frame around a control whose glyph or label (white / silver-100 / silver-300) identifies it |
| outline knock-out | light | `surface` #F8F8F8 | `surface` #F8F8F8 | 1.00 | decorative (0) | exempt | `packages/ui/text-effects/OutlineText.tsx:63`; fills the glyph face with the surface; the outline stroke carries the text |
| outline knock-out | dark | `surface` #00041C | `surface` #00041C | 1.00 | decorative (0) | exempt | `packages/ui/text-effects/OutlineText.tsx:63`; fills the glyph face with the surface; the outline stroke carries the text |
| disabled label | both | `ink-400` #90929C | `ink-950` #00041C | 6.55 | disabled (0) | exempt | `packages/ui/Button.tsx:48`, `packages/ui/IconButton.tsx:77`, `packages/ui/neon/NeonChevron.tsx:55`, `packages/ui/audio/PlayerShell.tsx:123`; inactive control |
| disabled slider icon | both | `ink-700` #3C3F51 | `ink-950` #00041C | 1.96 | disabled (0) | exempt | `packages/ui/cards/CardSlider.shared.tsx:158`; inactive control |

### Token contract

| Pair | Mode | Foreground | Background | Ratio | Role (min) | Result | Where used |
|---|---|---|---|---:|---|---|---|
| contract:text/bg | light | `text` #00041C | `bg` #F8F8F8 | 19.12 | text (4.5) | pass | token contract |
| contract:text/bg | dark | `text` #F8F8F8 | `bg` #00041C | 19.12 | text (4.5) | pass | token contract |
| contract:text/surface | light | `text` #00041C | `surface` #F8F8F8 | 19.12 | text (4.5) | pass | token contract |
| contract:text/surface | dark | `text` #F8F8F8 | `surface` #00041C | 19.12 | text (4.5) | pass | token contract |
| contract:text/surface-raised | light | `text` #00041C | `surface-raised` #FFFFFF | 20.31 | text (4.5) | pass | token contract |
| contract:text/surface-raised | dark | `text` #F8F8F8 | `surface-raised` #0A1230 | 17.31 | text (4.5) | pass | token contract |
| contract:text/surface-sunken | light | `text` #00041C | `surface-sunken` #ECECED | 17.20 | text (4.5) | pass | token contract |
| contract:text/surface-sunken | dark | `text` #F8F8F8 | `surface-sunken` #000212 | 19.44 | text (4.5) | pass | token contract |
| contract:text-muted/bg | light | `text-muted` #545767 | `bg` #F8F8F8 | 6.73 | text (4.5) | pass | token contract |
| contract:text-muted/bg | dark | `text-muted` #BEC0C2 | `bg` #00041C | 11.13 | text (4.5) | pass | token contract |
| contract:text-muted/surface | light | `text-muted` #545767 | `surface` #F8F8F8 | 6.73 | text (4.5) | pass | token contract |
| contract:text-muted/surface | dark | `text-muted` #BEC0C2 | `surface` #00041C | 11.13 | text (4.5) | pass | token contract |
| contract:text-muted/surface-raised | light | `text-muted` #545767 | `surface-raised` #FFFFFF | 7.15 | text (4.5) | pass | token contract |
| contract:text-muted/surface-raised | dark | `text-muted` #BEC0C2 | `surface-raised` #0A1230 | 10.08 | text (4.5) | pass | token contract |
| contract:text-muted/surface-sunken | light | `text-muted` #545767 | `surface-sunken` #ECECED | 6.06 | text (4.5) | pass | token contract |
| contract:text-muted/surface-sunken | dark | `text-muted` #BEC0C2 | `surface-sunken` #000212 | 11.31 | text (4.5) | pass | token contract |
| contract:primary/bg | light | `primary` #A35100 | `bg` #F8F8F8 | 5.30 | text (4.5) | pass | token contract |
| contract:primary/bg | dark | `primary` #FC7C00 | `bg` #00041C | 7.76 | text (4.5) | pass | token contract |
| contract:primary/surface | light | `primary` #A35100 | `surface` #F8F8F8 | 5.30 | text (4.5) | pass | token contract |
| contract:primary/surface | dark | `primary` #FC7C00 | `surface` #00041C | 7.76 | text (4.5) | pass | token contract |
| contract:primary/surface-raised | light | `primary` #A35100 | `surface-raised` #FFFFFF | 5.62 | text (4.5) | pass | token contract |
| contract:primary/surface-raised | dark | `primary` #FC7C00 | `surface-raised` #0A1230 | 7.02 | text (4.5) | pass | token contract |
| contract:primary/surface-sunken | light | `primary` #A35100 | `surface-sunken` #ECECED | 4.76 | text (4.5) | pass | token contract |
| contract:primary/surface-sunken | dark | `primary` #FC7C00 | `surface-sunken` #000212 | 7.88 | text (4.5) | pass | token contract |
| contract:accent/bg | light | `accent` #0058F8 | `bg` #F8F8F8 | 5.27 | text (4.5) | pass | token contract |
| contract:accent/bg | dark | `accent` #4BA8F0 | `bg` #00041C | 7.89 | text (4.5) | pass | token contract |
| contract:accent/surface | light | `accent` #0058F8 | `surface` #F8F8F8 | 5.27 | text (4.5) | pass | token contract |
| contract:accent/surface | dark | `accent` #4BA8F0 | `surface` #00041C | 7.89 | text (4.5) | pass | token contract |
| contract:accent/surface-raised | light | `accent` #0058F8 | `surface-raised` #FFFFFF | 5.60 | text (4.5) | pass | token contract |
| contract:accent/surface-raised | dark | `accent` #4BA8F0 | `surface-raised` #0A1230 | 7.14 | text (4.5) | pass | token contract |
| contract:accent/surface-sunken | light | `accent` #0058F8 | `surface-sunken` #ECECED | 4.74 | text (4.5) | pass | token contract |
| contract:accent/surface-sunken | dark | `accent` #4BA8F0 | `surface-sunken` #000212 | 8.02 | text (4.5) | pass | token contract |
| contract:success/bg | light | `success` #2C7A29 | `bg` #F8F8F8 | 5.04 | text (4.5) | pass | token contract |
| contract:success/bg | dark | `success` #3FAE3A | `bg` #00041C | 7.09 | text (4.5) | pass | token contract |
| contract:success/surface | light | `success` #2C7A29 | `surface` #F8F8F8 | 5.04 | text (4.5) | pass | token contract |
| contract:success/surface | dark | `success` #3FAE3A | `surface` #00041C | 7.09 | text (4.5) | pass | token contract |
| contract:success/surface-raised | light | `success` #2C7A29 | `surface-raised` #FFFFFF | 5.35 | text (4.5) | pass | token contract |
| contract:success/surface-raised | dark | `success` #3FAE3A | `surface-raised` #0A1230 | 6.42 | text (4.5) | pass | token contract |
| contract:success/surface-sunken | light | `success` #2C7A29 | `surface-sunken` #ECECED | 4.53 | text (4.5) | pass | token contract |
| contract:success/surface-sunken | dark | `success` #3FAE3A | `surface-sunken` #000212 | 7.20 | text (4.5) | pass | token contract |
| contract:danger/bg | light | `danger` #D50000 | `bg` #F8F8F8 | 5.16 | text (4.5) | pass | token contract |
| contract:danger/bg | dark | `danger` #FA4040 | `bg` #00041C | 5.68 | text (4.5) | pass | token contract |
| contract:danger/surface | light | `danger` #D50000 | `surface` #F8F8F8 | 5.16 | text (4.5) | pass | token contract |
| contract:danger/surface | dark | `danger` #FA4040 | `surface` #00041C | 5.68 | text (4.5) | pass | token contract |
| contract:danger/surface-raised | light | `danger` #D50000 | `surface-raised` #FFFFFF | 5.48 | text (4.5) | pass | token contract |
| contract:danger/surface-raised | dark | `danger` #FA4040 | `surface-raised` #0A1230 | 5.14 | text (4.5) | pass | token contract |
| contract:danger/surface-sunken | light | `danger` #D50000 | `surface-sunken` #ECECED | 4.65 | text (4.5) | pass | token contract |
| contract:danger/surface-sunken | dark | `danger` #FA4040 | `surface-sunken` #000212 | 5.77 | text (4.5) | pass | token contract |
| contract:info/bg | light | `info` #295D8E | `bg` #F8F8F8 | 6.48 | text (4.5) | pass | token contract |
| contract:info/bg | dark | `info` #4BA8F0 | `bg` #00041C | 7.89 | text (4.5) | pass | token contract |
| contract:info/surface | light | `info` #295D8E | `surface` #F8F8F8 | 6.48 | text (4.5) | pass | token contract |
| contract:info/surface | dark | `info` #4BA8F0 | `surface` #00041C | 7.89 | text (4.5) | pass | token contract |
| contract:info/surface-raised | light | `info` #295D8E | `surface-raised` #FFFFFF | 6.88 | text (4.5) | pass | token contract |
| contract:info/surface-raised | dark | `info` #4BA8F0 | `surface-raised` #0A1230 | 7.14 | text (4.5) | pass | token contract |
| contract:info/surface-sunken | light | `info` #295D8E | `surface-sunken` #ECECED | 5.83 | text (4.5) | pass | token contract |
| contract:info/surface-sunken | dark | `info` #4BA8F0 | `surface-sunken` #000212 | 8.02 | text (4.5) | pass | token contract |
| contract:on-primary/primary | light | `on-primary` #FFFFFF | `primary` #A35100 | 5.62 | text (4.5) | pass | token contract |
| contract:on-primary/primary | dark | `on-primary` #00041C | `primary` #FC7C00 | 7.76 | text (4.5) | pass | token contract |
| contract:on-primary/primary-pressed | light | `on-primary` #FFFFFF | `primary-pressed` #884300 | 7.37 | text (4.5) | pass | token contract |
| contract:on-primary/primary-pressed | dark | `on-primary` #00041C | `primary-pressed` #FD9D40 | 9.74 | text (4.5) | pass | token contract |
| contract:on-accent/accent | light | `on-accent` #FFFFFF | `accent` #0058F8 | 5.60 | text (4.5) | pass | token contract |
| contract:on-accent/accent | dark | `on-accent` #00041C | `accent` #4BA8F0 | 7.89 | text (4.5) | pass | token contract |
| contract:on-accent/accent-pressed | light | `on-accent` #FFFFFF | `accent-pressed` #004CD9 | 6.92 | text (4.5) | pass | token contract |
| contract:on-accent/accent-pressed | dark | `on-accent` #00041C | `accent-pressed` #78BEF4 | 10.12 | text (4.5) | pass | token contract |
| contract:on-success/success | light | `on-success` #FFFFFF | `success` #2C7A29 | 5.35 | text (4.5) | pass | token contract |
| contract:on-success/success | dark | `on-success` #00041C | `success` #3FAE3A | 7.09 | text (4.5) | pass | token contract |
| contract:on-danger/danger | light | `on-danger` #FFFFFF | `danger` #D50000 | 5.48 | text (4.5) | pass | token contract |
| contract:on-danger/danger | dark | `on-danger` #00041C | `danger` #FA4040 | 5.68 | text (4.5) | pass | token contract |
| contract:on-info/info | light | `on-info` #FFFFFF | `info` #295D8E | 6.88 | text (4.5) | pass | token contract |
| contract:on-info/info | dark | `on-info` #00041C | `info` #4BA8F0 | 7.89 | text (4.5) | pass | token contract |
| contract:text-inverse/text | light | `text-inverse` #F8F8F8 | `text` #00041C | 19.12 | text (4.5) | pass | token contract |
| contract:text-inverse/text | dark | `text-inverse` #00041C | `text` #F8F8F8 | 19.12 | text (4.5) | pass | token contract |
| contract:focus/bg | light | `focus` #0058F8 | `bg` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:focus/bg | dark | `focus` #4BA8F0 | `bg` #00041C | 7.89 | ui (3) | pass | token contract |
| contract:focus/surface | light | `focus` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:focus/surface | dark | `focus` #4BA8F0 | `surface` #00041C | 7.89 | ui (3) | pass | token contract |
| contract:focus/surface-raised | light | `focus` #0058F8 | `surface-raised` #FFFFFF | 5.60 | ui (3) | pass | token contract |
| contract:focus/surface-raised | dark | `focus` #4BA8F0 | `surface-raised` #0A1230 | 7.14 | ui (3) | pass | token contract |
| contract:focus/surface-sunken | light | `focus` #0058F8 | `surface-sunken` #ECECED | 4.74 | ui (3) | pass | token contract |
| contract:focus/surface-sunken | dark | `focus` #4BA8F0 | `surface-sunken` #000212 | 8.02 | ui (3) | pass | token contract |
| contract:border-strong/bg | light | `border-strong` #0058F8 | `bg` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:border-strong/bg | dark | `border-strong` #4082FA | `bg` #00041C | 5.60 | ui (3) | pass | token contract |
| contract:border-strong/surface | light | `border-strong` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:border-strong/surface | dark | `border-strong` #4082FA | `surface` #00041C | 5.60 | ui (3) | pass | token contract |
| contract:border-strong/surface-raised | light | `border-strong` #0058F8 | `surface-raised` #FFFFFF | 5.60 | ui (3) | pass | token contract |
| contract:border-strong/surface-raised | dark | `border-strong` #4082FA | `surface-raised` #0A1230 | 5.07 | ui (3) | pass | token contract |
| contract:border-strong/surface-sunken | light | `border-strong` #0058F8 | `surface-sunken` #ECECED | 4.74 | ui (3) | pass | token contract |
| contract:border-strong/surface-sunken | dark | `border-strong` #4082FA | `surface-sunken` #000212 | 5.69 | ui (3) | pass | token contract |
| contract:structure/bg | light | `structure` #0058F8 | `bg` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:structure/bg | dark | `structure` #0058F8 | `bg` #00041C | 3.63 | ui (3) | pass | token contract |
| contract:structure/surface | light | `structure` #0058F8 | `surface` #F8F8F8 | 5.27 | ui (3) | pass | token contract |
| contract:structure/surface | dark | `structure` #0058F8 | `surface` #00041C | 3.63 | ui (3) | pass | token contract |
| contract:structure/surface-raised | light | `structure` #0058F8 | `surface-raised` #FFFFFF | 5.60 | ui (3) | pass | token contract |
| contract:structure/surface-raised | dark | `structure` #0058F8 | `surface-raised` #0A1230 | 3.28 | ui (3) | pass | token contract |
| contract:structure/surface-sunken | light | `structure` #0058F8 | `surface-sunken` #ECECED | 4.74 | ui (3) | pass | token contract |
| contract:structure/surface-sunken | dark | `structure` #0058F8 | `surface-sunken` #000212 | 3.69 | ui (3) | pass | token contract |

### Forbidden

| Rule | Pair | Ratio | Needs | Rule text |
|---|---|---:|---:|---|
| orange on royal | `orange-500` #FC7C00 on `royal-500` #0058F8 | 2.14 | 3 | Orange is an accent on night and neutrals; never orange text or marks on royal. |
| white on orange | `white` #FFFFFF on `orange-500` #FC7C00 | 2.62 | 4.5 | No white-on-orange labels. Orange faces take night text (on-primary in dark). |
| banner white on orange | `ink-50` #F8F8F8 on `orange-500` #FC7C00 | 2.46 | 4.5 | Same rule for the banner white. |
| white on apple | `white` #FFFFFF on `apple-500` #F80000 | 4.21 | 4.5 | Apple faces take night text below 18.66px bold. |
| orange on light | `orange-500` #FC7C00 on `ink-50` #F8F8F8 | 2.46 | 3 | Brand orange is not text, icon or chart ink on a light surface; use primary (orange-700) there. |
| carolina on light | `carolina-500` #4BA8F0 on `ink-50` #F8F8F8 | 2.42 | 3 | Carolina is a night colour; on light use info (carolina-800). |
| leaf on light | `leaf-500` #3FAE3A on `ink-50` #F8F8F8 | 2.70 | 3 | Leaf on light fails even 3:1; use success (leaf-700). |
| apple on light (text) | `apple-500` #F80000 on `ink-50` #F8F8F8 | 3.96 | 4.5 | Apple on light holds 3:1 for marks only; text uses danger (apple-600). |
| royal on night (text) | `royal-500` #0058F8 on `ink-950` #00041C | 3.63 | 4.5 | Royal reads as structure on night, never as text; royal text uses royal-300. |
| brick face on night | `orange-800` #884300 on `ink-950` #00041C | 2.76 | 3 | Brick (orange-800) is a face colour; its control edge on night is orange-700. |
