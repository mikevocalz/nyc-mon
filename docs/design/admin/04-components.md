# Ops console: components and Payload seams

Owner: `design-director`. Written 2026-10-04. The kit inventory is `docs/REPO_MAP.md` §5; this file maps every console element to it (LAWS R3), specs every gap as a kit component with a story first, and maps every route to a Payload 4 admin seam read from the installed source (Law 2, R6).

**No raw HTML.** Every element below is an `@acme/ui` component or an `@acme/ui/html` primitive. No bare `<div>`, `<table>`, `<button>`, `<dl>` or `<ol>` in console code. Where the primitive does not exist yet it is specced in "HTML primitive gaps" and lands in `packages/ui/html` with a story in `primitives/primitives.stories.tsx` before any screen uses it. DVNT's console (`dvnt-monorepo/apps/web/src/dashboard/AdminApp.tsx`) is raw HTML and CSS classes; it is a reference for structure only.

## 1. Element map

### Shell (every screen)

| Element | Component | Variant / props | Notes |
|---|---|---|---|
| Console root | `html.Page` + `html.Main` | `className` sets `scheme-dark` when night | one `Main` per screen |
| Pane layout | `AdaptivePanes` (moving into `@acme/ui`; today `apps/mobile/src/navigation/split-view/AdaptiveSplitView.tsx`) | `topColumnForCollapsing="supplementary"` on list screens, `"primary"` on two-pane screens; `showInspector` from store | gap G13 for web fold data |
| Sidebar nav | `html.Nav` (`aria-label="Console"`) + `List` / `ListItem` + `SidebarSection` (split view) | `ListItem` `current` (gap G14) | wordmark from `BrandWordmark` at the top, never redrawn |
| Wordmark | `BrandWordmark` | `height={24}` in the sidebar, `32` on sign in | `packages/ui/brand/BrandWordmark.tsx`; raster master per REPO_MAP §7 |
| Payload nav icon slot | `BrandLogo` | `size={28}` | `graphics.Icon`; only Payload chrome that could still render (MinimalTemplate around sign in) |
| Pane header | `Toolbar` | `title` = section name, `actions` = pane actions | the `h1` lives in the list pane `Toolbar` on list screens |
| Section nav, `compact` / `medium` | `TabBar` | `navigation` mode (gap G15) | five tabs; "More" opens `BottomSheet` |
| Section nav, book posture | `Select` | `label="Section"` | top of the leading segment |
| Staff menu | `Menu` anchored to `IconButton` (`variant="ghost"`) | actions: Settings, Sign out | sidebar foot |
| Integrity alert on every screen when failing | `SignageBand` (gap G11) | `tone="danger"`, compact height | above the pane row |
| Inline banners (masking notice, deletion scheduled, not connected) | `Banner` (gap G16) | `tone` info / danger / neutral | |
| Toasts | `notify` + `Toaster` | `success`, `error` | "Copied", "Consent email sent" |

### Lists

| Element | Component | Variant / props | Notes |
|---|---|---|---|
| Table | `DataTable` | `surface="page"` (G1), `mode="server"` (G2), `layout="auto"` (G2) | priority columns ≥ 600 px pane width, record rows below |
| Search | `SearchBar` | `aria-label="Find a Caller"`, `debounceMs={300}`; wrapped in `html.Search` (H4) | exact email or id |
| Filters | `FilterBar` + `FilterChip` (G4) | chips removable; "Add filter" opens `Menu` | |
| Lanes / tabs in a pane | `SegmentedControl` | options carry counts in their label | consent lanes, Mons / Eggs / Integrity |
| Sort on record rows | `Select` | `label="Sort"` | replaces header sorting below 600 px |
| Paging | `Pagination` (G3) | server totals | under the table |
| Status | `Badge` | `fill` solid / outline, `size="sm"`, `dot` | map in §3 |
| Loading | `DataTable` `loading` | `loadingRows={8}` | |
| Empty | `EmptyState` | `icon` from `@acme/ui/icons` | per-screen copy in `05-copy.md` |
| Error | `Banner` (G16) `tone="danger"` with a "Try again" `Button` | | |

### Detail

| Element | Component | Variant / props | Notes |
|---|---|---|---|
| Record sections | `html.Section` (`aria-labelledby`) + `html.Heading level={2}` | | |
| Key/value pairs | `KeyValueList` (G5) on `html.DescriptionList` (H1) | | |
| Masked value | `MaskedValue` (G6) | `onReveal(reasonCode)` → audit | email, name, birth year, parent email |
| Copy id | `CopyButton` (G7) | | Caller, Mon, egg, consent, event ids |
| Timestamps | `Timestamp` (G17) on `html.Time` | relative + absolute | |
| Care meters, bond | `ProgressBar` | `variant="solid"`, `size="sm"`, `role="meter"` (G18) | read-only |
| Caller's Mons, Bloodline tree | `List` / `ListItem`; tree nests `List` | `supportingText` for line 2 | |
| Consent timeline, inspector trail | `Timeline` | `variant="minimal"` | `elements/Timeline.tsx` already renders `List` with `aria-current="step"` |
| Integrity checks | `Checklist` + `CheckRow` (G12) on `html.OrderedList` (H2) | | |
| Overview tiles | `StatCard` | `surface="page"` (G1), no `sparkData` | |
| Integrity band | `SignageBand` (G11) | `tone="signage"` / `"danger"` | the one bold element |
| Danger zone | `FieldGroup` section + `Button variant="danger"` | | bottom of Caller detail |
| Primary action | `Button` | `variant="cornerCut"`, cta tone | one per screen |
| Secondary actions | `Button` | `variant="outline"` / `"ghost"` | |

### Dialogs and forms

| Element | Component | Variant / props | Notes |
|---|---|---|---|
| Any dialog | `ResponsiveDialog` (G9) | `Dialog` ≥ `medium`, `BottomSheet` at `compact`, fold-segment aware | |
| Type-to-confirm | `ConfirmDestructive` (G8) | `confirmText` = last 6 characters of the record id | deletion, sign out everywhere |
| Reason picker | `Select` | `label="Reason"`, `options` from a fixed code list | never `Textarea` on these screens (D-A2) |
| Sign-in form | `html.Form` + `TextField` ×2 + `Button` ×2 + `ErrorMessage` | `TextField` `type="email"` / password, `autoComplete` set | inside `Card` `surface="page"` |
| Settings appearance | `SegmentedControl` | Match system / Daylit / Night | |
| Staff role | `Select` | roles from B2 | |

## 2. Kit gaps (each lands in `packages/ui` with a story before a screen uses it)

API shapes follow Margelo's `api-design` skill (R5): one options object, literal unions, discriminated unions for states, units in names, no boolean clusters. Every component takes `district?` and `tone?` like the rest of the kit; the console passes `tone="royal"` for structure.

### G1 — `surface="page"` on `DataTable`, `StatCard`, `Card`

- **Problem:** these are night facades on every page (`NightScope.tsx`). A daylit console of night tables is heavy and hides the scheme the staff picked.
- **API:** `surface?: 'night' | 'page'`, default `'night'` (no change for existing callers). `'page'` draws `surface-raised` face, `border` keylines, `text`/`text-muted` type, tone only on the selection bar and sort glyph; drops glow and the title plate.
- **Stories:** `UI/DataTable` → `PageSurface`, `PageSurfaceNight`; `Charts/Stat Card` → `PageSurface`; `UI/Card` → `PageSurface`.

### G2 — `DataTable` server mode and responsive layouts

- **Problem:** today's table sorts and pages in memory, scrolls sideways (`minWidth: columnCount * 112`), has no caption, no `aria-sort`, no row link, no selection.
- **API (additions):**
  ```ts
  interface DataTableProps<T> {
    caption: string;                       // required; visually hidden by default
    layout?: 'auto' | 'columns' | 'records'; // default 'auto': records below 600 px pane width
    mode?: DataTableMode<T>;               // default { kind: 'client' }
    getRowHref?: (row: T) => string;       // whole row is one link; sets aria-current on the selected row
    selectedRowId?: string;
    getRowId: (row: T) => string;
    selection?: DataTableSelection;        // only where a bulk action exists
    emptyState?: ReactNode;
    errorState?: ReactNode;
  }
  type DataTableMode<T> =
    | { kind: 'client'; pageSize?: number }
    | { kind: 'server'; sort: SortState; onSortChange: (next: SortState) => void; rows: T[] };
  type SortState = { columnId: string; direction: 'asc' | 'desc' } | undefined;
  type DataTableSelection = { selectedIds: readonly string[]; onSelectedIdsChange: (ids: string[]) => void };
  ```
  Column meta gains `priority: 1 | 2 | 3 | 4` (1 never drops) and `align?: 'start' | 'end'` (numbers end-aligned).
- **States:** default, hover (page surface: tint `royal-500` at 4%), selected (royal bar 4 px on the leading edge + 8% tint), focus-visible (2 px `focus` ring inset), loading (skeleton rows, `aria-busy`), empty, error.
- **Accessibility:** real `<table>` with `TableCaption` (H3); header buttons get `aria-sort`; in `records` layout the header row is visually hidden (`VisuallyHidden`, H5), not removed; the expanded-row disclosure is a `Button` with `aria-expanded` and `aria-controls`.
- **Stories:** `ServerSort`, `PriorityColumns` (resizable container), `RecordRows`, `RowLinks`, `Selection`, `Empty`, `Error`, `Loading`, each in daylit and night.

### G3 — `Pagination`

- **API:** `{ page: number; pageCount: number; totalCount: number; pageSize: number; pageSizeOptions?: readonly number[]; onPageChange(page: number): void; onPageSizeChange?(size: number): void }`.
- Renders `html.Nav aria-label="Pagination"`, "Showing 51–100 of 1,204", Previous / Next `Button`s (44 px), a page-size `Select`. At `compact`, Previous / Next only plus "Page 2 of 25".
- **Stories:** `Default`, `FirstPage`, `LastPage`, `Compact`.

### G4 — `FilterBar` and `FilterChip`

- **API:** `FilterChip { label: string; value: string; onRemove(): void }`; `FilterBar { children; onAddFilter?: () => void; onClearAll?: () => void }`. Chip reads "Consent status: Pending", remove button labelled "Remove filter Consent status".
- Wraps onto new lines; never scrolls sideways.
- **Stories:** `Empty`, `TwoFilters`, `Wrapping`.

### G5 — `KeyValueList`

- **API:** `{ items: readonly KeyValueItem[]; columns?: 1 | 2 }` with `KeyValueItem = { key: string; label: string; value: ReactNode; action?: ReactNode }`.
- Renders `DescriptionList` / `DescriptionTerm` / `DescriptionDetails` (H1). Two columns from 600 px pane width; one below. A pair never splits across columns or a fold segment (CSS `break-inside: avoid`).
- **Stories:** `Default`, `WithActions`, `TwoColumns`, `TodoCanon` (null values render the `TODO(canon)` badge).

### G6 — `MaskedValue`

- **API:** discriminated state: `{ state: 'masked'; mask: string; onRevealRequest(): void } | { state: 'revealed'; value: string; onHide(): void }`. The reason dialog belongs to the screen, so the component holds no business state (Law 4).
- Masked: shows the mask (`d•••@g•••.com`, or "Hidden" for a name) and a "Show" `Button` (ghost, 44 px). Revealed: value plus "Hide". Navigation away re-masks (screen store resets).
- **Stories:** `Masked`, `Revealed`, `LongValue`.

### G7 — `CopyButton`

- **API:** `{ value: string; label: string }` (label like "Copy Caller id"). `IconButton` ghost; on success `notify` "Copied"; on failure `notify` error "Couldn't copy. Select the id and copy it."
- **Stories:** `Default`, `InKeyValueList`.

### G8 — `ConfirmDestructive`

- **API:** `{ open: boolean; title: string; consequences: readonly string[]; confirmText: string; confirmLabel: string; reasonOptions?: readonly SelectOption[]; onConfirm(input: { reasonCode?: string }): Promise<void>; onClose(): void }`.
- Lists consequences, asks to type `confirmText`, keeps the destructive `Button` disabled until the text matches and a reason is chosen. Shows a pending state on the button and keeps the dialog open on error with the error inline.
- **Stories:** `ScheduleDeletion`, `DeleteConsentRecord`, `PendingState`, `Error`, `Compact` (as a sheet).

### G9 — `ResponsiveDialog`

- Picks `Dialog` (≥ `medium`) or `BottomSheet` (`compact`) from the window size class; on a tabletop fold it opens in the bottom segment, on a book fold in the segment the trigger sits in. Same props as `Dialog`.
- Fix in passing: `BottomSheet` sets `role="dialog"` without `aria-modal` and forces the night scheme (`BottomSheet.tsx` line 58); the console needs `aria-modal="true"` and a page-surface option.
- **Stories:** `Desktop`, `Compact`, `TabletopFold`.

### G11 — `SignageBand`

- **API:** `{ tone: 'signage' | 'danger'; headline: string; detail?: string; action?: ReactNode; size?: 'hero' | 'strip' }`. `signage`: `signage-black` face, `signage-white` text (21.00:1). `danger`: `danger` face with `on-danger` text (daylit 5.48:1). `hero` uses Archivo Black 24/30 for the headline; `strip` is one line, 44 px tall, used as the global alert.
- Announces changes through a polite live region only when the tone changes.
- **Stories:** `Healthy`, `Failing`, `Strip`, `Night`.

### G12 — `Checklist` and `CheckRow`

- **API:** `CheckRow { label: string; result: CheckResult; detail?: string; href?: string }`, `CheckResult = { kind: 'pass'; count: 0 } | { kind: 'fail'; count: number } | { kind: 'info'; count: number } | { kind: 'pending' } | { kind: 'unavailable'; reason: string }`.
- Renders `OrderedList` (H2). Pass and fail carry an icon and a word ("Passing", "Failing"), never colour alone.
- **Stories:** `AllPassing`, `OneFailing`, `Unavailable`.

### G13 — `AdaptivePanes` web fold geometry

- The MoyoLearn port's `use-fold-layout.web.ts` returns `[]`. The console's web fork reads `window.viewport.segments` and subscribes to `resize` and `window.viewport` changes; posture from `@media (horizontal-viewport-segments: 2)` (book) and `(vertical-viewport-segments: 2)` (tabletop), plus `navigator.devicePosture` where present. When `window.viewport` is undefined it returns `[]` (hinge-blind, width classes only).
- Law 2: the platform agent reads Chrome's shipped surface (https://developer.chrome.com/blog/viewport-segments-api-shipped) and the TypeScript DOM lib before writing it; if the DOM lib lacks the types, they are declared narrowly in the fork, not as `any`.
- **Stories:** `AdaptivePanes/BookFold`, `TabletopFold`, `TriFold`, driven by a fake segments provider.

### G14 — `ListItem` `current`

- `current?: boolean` → `aria-current="page"` plus the existing `selected` look. Nav items are `Link`s, not pressables.
- **Story:** `UI/List` → `Navigation`.

### G15 — `TabBar` navigation mode

- Today `TabBar` renders `role="tablist"` with `role="tab"` items inside a `Nav` (`TabBar.tsx` lines 80–91). Route navigation is not a tab widget. Add `semantics?: 'tabs' | 'navigation'`; `navigation` renders `Link`s with `aria-current="page"` and no tab roles.
- **Story:** `UI/TabBar` → `Navigation`.

### G16 — `Banner`

- **API:** `{ tone: 'info' | 'danger' | 'success' | 'neutral'; title: string; description?: string; action?: ReactNode }`. Page-level, not dismissible by default. `danger` uses `role="alert"` only when it appears in response to an action; otherwise `role="status"`.
- **Stories:** `Info`, `Danger`, `WithAction`, `Night`.

### G17 — `Timestamp`

- **API:** `{ at: Date | number; format: 'relative' | 'absolute' | 'both'; timeZone?: string }`. Renders `html.Time` with a `dateTime` ISO value; relative text ("2 min ago") with the absolute value in the accessible name. Uses `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`, no date library (same rule as the schedule calendar in the split view README).
- **Stories:** `Relative`, `Absolute`, `Both`.

### G18 — `ProgressBar` meter semantics

- `ProgressBar` exposes no `progressbar` or `meter` role today (only `aria-hidden` decorations in `progress/ProgressBar.tsx`). Add `role?: 'progressbar' | 'meter'` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`.
- **Story:** `Progress/Progress bar` → `Meter`.

### G19 — `@acme/ui/admin` entry

- The root barrel pulls in Skia, three.js and WebGPU (`packages/ui/index.ts` exports `./gpu`, `./three`, backgrounds). The console imports from a narrow `@acme/ui/admin` entry that re-exports only the components in this file. Barrel only, no logic (api-design: entry points are barrels).

## 3. Status vocabulary (Badge mapping)

Mapping lives in the console code as an `as const satisfies` record per status union, not in the kit.

| Status | Label | Badge | Measured (daylit) |
|---|---|---|---|
| consent `pending` | Pending | solid `info` (`carolina-800` face, white text) | 6.88 |
| consent `approved` | Approved | solid `success` (`leaf-700`, white) | 5.35 |
| consent `denied` | Denied | outline neutral (`concrete-700` text on `concrete-100`) | 7.31 |
| consent expired | Expired | outline neutral | 7.31 |
| consent `not-required` | none (cell shows "13 and over") | — | — |
| deletion scheduled | Deletion scheduled | outline `danger` (`apple-600` text on white) | 5.48 |
| egg incubating | Incubating | solid `info` | 6.88 |
| egg ready | Ready to hatch | solid `cta` (`orange-500` face, black text) | 8.02 |
| egg hatched / Mon confirmed | Hatched | outline neutral | 7.31 |
| Mon not server-confirmed | Not confirmed | outline `info` | 6.88 |
| integrity fail | Failing | solid `danger` (`apple-600`, white) | 5.48 |
| `TODO(canon)` | TODO(canon) | outline neutral with dot | 7.31 |

Denied is neutral, not red: a guardian saying no is not an error (Decision #15).

## 4. HTML primitive gaps (`@acme/ui/html`)

REPO_MAP §5.1 lists the gaps. The console needs these, each with a case in the `Primitives` story before use:

| # | Primitive | Element on web | Native mapping | Used by |
|---|---|---|---|---|
| H1 | `DescriptionList`, `DescriptionTerm`, `DescriptionDetails` | `dl`, `dt`, `dd` | `View` with `role="list"` / text pairs | `KeyValueList` |
| H2 | `OrderedList` | `ol` | `View role="list"` | `Checklist`, Bloodline tree order |
| H3 | `TableCaption` | `caption` | `Text` with `role="heading"` hidden | `DataTable` |
| H4 | `Search` | `search` (HTML living standard landmark) | `View role="search"` | list search + filters |
| H5 | `VisuallyHidden` | `span` with the clip pattern | `Text` with `accessibilityElementsHidden={false}` and zero size | hidden header row, captions, live regions |
| H6 | `Output` | `output` (live result of a check) | `Text` with `accessibilityLiveRegion="polite"` | `SignageBand` status line, check results |

`Figure`'s `div role="figure"` (REPO_MAP §5.1) is not used by the console, so it is not on this list.

## 5. Payload seams (read from the installed 4.0.0-canary.37)

Paths below are under `node_modules/.pnpm/payload@4.0.0-canary.37…/node_modules/payload/dist` (P), `@payloadcms+ui@4.0.0-canary.37…/node_modules/@payloadcms/ui/dist` (U) and the plugin fork `@delmaredigital+payload-better-auth@…/dist` (B). Registration happens only in `packages/payload/src/admin/components.ts` (`adminComponents`, component paths `./admin/console/<File>#<Export>` against `importMap.baseDir`), then `pnpm --filter admin-vite payload:importmap`.

### Seams that exist

| Seam | Verified at | Shape |
|---|---|---|
| `admin.components.graphics.Logo` / `.Icon` | P `config/types.d.ts` 847–854 | `CustomComponent` |
| `admin.components.Nav` | P `config/types.d.ts` 865 | `CustomComponent` |
| `admin.components.views.dashboard` / `.account` / `[key]` | P `config/types.d.ts` 896–903 | `AdminViewConfig` |
| `AdminViewConfig` | P `admin/views/index.d.ts` 12–23 | `{ Component; path?: '/${string}'; exact?; strict?; sensitive?; meta? }` |
| View props | P `admin/views/index.d.ts` 33–54 | `AdminViewServerProps`: `initPageResult`, `params`, `searchParams` (via `ServerProps`), `clientConfig`, `importMap` |
| `req.server.redirect(path)` / `.notFound()` | P `admin/adapters/server.d.ts` 14–16; `types/index.d.ts` 64–72 | framework-neutral redirect for server components |
| Collection `admin.components.views.list.Component` | P `collections/config/types.d.ts` 315–325 | replace the list view |
| Collection `views.edit.root` | P `config/types.d.ts` 1541–1554 (`EditConfigWithRoot`) | replace every document route under `/collections/:slug/:id/**` |
| Collection `admin.hidden` | P `collections/config/types.d.ts` 375–377 | `boolean \| ({ user }) => boolean`; removes from nav and visible entities |
| `admin.theme` | P `config/types.d.ts` 1009 | `'all' \| 'dark' \| 'light'` |
| `admin.routes.account` etc. | P `config/types.d.ts` 955–990 | |
| Field `admin.components.Cell` / `Field` | P `fields/config/types.d.ts` 186–193 | exist; the console does not use them because no stock list or edit view renders |
| Client hooks | U `exports/client/index.d.ts` | `useAuth`, `useConfig`, `useRouter`, `usePathname`, `useSearchParams`, `useTheme` |
| Templates | U `exports/rsc` | `DefaultTemplate`, `MinimalTemplate` |
| Plugin login replacement | B `plugin/index.d.ts` 138; `plugin/index.js` 361–364 | `admin.loginViewComponent` (import-map path), mounted at `/login` |
| Plugin role gate | B `plugin/index.d.ts` 25–36 | `admin.login.requiredRole: string \| string[] \| null`, `requireAllRoles` |
| Plugin passkey, sign-up, social on the login | B `plugin/index.d.ts` 37–60, 120–131 | `enablePasskey`, `enableSignUp`, `enableSocial` |
| Plugin management UI | B `plugin/index.d.ts` 139–145; `plugin/index.js` 405–470 | `enableManagementUI` (default `true`) injects an API-keys view and passkey / 2FA `ui` fields into the auth collection |
| Access helpers | B `utils/access.d.ts` 23–29, 103–236 | `hasAdminRoles({ adminRoles })`, `hasRole`, `isAdminOrSelf` |

### How templates are chosen (why the console uses root views)

U `views/Root/getRouteData.js`:

- `/admin` (dashboard) always renders inside `DefaultTemplate`, Payload's nav and header (lines 56–64).
- A custom view registered over a built-in key (`login`, `account`) gets `MinimalTemplate`; `account` gets `DefaultTemplate` (lines 96–108).
- Collection list and document routes render inside `DefaultTemplate` even when their Component is replaced (lines ~157–260).
- A custom view at any path Payload does not own falls through to `getCustomViewByRoute` with no template (lines 304–309; `views/Root/index.js` 290–291 renders it in a bare `Fragment`).

So the console's screens are **root custom views at their own paths**, which render with no Payload chrome. Payload's dashboard, account and collection routes are kept only as redirects.

### Route ownership

View paths are matched by `path-to-regexp` 6.3.0 (U `utilities/isPathMatchingRoute.js` line 1; pinned in `@payloadcms/ui` and `payload` `package.json`), so `:param?` (optional) and `:rest*` (zero or more segments) are valid.

| Route | Seam | Component (`packages/payload/src/admin/console/…`) | Behaviour |
|---|---|---|---|
| `/admin` | `views.dashboard` | `DashboardRedirect` | server component; `req.server.redirect('/admin/overview')` before render, so `DefaultTemplate` never paints |
| `/admin/overview` | `views.overview` `{ path: '/overview', exact: true }` | `OverviewView` | |
| `/admin/callers`, `/admin/callers/:callerId` | `views.callers` `{ path: '/callers/:callerId?' }` | `CallersView` | |
| `/admin/consent`, `/admin/consent/:consentId` | `views.consent` | `ConsentView` | |
| `/admin/mons`, `/:id`; `/admin/eggs`, `/:id`; `/admin/integrity` | `views.mons`, `views.eggs`, `views.integrity` | `MonsView` (one component, three paths) | |
| `/admin/content/**` | `views.content` `{ path: '/content/:rest*' }` | `ContentView` | |
| `/admin/audit`, `/admin/audit/:eventId` | `views.audit` | `AuditView` | |
| `/admin/settings`, `/admin/settings/staff` | `views.settings` | `SettingsView` | |
| `/admin/account` | `views.account` | `AccountRedirect` | redirects to `/admin/settings` |
| `/admin/login` | plugin `admin.loginViewComponent` | `ConsoleLogin` | inside `MinimalTemplate`; fills it |
| `/admin/collections/users` and `/:id/**` | `users.admin.components.views.list.Component`, `views.edit.root.Component` | `CollectionRedirect` with `clientProps.to` | → `/admin/callers` or `/admin/callers/:id` |
| `/admin/collections/<every other slug>` | same pair on every collection, including the plugin-generated ones and `media` | `CollectionRedirect` | → `/admin/overview` |
| Payload nav (if any `DefaultTemplate` renders before a redirect) | `admin.components.Nav` | `ConsoleNavFallback` | renders nothing but the wordmark; belt and braces |
| `graphics.Logo` / `graphics.Icon` | | `ConsoleLogo` / `ConsoleIcon` | `BrandWordmark` / `BrandLogo` |

Plugin options to set (in `payload.config.ts`, `createBetterAuthPlugin({ admin: … })`): `loginViewComponent`, `login.requiredRole` = staff roles (B2), `login.enablePasskey: true`, `login.enableSignUp: false`, `login.enableSocial` unset, `enableManagementUI: false` (passkeys and sessions move to the console's Settings, so the plugin's `ui` fields never land in a stock edit view). Every collection sets `admin.hidden: true`.

### Things someone might assume exist and don't

- No config key hides the `DefaultTemplate` header on the dashboard; hence the redirect.
- `beforeLogin` / `afterLogin` never render: the plugin replaces Payload's login view (B `plugin/index.js` 341–352 warns about it).
- The collections the console needs (`guardian-consents`, `eggs`, `mon-instances`, care state, `audit-events`) are not in `payload.config.ts` (B1).
- `admin.hidden` hides a collection from the nav; it does not stop its routes from resolving (`getRouteData.js` looks the collection up by slug). The redirects are what close those routes.
