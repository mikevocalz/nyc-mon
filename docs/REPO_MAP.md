# NYC-MON repo map

Written 2026-10-04 for Milestone 0 of `prompts/BUILD_PROMPT_v3.md` (§1.1 says the repo wins where it differs from the expected shape; this file records the real paths). Every version below was read from the installed `node_modules/<pkg>/package.json`, resolved from the workspace that declares it, at commit `42c3273`. The single version source is the `catalog:` block in `pnpm-workspace.yaml`.

Package manager: pnpm 12.8.1. Node `>=24.15.0 <26`. Task runner: Turborepo 2.11.7 (`turbo.json`). Package scope: `@acme/*`.

## 1. Expected shape vs. the repo

| §1.1 expects | Repo has | Status |
|---|---|---|
| `apps/mobile` (Expo latest, New Arch, expo-router) | `apps/mobile` (Expo SDK 58.0.3, RN 0.88.0-rc.3, expo-router 58.0.13) | Present |
| `apps/web` (Next.js App Router, Vercel) | `apps/web` (Next 16.3.8, App Router, product and promo site only) | Present |
| — | `apps/admin-vite` (TanStack Start 1.168.60 on Vite 8, Payload admin at `/admin`, Payload REST and Better Auth at `/payload-api`; ADR 0003) | Extra |
| — | `apps/storybook` (Storybook 10.6.1 on Vite, react-native-web) | Extra |
| `packages/ui` | `packages/ui` (`@acme/ui`, the NYC-Tron kit) | Present |
| `packages/ui/html` | `packages/ui/html` (`@acme/ui/html`; `@acme/ui/primitives` re-exports it) | Present |
| `packages/theme` | `packages/theme` (`@acme/theme`) | Present |
| `packages/core` | none at `42c3273` | **Missing** (another agent is creating it now) |
| `packages/content` | none | **Missing** |
| `packages/render` | none; three.js/WebGPU code lives in `packages/ui/three` and `packages/ui/gpu` | **Missing** |
| `packages/auth` | none; the only auth is Payload's `users` collection | **Missing** |
| — | `packages/app` (`@acme/app`, Solito feature screens from the starter) | Extra |
| — | `packages/assets` (`@acme/assets`, brand PNGs, fonts, city photos) | Extra |
| — | `packages/config` (`@acme/config`, eslint/prettier/tsconfig) | Extra |
| — | `packages/payload` (`@acme/payload`, Payload CMS config + REST reader) | Extra |
| — | `packages/spatial` (`@acme/spatial`, Viro/Rive XR scenes, site copy) | Extra |
| `prompts/` ROSTER, LAWS | `prompts/BUILD_PROMPT_v3.md`, `ROSTER.md`, `LAWS.md` (this milestone) | Present |
| `docs/canon/`, `design/`, `adr/`, `DESIGN_SYSTEM.md`, `COPY_DECK.md` | `docs/canon/source/` (3 files), `docs/canon/DECISIONS.md` and `docs/adr/0001-*` (this milestone); no `design/`, `DESIGN_SYSTEM.md`, `COPY_DECK.md` | Partial |

Other docs already in the repo: `docs/SPATIAL.md`, `docs/XR-PLATFORM-MATRIX.md`, `docs/toolchain-notes.md`, `docs/rn-087-upgrade-brief.md`. Tooling scripts: `tooling/copy-viro-web-assets.mjs`, `tooling/copy-skia-web-assets.mjs` (both run on `postinstall`), `tooling/verify-spatial-android.mjs`, `tooling/verify-typegpu-toolchain.mjs`, `tooling/generators/gen.mjs`.

## 2. Canon on disk

`docs/canon/source/` holds three files, committed in `42c3273`:

| File | What it is |
|---|---|
| `docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx` | The v11 narrative Bible. Its title page reads "VERSION 11 / 4 OCTOBER 2026". |
| `docs/canon/source/NYC_MON_CURRENT_CANON_INDEX_v11.md` | Authority order and the list of v11 companion files. |
| `docs/canon/source/nyc-mon-3d-character-architecture.md` | Species-agnostic MonDNA / MonRigDefinition architecture note (no version header). |

The commit message calls these "the v7 canon sources", but the docx and the index both identify as v11. Two things are still off from what the build prompt expects:

- The prompt cites the Bible at `docs/canon/NYC_MON_Canon_and_Lore_Bible_v11.docx`. It is at `docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`.
- The index lists seven v11 companion files that are **not in the repo**: `NYC_Mon_Master_Bible_v11.md` (holds the v8 109-record Dex the starters must be transcribed from), `NYC_Mon_Gameplay_Lifecycle_and_Care_Bible_v11.md`, `NYC_Mon_Voice_Identity_and_Dialogue_Bible_v11.md`, `NYC_MON_HLynk_Capture_and_Handoff_Bible_v11.md`, `NYC_Mon_Animation_and_Performance_Bible_v9.md`, `NYC_Mon_3D_Character_Architecture_v5.md`, `NYC_Mon_Street_Circuit_Card_Game_Bible_v1.md`.

## 3. Apps

### `apps/mobile`

- Expo SDK **58.0.3**, React Native **0.88.0-rc.3**, React **19.3.0**. New Architecture is the only mode on SDK 58; `app.config.ts` also sets `newArchEnabled: true`.
- Config: `apps/mobile/app.config.ts` — name `NYC-MON`, slug `nyc-mon`, scheme `nycmon`, iOS `com.nycmon.app`, Android `com.nycmon.app` (minSdk 29), `experiments.typedRoutes: true`, `experiments.reactCompiler: true`. Plugins include `expo-router`, `expo-build-properties`, `expo-splash-screen`, `expo-font`, `expo-image`, `expo-horizon-core`.
- Router: **expo-router 58.0.13**, file routes under `apps/mobile/app/`:
  - `_layout.tsx`, `+not-found.tsx`
  - `(drawer)/_layout.tsx`, `(drawer)/settings.tsx`, `(drawer)/spatial.tsx`, `(drawer)/editor-settings/index.tsx`, `(drawer)/split/_layout.tsx`, `(drawer)/split/index.tsx`
  - `(drawer)/(tabs)/_layout.tsx`, `index.tsx`, `explore.tsx`, `notifications.tsx`, `profile.tsx`
- None of the §4 routes (`(onboarding)`, `(auth)`, `(home)`, `(settings)`, `(system)`) exist. The current routes are the Solito starter's demo screens.
- App-local chrome: `apps/mobile/components/AppHeader.tsx`, `AppTabBar.tsx`, `DrawerContent.tsx`, `BookingSheet.tsx`, `EventActionsSheet.tsx`; `apps/mobile/src/navigation/` (split view), `apps/mobile/src/xr/`.
- Metro: `apps/mobile/metro.config.js`. Native projects are checked in (`apps/mobile/android/`).

### `apps/web`

- **Next.js 16.3.8**, App Router, React Compiler (`babel-plugin-react-compiler` 1.0.0). Styling on web goes through `react-native-css` 3.0.7 because Uniwind does not support Next.js (see the comment in `packages/ui/tw.tsx`).
- Routes under `apps/web/app/`:
  - `(site)/layout.tsx`, `page.tsx`, `explore/`, `notifications/`, `profile/`, `schedule/`, `settings/`, `spatial/`, `error.tsx`, `not-found.tsx` — starter demo pages, none of W01–W07.
  - No Payload routes. The admin, REST and Better Auth moved to `apps/admin-vite` on 2026-10-04 (`docs/adr/0003-admin-app-split.md`); `apps/web` holds no database or auth secrets.
- Site header and footer: `apps/web/components/site/SiteHeader.tsx` and `apps/web/components/site/SiteFooter.tsx`, built from `@acme/ui/tw` (`Header`, `Nav`, `Footer`, `View`, `P`) plus `BrandWordmark` / `BrandLogo` from `@acme/ui`. They do **not** use the kit's own `NavBar` / `SiteFooter` (`packages/ui/nav/`), and they import `@acme/ui/tw` rather than `@acme/ui/html`. Nav items: `apps/web/components/site/nav.ts`.
- Lint guard: `apps/web/eslint.config.mjs` forbids raw semantic tags in `app/(site)/**` and `components/site/**` ("Use @acme/ui/html or an @acme/ui component") and forbids importing `@expo/ui` / `@expo/html-elements` directly. `components/site/Landing.tsx` is allow-listed for GSAP but does not exist.
### `apps/admin-vite`

- **TanStack Start** 1.168.60 + `@payloadcms/tanstack-start` 4.0.0-canary.37 on Vite 8.3.2, `@vitejs/plugin-rsc` 0.5.35, Nitro 3.0.260903-beta with the `vercel` preset (Build Output API v3 in `.vercel/output`). Dev port 5174, `strictPort`. `pnpm --filter admin-vite dev` loads the root `.env` then `.env.local` through `node --env-file-if-exists`, which never overrides variables already set in the shell.
- Routes under `apps/admin-vite/src/routes/`: `index.tsx` (307 to `/admin`), `_payload.tsx` (pathless layout, `no-store` + `noindex`), `_payload/admin.index.tsx` and `_payload/admin.$.tsx` (admin views), `_payload/payload-api.$.ts` (Payload REST through `handleEndpoints`, including Better Auth at `/payload-api/auth/*`). No GraphQL.
- Consumes `packages/payload/src/payload.config.ts` unchanged; the generated import map is `src/routes/_payload/importMap.js` (`pnpm --filter admin-vite payload:importmap`).

- `eslint-plugin-jsx-a11y` 6.10.2 is in the pnpm store only as a transitive dependency; no workspace declares it and no config enables its strict preset (§0A.2 requires that).

### `apps/storybook`

- Storybook **10.6.1** (`@storybook/react-vite`), Vite 8, `vite-plugin-react-native-web`, `@storybook/addon-a11y`, `@storybook/addon-vitest` with Vitest **5.0.3** + Playwright browser runner. Stories live next to components in `packages/ui`. Run: `pnpm --filter storybook dev` (port 6006).

## 4. Packages

| Package | Name | What it holds |
|---|---|---|
| `packages/ui` | `@acme/ui` | The NYC-Tron UI kit (section 5). Entry points: `.`, `./tw`, `./primitives`, `./html`, `./gpu`, `./three`, `./neon`, `./elements`, `./progress`, `./haptics`, `./icons`, `./native`. Also holds the WebGPU/three.js canvases (`three/`, `gpu/`) and one Expo native module (`modules/nyc-carousel`). |
| `packages/theme` | `@acme/theme` | Tokens. `tokens.ts` is the only file with hexes; `build-css.mjs` generates `theme.css` (Tailwind v4 `@theme` with `light-dark()`) and `theme-native.css` (Uniwind). `contrast.mjs` is a WCAG ratio script (section 6). |
| `packages/assets` | `@acme/assets` | `brand/` logo PNGs, `fonts/ArchivoBlack-Regular.ttf`, `fonts/SpaceGrotesk-Variable.ttf`, `photos/*.webp` (ten NYC photos keyed by district: downtown, midtown, harlem, megacity). |
| `packages/app` | `@acme/app` | Solito feature screens from the starter: `features/{editor,error,explore,home,notifications,profile,schedule,settings}`, `providers/` (React Query, safe area). Zustand stores per feature; MMKV in `features/editor/preferences.store.native.ts`. Nothing NYC-MON-specific. |
| `packages/payload` | `@acme/payload` | Payload CMS 4.0.0-canary.37 config (`src/payload.config.ts`), collections `Users` (auth) and `Media`, Better Auth options (`src/auth/`), generated `src/payload-types.ts`, and a typed REST reader in `index.ts`. Hosted by `apps/admin-vite`. |
| `packages/spatial` | `@acme/spatial` | Viro (fork `@reactvision/react-viro` 3.0.2-moyo.1) and Rive XR scenes, district scene, spatial audio, and the site copy constants (`homeCopy.ts`, exported as `@acme/spatial/copy`). Out of Phase 1 scope except that `apps/web` reads its copy. |
| `packages/config` | `@acme/config` | `eslint/base.mjs`, `eslint/boundaries.mjs` (keeps platform UI behind `@acme/ui`), `prettier/index.json`, `typescript/{base,nextjs,react-library}.json`, `jest-rsc-preset.js`. |

## 5. NYC-Tron UI kit (`@acme/ui`, `packages/ui`)

The kit's name is **NYC-Tron** (`packages/ui/README.md`). It ports all 41 NeonBlade UI components (https://neonbladeui.neuronrush.com/ · https://github.com/vprix21/neonblade-ui) for React Native and web; `packages/ui/neonblade/catalog.ts` maps each NeonBlade component to its NYC-Tron name and story, and `packages/ui/THIRD-PARTY-NOTICES.md` carries the MIT notice. Styling is Tailwind 4.3.3 through Uniwind 1.12.1 on native and `react-native-css` 3.0.7 on web, with variants built on `tailwind-variants` 3.3.1.

Every design handoff (`08-handoff.md`) maps to this inventory. If a screen needs something not listed here, the kit gets a new component or variant, with a story, before the screen uses it (LAWS.md, repo law R3).

### 5.1 Semantic HTML primitives — `packages/ui/html/index.tsx` (`@acme/ui/html`)

`packages/ui/html` exists. It wraps `@expo/html-elements` 58.0.3: real HTML elements on web, React Native views with accessibility roles on native. Platform forks: `html/css.{web,native}.tsx` (the styling shim), `html/dom.{web,native}.tsx` (real `<button>`, `<input>`, `<label>`, `<form>`, `<fieldset>`, `<select>`, `<details>` on web), `html/native-input.native.tsx`. Story: `primitives/primitives.stories.tsx` (Primitives: Landmarks, ContentAndLists, FormControls, DataTable).

| Group | Exports |
|---|---|
| Layout / landmarks | `Page` (div), `Main`, `Header`, `Footer`, `Nav`, `Section`, `Article`, `Aside`, `Figure` (div with `role="figure"`), `Figcaption`, `Address`, `Details`, `Summary` |
| Content | `Heading` (`level` 1–6), `Paragraph`, `Text` (span), `Time` |
| Lists | `List` (ul), `ListItem` |
| Forms / interactive | `Button`, `Link` (external/document anchors; in-app links use `solito/link`), `Form`, `Fieldset`, `Legend`, `Label`, `Input`, `Textarea`, `Select` |
| Table | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHeaderCell` |

Gaps against §0A.2: `Figure` renders a `div` with a role, not a native `<figure>`; there is no `ol`, `dl`, `blockquote`, `img`/`picture`, or `<section aria-labelledby>` helper.

`@acme/ui/tw` (`packages/ui/tw.tsx`) is a second, smaller wrapper set over the same elements: `View`, `Text`, `Pressable`, `TextInput`, `ScrollView`, `Main`, `Section`, `Article`, `Nav`, `Header`, `Footer`, `H1`, `H2`, `H3`, `P`. Web currently builds its header and footer from this set, not from `@acme/ui/html`. Mobile imports `Header`, `Aside`, `Main`, `Section` from `@acme/ui/primitives` (`apps/mobile/components/AppHeader.tsx`, `apps/mobile/app/(drawer)/split/_layout.tsx`, `apps/mobile/src/navigation/split-view/index.android.tsx`).

### 5.2 Variant unions on the core controls

| Component | Prop | Values | Source |
|---|---|---|---|
| `Button` | `variant` | `cornerCut` · `neon` · `primary` · `accent` · `outline` · `ghost` · `danger` | `packages/ui/control-look.ts` (`ButtonVariant`) |
| `Button` | `size` | `sm` · `md` · `lg`; also `rounded`, `loading`, `disabled`, district `tone` | `packages/ui/Button.tsx` |
| `IconButton` | `variant` / `size` | `cornerCut` · `neon` · `primary` · `outline` · `ghost` / `sm` · `md` · `lg` | `packages/ui/control-look.ts`, `IconButton.tsx` |
| `Card` | `variant` / `size` | `default` · `notch` · `cornerCut` · `beam` / `sm` · `md` · `lg` · `xl` | `packages/ui/Card.tsx` |
| `Text` | `variant` / `tone` | `display` · `title` · `heading` · `body` · `caption` · `label` + text effects / `default` · `muted` · `accent` · `primary` · `inverse` · `danger` · `district` | `packages/ui/Text.tsx` |
| `Heading` | `size` / `tone` | `display-2xl` · `display-xl` · `display-lg` · `display-md` · `display-sm` · `title` / as Text minus `danger` | `packages/ui/Heading.tsx` |
| `Badge` | `variant` / `size` / `shape` | `default` · `neon` / `xs` · `sm` · `md` / `pill` · `rectangle` | `packages/ui/Badge.tsx` |
| `TextField`, `Textarea`, `Checkbox`, `DataTable`, `Dialog` | `variant` | `default` · `neon` (`Dialog` also `size` `xs`…`xl` · `full`) | each file |
| `ToastCard` / `notify` | `variant` | `info` · `success` · `warning` · `error` · `loading` | `packages/ui/ToastCard.tsx` |
| `LoadingSkeleton` | `variant` | `line` · `card` · `avatar` · `custom` | `packages/ui/LoadingSkeleton.tsx` |
| `ProgressBar` | `variant` / `size` | `solid` · `segmented` · `striped` · `pulse` / `xs` · `sm` · `md` · `lg` | `packages/ui/progress/ProgressBar.tsx` |
| `Timeline` | `variant` | `default` · `glow` · `minimal` · `stepped` | `packages/ui/elements/Timeline.tsx` |
| `SiteFooter` (kit) | `variant` | `minimal` · `columns` · `centered` · `mega` | `packages/ui/nav/SiteFooter.tsx` |
| `CircuitButton` | `variant` | `solid` · `outline` | `packages/ui/future/CircuitButton.tsx` |
| `BrandLogo` / `BrandWordmark` | `size` / `height` | numeric px only; no tint, crop or filter | `packages/ui/brand/*` |

Almost every component takes a `district` prop (`downtown` · `midtown` · `harlem` · `megacity`, from `packages/ui/district/districts.ts`) that picks its tone family.

### 5.3 Component inventory

Generated from the source tree at `42c3273` (`.stories.tsx`, tests, `.skia.tsx` internals and `.shared.tsx` shells omitted). "Platform forks" lists the `.native` / `.web` / `.android` siblings next to the file. A dash in the story column means the component has no story file of its own; several of those are covered by an aggregate story listed in 5.4.

| File (`packages/ui/…`) | Platform forks | Exports | Own story file (title: stories) |
|---|---|---|---|
| `Avatar.tsx` | native,web | Avatar, AVATAR_GRADIENTS | UI/Avatar (Default, Gradients, WithImage, UserList, Bracket, Rounded) |
| `Badge.tsx` | — | Badge | UI/Badge (Tones, Neon, Rounded) |
| `BottomSheet.tsx` | — | SheetSurface, BottomSheet | UI/BottomSheet (Open, Surface, SurfaceWithoutTitle, Districts) |
| `Button.tsx` | — | Button | UI/Button (Primary, Accent, Outline, Ghost, Danger, Disabled, Loading, Sizes, CornerCut, CornerCutDistricts, VariantShowcase, InLayout, Rounded) |
| `Card.tsx` | — | Card | UI/Card (Elevated, Flat, Raised, Districts, OnLightPage, Notch, CornerCut, Beam, Rounded) |
| `Checkbox.tsx` | web | Checkbox | UI/Checkbox (States, Neon) |
| `Collapsible.tsx` | native,web | Collapsible | UI/Collapsible (States, Districts) |
| `DataTable.tsx` | — | DataTable | UI/DataTable (Sortable, Neon) |
| `Dialog.tsx` | — | DialogCard, Dialog | UI/Dialog (Open, Surface, SurfaceWithoutActions, Neon, NeonDistricts, NeonModalOpen) |
| `DropZone.tsx` | native,web | DropZone | UI/DropZone (Basic, CustomContent, Districts) |
| `EmptyState.tsx` | — | EmptyState | UI/EmptyState (Basic, WithAction, Districts) |
| `ErrorMessage.tsx` | — | ErrorMessage | UI/ErrorMessage (Visible, CollapsesWhenEmpty) |
| `FieldGroup.tsx` | native,web | FieldGroup | UI/FieldGroup (SettingsForm, Districts) |
| `FormField.tsx` | — | FormField | UI/FormField (WrappingCustomControls, Districts) |
| `Heading.tsx` | — | Heading | UI/Heading (Sizes, Playground, Districts) |
| `IconButton.tsx` | — | IconButton | UI/IconButton (Variants, CornerCut, GhostNavBar) |
| `Image.tsx` | — | Image | UI/Image (Fill, Districts) |
| `Lightbox.tsx` | — | Lightbox | UI/Lightbox (Gallery, Open) |
| `List.tsx` | native,web | List, ListItem | UI/List (Roster, PlainRows, Districts) |
| `LoadingSkeleton.tsx` | — | LoadingSkeleton | UI/LoadingSkeleton (Variants, Districts) |
| `Menu.tsx` | native,web | Menu | Share (Default, WithTitle) |
| `Modal.tsx` | — | Modal | — |
| `NativeSlot.tsx` | native,web | NativeSlot | — |
| `NightScope.tsx` | — | NIGHT_SCHEME, NightScope | — |
| `SafeArea.tsx` | native,web | SafeArea | — |
| `SearchBar.tsx` | — | SearchBar | UI/SearchBar (Empty, WithQuery, Sized, Debounced, Districts) |
| `SegmentedControl.tsx` | native,web | SegmentedControl | UI/SegmentedControl (Selection, Districts) |
| `Select.tsx` | native,web | Select | UI/Select (States, Neon, Rounded) |
| `Slider.tsx` | native,web,android | Slider | UI/Slider (Default, States, Districts) |
| `Switch.tsx` | native,web | Switch | UI/Switch (States, Neon) |
| `TabBar.tsx` | — | TabBar | UI/TabBar (Default, EmphasizedCenter, SecondTabActive, Districts) |
| `TabBarAccessory.tsx` | — | TabBarAccessory | UI/TabBarAccessory (Default, Pressable, AccentTone, Districts) |
| `Text.tsx` | — | Text | UI/Text (Variants, Playground, Districts) |
| `TextField.tsx` | — | TextField | UI/TextField (States, WithPaste, Neon, Rounded) |
| `Textarea.tsx` | — | Textarea | UI/Textarea (States, WithPaste, Neon) |
| `Toast.tsx` | — | Toast | UI/Toast (Variants, Neon, LiveNeonToasts, LiveNeonModal) |
| `ToastCard.tsx` | — | ToastCard | — |
| `Toolbar.tsx` | — | Toolbar | UI/Toolbar (Default, WithLeadingAndActions, ActionsOnly, Districts) |
| `VirtualList.tsx` | native,web | VirtualList | UI/VirtualList (FiveThousandRows) |
| `audio/AudioPlayer.tsx` | native,web | AudioPlayer | UI/AudioPlayer (Default, WithLevels, Unreadable, Districts, RecorderOnWeb) |
| `audio/PlayerShell.tsx` | — | CutTile, PlayerShell | — |
| `audio/VoiceRecorder.tsx` | native,web | VoiceRecorder | — |
| `audio/Waveform.tsx` | — | Waveform | UI/Waveform (Default, Recording, Districts) |
| `backgrounds/CityBlocks.tsx` | native,web | CityBlocks | NYC Mon/City blocks (Playground, SkiaFallback, Districts) |
| `backgrounds/CityHeightfield.tsx` | — | CityHeightfield | Backgrounds/CityHeightfield (Playground, SkiaFallback, Districts) |
| `backgrounds/CityHeightfieldFlat.tsx` | — | CityHeightfieldFlat | — |
| `backgrounds/CitySkyline.tsx` | — | CitySkyline, GlyphCity | Backgrounds/CitySkyline (Playground, SkiaFallback, Districts) |
| `backgrounds/GlyphCity.tsx` | — | GlyphCity | — |
| `backgrounds/GridFloor.tsx` | — | GridFloor | Backgrounds/GridFloor (Playground, SkiaFallback, Districts) |
| `backgrounds/GridScene.tsx` | — | GridScene | Backgrounds/GridScene (Playground, SkiaFallback, Districts) |
| `backgrounds/QuadBackground.tsx` | native,web | QuadBackground | — |
| `backgrounds/RainWindow.tsx` | — | RainWindow | Backgrounds/RainWindow (Playground, SkiaFallback, Districts) |
| `backgrounds/RiverTide.tsx` | — | RiverTide | Backgrounds/RiverTide (Playground, SkiaFallback, Districts) |
| `backgrounds/SignRain.tsx` | — | SignRain | Backgrounds/SignRain (Playground, SkiaFallback, Districts) |
| `backgrounds/SkiaQuadCanvas.tsx` | — | SkiaQuadCanvas | — |
| `backgrounds/SkiaWebGate.tsx` | — | SkiaWebGate | — |
| `backgrounds/StreetPulse.tsx` | — | StreetPulse | Backgrounds/StreetPulse (Playground, SkiaFallback, Districts) |
| `backgrounds/SubwayLines.tsx` | — | SubwayLines | Backgrounds/SubwayLines (Playground, SkiaFallback, Districts) |
| `brand/BrandLogo.tsx` | — | BrandLogo | — |
| `brand/BrandWordmark.tsx` | — | BrandWordmark | — |
| `cards/BeamFrame.tsx` | native,web | BeamFrame | — |
| `cards/CardSlider.tsx` | native,web | CardSlider | Cards/Card slider (Playground, NeonBladeDemos, ProgressStyles) |
| `cards/CardSliderListTrack.tsx` | — | CardSliderListTrack | — |
| `cards/NeonCheckbox.tsx` | — | NeonCheckbox | — |
| `cards/NeonSwitch.tsx` | — | NeonSwitch | — |
| `cards/NotchFrame.tsx` | native,web | NotchFrame | — |
| `cards/slider-items/CardSliderImageItem.tsx` | — | CardSliderImageItem | — |
| `charts/BarCanvas.tsx` | native,web | BarCanvas | — |
| `charts/DonutCanvas.tsx` | native,web | DonutCanvas | — |
| `charts/LinePlot.tsx` | native,web | LinePlot | — |
| `charts/NeonBarChart.tsx` | — | NeonBarChart | Charts/Neon Bar Chart (Playground, Layouts, Districts) |
| `charts/NeonDonutChart.tsx` | — | NeonDonutChart | Charts/Neon Donut Chart (Playground, PresetColors, Districts) |
| `charts/NeonLineChart.tsx` | — | NeonLineChart | Charts/Neon Line Chart (Playground, DotsAndCurves, Districts) |
| `charts/NeonSparkline.tsx` | — | NeonSparkline | Charts/Neon Sparkline (Playground, Districts) |
| `charts/StatCard.tsx` | — | StatCard | Charts/Stat Card (Playground, Districts) |
| `charts/StoryPanel.tsx` | — | StoryPanel, StoryPage | — |
| `cursors/Crosshair.tsx` | native,web | Crosshair | — |
| `cursors/MouseCursor.tsx` | native,web | MouseCursor | — |
| `cursors/PointerCursor.tsx` | native,web | PointerCursor | — |
| `cursors/arrow.tsx` | native,web | Arrow | — |
| `cursors/face.tsx` | native,web | Face | — |
| `cursors/shapes.tsx` | — | CursorArrow, ReticleShape, FACE_GLOW, MouseFace | — |
| `elements/AccentFrame.tsx` | — | AccentFrame | Elements/Accent frame (Playground, Districts) |
| `elements/Timeline.tsx` | — | Timeline | Bowling Green (Playground, Alternate, Districts) |
| `form.tsx` | — | — | UI/Form (Profile) |
| `future/CircuitButton.tsx` | — | CircuitButton | — |
| `future/GridCard.tsx` | — | GridCard | — |
| `gpu/GpuCanvas.tsx` | — | GpuCanvas | — |
| `html/index.tsx` | — | Page, Main, Header, Footer, Nav, Section, Article, Aside, Figure, Figcaption, Address, Details, Summary, Heading, Paragraph, Text, Time, List, ListItem, Button, Link, Form, Fieldset, Legend, Label, Input, Textarea, Select, Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell | — |
| `keyboard-aware.tsx` | native,web | KeyboardAwareScroll | — |
| `layout/Container.tsx` | — | Container | Layout/Container (AllWidths) |
| `motion.tsx` | — | MotionView, MotionText, FadeIn, ScaleIn, SlideUp, Motion, AnimatePresence | — |
| `nav/NavBar.tsx` | — | NavBar | — |
| `nav/SiteFooter.tsx` | — | SiteFooter | — |
| `nav/SkylineBand.tsx` | — | SkylineBand | — |
| `neon/CornerCutFrame.tsx` | native,web | CornerCutFrame | — |
| `neon/NeonChevron.tsx` | — | NeonChevron | — |
| `neon/SolidPanel.tsx` | — | SolidPanel | — |
| `notify-modal.tsx` | — | MODAL_TOASTER_ID, MODAL_EXIT_MS, NotifyModal | — |
| `paste-wrapper.tsx` | native,web | PasteWrapper | — |
| `press-scale.tsx` | native,web | PressScale | — |
| `progress/ArrowLoader.tsx` | — | ArrowLoader | Progress/Arrow loader (Playground, WithValue, Districts) |
| `progress/CircularProgress.tsx` | — | CircularProgress | Progress/Circular progress (Playground, Indeterminate, Districts) |
| `progress/ProgressBar.tsx` | — | ProgressBar | Progress/Progress bar (Playground, Indeterminate, Districts) |
| `progress/RainLoader.tsx` | — | RainLoader | Progress/Window loader (Playground, WithValue, Districts) |
| `progress/TurbineLoader.tsx` | — | TurbineLoader | Progress/Rooftop loader (Playground, WithValue, Districts) |
| `text-effects/BlurText.tsx` | native,web | BlurText | — |
| `text-effects/GlitchText.tsx` | — | GlitchText | — |
| `text-effects/NeonGlowText.tsx` | — | NeonGlowText | — |
| `text-effects/OutlineText.tsx` | — | OutlineText | — |
| `three/CityHeightfield.tsx` | — | CityHeightfield | Backgrounds/CityHeightfield (Playground, SkiaFallback, Districts) |
| `three/HolographicTerrain.tsx` | — | HolographicTerrain | Backgrounds/HolographicTerrain (Playground, NeonBladeColors, PagePreview, PagePreviewNeonBladeColors, WebGL2Fallback) |
| `three/NeonTide.tsx` | — | NeonTide | Backgrounds/NeonTide (Playground, NeonBladeColors, BottomLeft, WebGL2Fallback, FlatFallback) |
| `three/ThreeCanvas.tsx` | — | ThreeCanvas | — |
| `tw.tsx` | — | View, Text, Pressable, TextInput, ScrollView, Main, Section, Article, Nav, Header, Footer, H1, H2, H3 | — |

### 5.4 Aggregate and foundation stories

| Story file (`packages/ui/…`) | Title | Covers |
|---|---|---|
| `foundation.stories.tsx` | Foundation | BrandPalette, Colors, Typography, Spacing, ContentWidths, ToneTable, RoundedTokens |
| `NeonBlade.stories.tsx` | NeonBlade/Index | All 41 NeonBlade ports side by side (AllComponents plus one story per port) |
| `Neon.stories.tsx` | Foundation/Neon primitives | `CornerCutFrame`, `SolidPanel`, `NeonChevron`, glow and shade helpers |
| `Nav.stories.tsx` | Play | `NavBar`, `SiteFooter` (all variants), `SkylineBand` |
| `Cursors.stories.tsx` | Cursors | `MouseCursor`, `PointerCursor`, `Crosshair`, the drawings |
| `TextEffects.stories.tsx` | Text | `GlitchText`, `NeonGlowText`, `OutlineText`, `BlurText` |
| `CardsAll.stories.tsx`, `CardSlider.stories.tsx` | Cards/All, Cards/Card slider | `NotchFrame`, `BeamFrame`, `NeonCheckbox`, `NeonSwitch`, `CardSlider` |
| `Charts.stories.tsx` | Charts/All charts | `BarCanvas`, `DonutCanvas`, `LinePlot`, the Neon charts, `StatCard` |
| `BackgroundsAll.stories.tsx` | Backgrounds/All | every background, every district |
| `GridWorld.stories.tsx` | NYC Mon/Grid world | `GridFloor`, background systems, `CircuitButton` / `GridCard` (FutureControls) |
| `Progress.stories.tsx`, `Elements.stories.tsx` | Progress/All, Bowling Green | progress family; `AccentFrame` + `Timeline` |
| `FormsAll.stories.tsx`, `form.stories.tsx` | Forms/All, UI/Form | form controls, `useAppForm` signup validation |
| `AudioPlayer.stories.tsx`, `Waveform.stories.tsx` | UI/AudioPlayer, UI/Waveform | `AudioPlayer`, `VoiceRecorder` (RecorderOnWeb), `Waveform` |
| `Toast.stories.tsx` | UI/Toast | `ToastCard`, `notify`, `NotifyModal` (LiveNeonModal) |

No story exists for: `Modal`, `NativeSlot`, `NightScope`, `SafeArea`, `KeyboardAwareScroll`, `PressScale`, `PasteWrapper`, `motion` presets, `GpuCanvas`, `ThreeCanvas`, `BrandLogo`, `BrandWordmark`.

### 5.5 What the kit lacks for Phase 1

Nothing in the kit is an H-Lynk part yet: no bezel/shell, trackpad control, side buttons, scanner LED status light, capture case, `CareMeterRing`, `IncubationRing`, `HatchCountdown` or `StreakCalendar` (the progress family's `CircularProgress` is the closest base for the rings). No `DeviceStage` for the web hero. Each needs a kit component plus a story before a screen uses it.

## 6. Theme tokens (`packages/theme/tokens.ts`)

`tokens.ts` says it is the only file with hex values; the palette is sampled from the NYC-MON logo, not from the Knicks reference hexes in §1.3. The theme is **dark-first** (`semantic.bg.dark` is night `#00041C`), which conflicts with §1.3's "the default companion view is daylit".

Brand anchors (`brand`):

| Token | Hex | Note in source |
|---|---|---|
| `orange` | `#FC7C00` | wordmark + outer ring |
| `orangeDeep` | `#FC6C00` | wordmark shadow |
| `royal` | `#0058F8` | wordmark outline, buildings |
| `carolina` | `#4BA8F0` | sky, lifted from sampled `#0080FC` for AA on night |
| `apple` | `#F80000` | the Big Apple |
| `leaf` | `#3FAE3A` | brightened from `#2C7824` for AA on night |
| `night` | `#00041C` | base background instead of black |
| `white` | `#F8F8F8` | banner text |
| `silver` | `#BEC0C2` | Knicks secondary |

Scales (50–950, 500 = anchor): `orange`, `royal`, `carolina`, `leaf`, `apple`, `silver`, `ink` (`#F8F8F8` → `#00041C`), plus `white #FFFFFF`. Legacy aliases kept for starter code: `burgundy`→orange, `ember`→royal, `gold`→orange, `forest`→leaf, `sky`→carolina, `rose`→apple, `slate`→silver.

Semantic tokens (light / dark): `bg` and `surface` `#F8F8F8` / `#00041C`; `surface-raised` `#FFFFFF` / `#0A1230`; `surface-sunken` `#ECECED` / `#000212`; `text` `#00041C` / `#F8F8F8`; `text-muted` `#545767` / `#BEC0C2`; `text-inverse`; `primary` `#A35100` / `#FC7C00`; `primary-pressed` `#884300` / `#FD9D40`; `on-primary` `#FFFFFF` / `#00041C`; `accent` `#0058F8` / `#4BA8F0`; `accent-pressed` `#004CD9` / `#78BEF4`; `on-accent`; `structure` `#0058F8`; `border` `#D8D8DB` / `#1A2E6E`; `border-strong` `#0058F8` / `#4082FA`; `focus` `#0058F8` / `#4BA8F0`; `success` `#2C7A29` / `#3FAE3A`; `danger` `#D50000` / `#FA4040`; `info` `#295D8E` / `#4BA8F0`; `on-success` / `on-danger` / `on-info`; `glow` `#0058F833` / `#0058F8A6`; `glow-hot` `#FC7C0033` / `#FC7C0080`.

Also in `tokens.ts`: `neon` (canvas colours for Skia/three), `fontFamilies` (display Archivo Black, sans Space Grotesk), `typeScale` (`display-sm` 1.875rem … `display-2xl` 4.5rem), `contentWidths`, `radius` (all 0 except `soft` 0.625rem and `full`), `shadows` (glows), `zIndex`, `motion` (durations 120/200/300/500 ms; easings standard/emphasized/exit), `breakpoints`.

Contrast: `packages/theme/contrast.mjs` checks semantic text/surface pairs against 4.5:1 and exits 1 on failure. It is a script, not a test; it does not cover UI-graphic 3:1 pairs or the brand/scale hexes. The measured table and `contrast.test.ts` belong to the contrast agent (`packages/theme/contrast*`, `docs/design/contrast*`).

## 7. Logo files

| File | Size | Used by |
|---|---|---|
| `packages/assets/brand/nyc-mon-logo.png` | 1254×1254 RGBA, master badge | — |
| `packages/assets/brand/nyc-mon-logo-640.png` | 640×640 resample | `packages/ui/brand/logoSource{,.web,.native}.ts` → `BrandLogo` |
| `packages/assets/brand/nyc-mon-wordmark.png` | 2172×724 RGBA, master wordmark | — |
| `packages/assets/brand/nyc-mon-wordmark-432.png` | 432×144 resample | `packages/ui/brand/wordmarkSource{,.web,.native}.ts` → `BrandWordmark` |

App icons and splash: `apps/web/app/icon.png`, `apps/web/app/apple-icon.png`, `apps/web/app/favicon.ico`, `apps/mobile/android/app/src/main/res/drawable-*/splashscreen_logo.png`, `apps/mobile/assets/`.

There is **no H-Lynk mark** anywhere in the repo, and no SVG logo; both masters are raster. No store badges either.

## 8. Backend and auth

> **Updated 2026-10-04.** The bullets below describe the repo at `42c3273`. Since then Better Auth runs inside Payload (ADR 0001) and Payload, its admin, REST and Better Auth are hosted by `apps/admin-vite`, not `apps/web` (ADR 0003).

The repo standardises on **Payload CMS 4.0.0-canary.37 on Postgres** (`@payloadcms/db-postgres` 4.0.0-canary.37, `pg` 8.23.1), mounted inside `apps/web` at `42c3273`:

- Config `packages/payload/src/payload.config.ts`: REST at `/payload-api`, Postgres schema `payload`, `push` gated by an env flag, CORS/CSRF limited to the site URL.
- `packages/payload/src/collections/Users.ts`: `auth: true` (Payload's local email + password strategy, JWT/cookie sessions), one extra field `name`.
- `packages/payload/src/collections/Media.ts`: uploads via `sharp` 0.35.5.
- Env names (values not recorded): `DATABASE_URL`, `PAYLOAD_SECRET`, `PAYLOAD_PUSH`, `NEXT_PUBLIC_SITE_URL`, `EXPO_PUBLIC_APP_URL` (`.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example`).

Not present: Better Auth, Supabase, Firebase, Clerk, Auth.js; no passkey, Sign in with Apple or Google; no auth client in `apps/mobile`; no `/v1` endpoints. Payload's installed auth offers the local strategy, API keys and a custom `strategies: AuthStrategy[]` hook (`node_modules/payload/dist/auth/types.d.ts`, lines 162 and 242). ADR 0001 builds on this.

## 9. State

- **zustand 5.0.15**: used in about 31 files across `apps/*` and `packages/*` (feature stores in `packages/app/features/*/*.store.ts`, `packages/spatial/districtStore.ts`, `packages/ui/use-instance-store.ts`, web header state).
- **react-native-mmkv 4.3.2** (`createMMKV`): one store, `packages/app/features/editor/preferences.store.native.ts`, plus `apps/mobile/src/navigation/split-view/pane-overrides.store.ts`. No versioned save blob exists.
- **@tanstack/react-query 5.104.1** for server data (`packages/app/providers/query-provider.tsx`).

## 10. Installed versions of the §0B seams

| Package | Installed | Read from |
|---|---|---|
| `three` | 0.186.1 (r186) | `packages/ui/node_modules/three/package.json` (`@types/three` 0.186.0) |
| `react-native-webgpu` | 0.10.4 | `apps/mobile`, `packages/ui` → `node_modules/.pnpm/react-native-webgpu@0.10.4` |
| `typegpu` | 0.12.6 | `packages/ui` |
| `@typegpu/three` | 0.12.1 | `packages/ui` |
| `@typegpu/gl` | 0.12.5 | `packages/ui` (`unplugin-typegpu` 0.12.4 in `packages/ui`, `apps/web`) |
| `@shopify/react-native-skia` | 3.0.2, aliased to `react-native-skia@3.0.2` | `packages/ui`; apps import `react-native-skia` 3.0.2; `canvaskit-wasm` 0.41.0 on web |
| `react-native-reanimated` | 4.7.0 (`react-native-worklets` 0.13.0) | `apps/mobile`, `packages/ui`, `packages/app` |
| `expo-notifications` | **not installed**, not in the catalog | — |
| `expo-haptics` | **not installed**; catalog pins 58.0.4 but no workspace depends on it. Haptics today use `react-native-pulsar` 1.7.0 (`packages/ui/haptics.native.ts`) | — |
| `expo-router` | 58.0.13 | `apps/mobile`, `packages/app` |
| `next` | 16.3.8 | `apps/web` |
| `zod` | 4.6.5 | `apps/web` only |
| `zustand` | 5.0.15 | see section 9 |
| `react-native-mmkv` | 4.3.2 | `apps/mobile`, `packages/app` |
| `expo` / `react-native` / `react` | 58.0.3 / 0.88.0-rc.3 / 19.3.0 | all apps |
| `tailwindcss` / `uniwind` | 4.3.3 / 1.12.1 | apps, `packages/ui` |
| `vitest` | 5.0.3 | `apps/storybook` only; packages test with `node --test` |
| `payload` | 4.0.0-canary.37 | `apps/admin-vite`, `packages/payload` |

The §1.2 floor holds: three r186 ≥ r168, RN 0.88 ≥ 0.81, New Architecture only. RN 0.88 is a release candidate, and Payload 4 is a canary.

## 11. Gaps that block later milestones

1. `packages/core`, `packages/content`, `packages/render`, `packages/auth` do not exist (core is in progress by another agent).
2. `NYC_Mon_Master_Bible_v11.md` is not in the repo, so the three starters' Dex records (IDs, body data, food classes, culture notes) cannot be transcribed. The other six v11/v9/v5/v1 domain bibles named in the index are missing too, including the Gameplay/Care and H-Lynk bibles that M10–M18 and the device spec depend on.
3. `expo-notifications` is not installed (M06, M11, M23); `expo-haptics` is pinned but not declared by any workspace.
4. `zod` is only in `apps/web`; Law 5 needs it in core/content/auth.
5. No auth providers beyond Payload email + password; no mobile auth client; no `/v1` server contract (ADR 0001).
6. No Vitest in any package; Law 3 and §8 call for headless Vitest in `packages/core/sim`.
7. `eslint-plugin-jsx-a11y` is not configured and no axe pass runs in CI (§0A.2).
8. No H-Lynk mark or any SVG logo; no store badges.
9. The theme is dark-first and logo-sampled; §1.3 asks for a daylit default and city neutrals (concrete greys, MTA-signage black) that have no tokens yet.
10. Web header/footer use `@acme/ui/tw`, not `@acme/ui/html`, and duplicate the kit's `NavBar` / `SiteFooter`.
11. None of the §4 or §5 routes exist; current routes are the starter's demo screens.
12. No H-Lynk kit components (section 5.5).
