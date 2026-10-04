# Ops console: direction

Owner: `design-director`. Written 2026-10-04. Reads with `01-research.md` (people, risks, blockers B1–B5) and `02-references.md`. Every element named here maps to a kit component or a kit gap in `04-components.md`; every route maps to a Payload seam there too.

## The idea

The console is a station board for the people who keep NYC-MON running: concrete page, signage-black type, one black MTA-style band that carries the only number that can never be anything but zero. Everything else is quiet, square and dense.

- **The bold move, spent once:** the Overview's **integrity band**, a full-width `signage-black` strip with white type, the way a subway platform sign sets white Helvetica on black (1970 NYCTA Graphics Standards Manual, https://standardsmanual.com/products/nyctamanual; `docs/DESIGN_SYSTEM.md`). It reads "0 duplicated Mons" when Law 6 holds. When it does not, the band turns `danger` and the same strip appears at the top of every console screen until the count is zero.
- **Everything else is a tool.** No backgrounds from `packages/ui/backgrounds`, no three.js, no text effects, no skyline under the nav. The NYC-Tron vocabulary stays as shape: square corners by default, a corner cut on the one primary action per screen, notch geometry on the active nav item, keylines instead of shadows.
- **Orange keeps its canon jobs only** (Decision #7): the face of the primary action and the "Ready to hatch" egg badge. Never text, never a status colour for anything else.

## Themes

| Scheme | When | Look |
|---|---|---|
| Daylit (default) | follows the OS appearance; staff can pin it in Settings | `bg`/`surface` `concrete-50`, raised panes `white`, text `signage-black`, muted `concrete-600`, keylines `border` (`concrete-200`), focus and links `accent` (`royal-500`). No glow (the `glow` token is transparent in light). |
| Night | follows the OS appearance; staff can pin it | the existing dark semantic set unchanged: `night` page, `surface-raised` `#0A1230`, text `#F8F8F8`, muted `silver`, focus `carolina`. Glow only on focus and on the active nav item. |

Decision #4 says auth and settings follow the OS appearance and only the companion shell follows the clock. The console is a staff tool, so it follows the OS, with a three-way override in Settings: "Match system", "Daylit", "Night". Payload's own `admin.theme` stays `'all'` so Payload's `useTheme` agrees with ours; the console reads its scheme from its own store and sets the `scheme-dark` class (`NIGHT_SCHEME`, `packages/ui/NightScope.tsx`) on the console root.

The kit's night facades (`DataTable`, `Card` cornerCut, `StatCard`, `Dialog`) are night on every page today (`NightScope.tsx` comment). A page of night tables on concrete is too heavy for an eight-hour tool, so the console needs a `surface="page"` variant on `DataTable`, `StatCard` and `Card` that follows the semantic tokens. That is a kit change with stories first (`04-components.md`, G1).

## Type and density

Families stay Archivo Black (`display`) and Space Grotesk (`sans`). The mobile scale in `docs/DESIGN_SYSTEM.md` is for the game; the console uses a denser scale, proposed here for the theme owner (sizes do not need a contrast row; colours do, and every colour below is already measured):

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `console-station` | 24 / 30 | Archivo Black | the one `h1` per screen ("Callers"). Sentence case. |
| `console-title` | 18 / 24 | Space Grotesk 700 | pane and section headings (`h2`, `h3`) |
| `console-body` | 15 / 22 | Space Grotesk 400 | detail text, key/value values |
| `console-cell` | 14 / 20 | Space Grotesk 400 | table cells; tabular figures for every number, id and time |
| `console-label` | 13 / 18 | Space Grotesk 500 | column headers, field labels, badges |
| `console-caption` | 13 / 18 | Space Grotesk 400 | hints, timestamps under a value; never smaller |

Rules: sentence case everywhere, no all-caps labels, no eyebrows over headings. Ids are set in Space Grotesk with `tabular-nums`; no monospace face.

Density: 4 pt grid. Table rows are 44 px tall at every width so a row is a valid touch target on a touch laptop or a tablet (WCAG 2.5.5 target, Apple HIG 44 pt). Cell padding 12 px horizontal, 12 px vertical. Pane padding 16 px at `compact`, 24 px from `medium` up. Gaps between sections 24 px; between a label and its value 4 px.

## Information architecture

Seven sections. Role gates assume the staff roles in blocker B2 (`ops`, `support`, `consent`, `content`); until B2 lands every staff member is `admin` and sees everything.

| Section | Route under `/admin` | Shape | Roles | Data (Local API, `overrideAccess: false`, `user: req.user`) |
|---|---|---|---|---|
| Overview | `/overview` (`/admin` redirects here) | nav + detail | all | counts from `users`, `guardian-consents`, `eggs`, `mon-instances`, `audit-events` |
| Callers | `/callers`, `/callers/:callerId` | nav + list + detail + inspector | ops, support | `users` (Callers only: `role` = `user`), Better Auth `accounts` (provider ids only), `sessions` (count), `passkeys` (count), `mon-instances` by `callerId` |
| Consent queue | `/consent`, `/consent/:consentId` | nav + list + detail + inspector | ops, consent | `guardian-consents` (B1) |
| Mons and eggs | `/mons`, `/mons/:monInstanceId`, `/eggs`, `/eggs/:eggId`, `/integrity` | nav + list + detail + inspector | ops, support (read) | `mon-instances`, `eggs`, care state (B1); `@acme/core` schemas for parsing |
| Content | `/content`, `/content/bloodlines/:bloodlineId`, `/content/eggs` | nav + list + detail | ops, content | `@acme/content` (`bloodlines`, `eggs`), parsed with `@acme/core` schemas. Read-only. |
| Audit log | `/audit`, `/audit/:eventId` | nav + list + detail | ops (all events), each role (its own events) | `audit-events` (B1) |
| Settings | `/settings`, `/settings/staff` | nav + detail | all; Staff is ops only | the signed-in staff member's `users` row, `passkeys`, `sessions`; `users` with a staff role |
| Sign in | `/login` | single card | public | Better Auth through `@acme/auth` |

`/admin/account` (Payload's account view) redirects to `/admin/settings`. Every stock collection route (`/admin/collections/*`) redirects to the console route that owns that record, or to `/admin/overview` (`04-components.md`, "Payload seams").

Better Auth's generated collections (sessions, accounts, verifications, passkeys) and `media` never get a console screen. Their counts appear on the Caller detail; their values never do.

## Layout: adaptive panes

The console is built on the cross-platform split view (`apps/mobile/src/navigation/split-view/README.md`, `AdaptiveSplitView.tsx`), which is moving into `@acme/ui` as `AdaptivePanes` with fold awareness, ported from MoyoLearn (`packages/ui/adaptive-panes/README.md` there). Pane roles:

| Pane | Kit slot | Holds |
|---|---|---|
| Sidebar | `Column` 1 (primary) | console nav: wordmark, seven sections, staff menu |
| List | `Column` 2 (supplementary) | the section's table, its search and filters |
| Detail | `detail` | the selected record |
| Inspector | `Inspector` | the record's trail: audit events for this target, consent timeline, integrity evidence |

Width classes are the Material 3 classes already in the split view's `constants.ts`: `compact` 0, `medium` 600, `expanded` 840, `extraLarge` 1200 (dp, which is CSS px on web). Pane widths come from the `pane-*` tokens in `packages/theme/tokens.ts` (`pane-primary` 20rem, `pane-primary-narrow` 16rem, `pane-supplementary` 21rem, `pane-inspector` 20rem). Nothing in the console names its own breakpoint.

### Per width class

| Class | Sidebar | List | Detail | Inspector | Section nav | Dialogs |
|---|---|---|---|---|---|---|
| `extraLarge` ≥1200 | full (`pane-primary`) | yes | flex | drawer over the trailing edge of the detail, opened by "History" | sidebar | `Dialog`, centred |
| `expanded` 840–1199 | narrow (`pane-primary-narrow`) | yes | flex | not rendered; its content is a "History" section at the end of the detail | sidebar | `Dialog`, centred |
| `medium` 600–839 | hidden | yes | flex | as `expanded` | bottom `TabBar` | `Dialog`, centred, `size="sm"` |
| `compact` <600 | hidden | one pane at a time: list, then detail pushed over it | | as `expanded` | bottom `TabBar` | `BottomSheet` |

- The bottom `TabBar` has five tabs: Overview, Callers, Consent, Mons, More. More opens a `BottomSheet` with Content, Audit log and Settings. Tabs a role cannot use are not rendered, so a support agent sees Overview, Callers, Mons, More.
- On `compact`, the detail carries a back control in its `Toolbar` (`DetailNavbar` in the split view) that returns to the list with the scroll position and the selected row kept (column position lives in the split view's Zustand store).
- Two-pane screens (Overview, Settings) use the two-pane shape: sidebar + detail.
- There is no horizontal page scroll at any width. Tables follow the responsive rules below.

### Responsive tables

`DataTable` today keeps about 112 px per column and scrolls sideways inside its frame (`packages/ui/DataTable.tsx`, the `minWidth: columnCount * 112` line). The console needs two more layouts, chosen by the width of the pane the table sits in, not the window (a list pane is 21rem wide on a 1440 screen):

1. **Priority columns** (pane width ≥ 600): every column has a `priority` 1–4. Columns are dropped from 4 upwards until the rest fit; dropped values move into the row's expanded area, opened by a disclosure button at the row end. Priority 1 never drops.
2. **Record rows** (pane width < 600, which includes every list pane at 21rem): each row becomes a two-line record. Line 1 is the priority-1 value (the record's name or id) with the status badge trailing; line 2 is the priority-2 and priority-3 values as `console-caption`, separated by commas. The whole row is one link to the detail, 56 px tall minimum. Sorting moves to a "Sort" `Select` above the list.

Both layouts keep `<table>` semantics on web (`04-components.md`, G2): record rows are still table rows with the header row visually hidden, so screen readers keep column names.

### Foldables

Width class decides which panes are visible. Fold geometry decides where a visible pane boundary lands (the `AdaptivePanes` rule from MoyoLearn). The console's own rule on top: **a hinge never splits a table, a form, a dialog, a key/value pair or the integrity band.** A pane boundary, or a gap the width of the hinge, lands on the fold.

| Posture | Detection on web | Layout |
|---|---|---|
| Flat or non-separating fold (phone folded, tablet, laptop) | `window.viewport.segments` has one rect | width class only, as above |
| Book (vertical hinge, two side-by-side segments) | `@media (horizontal-viewport-segments: 2)`; `window.viewport.segments` gives both rects | List in the leading segment, detail in the trailing one, boundary on the hinge. The sidebar does not get a column: section nav becomes a `Select` ("Section") at the top of the list segment. The inspector opens as a drawer capped to the trailing segment. No bottom bar, because a bar across both segments would put a tab on the hinge. |
| Tabletop (horizontal hinge, two stacked segments) | `@media (vertical-viewport-segments: 2)` | Top segment shows content: the selected record's detail, or on Overview the integrity band and tiles. Bottom segment shows controls: the list with its search, and the record's actions. Dialogs and sheets open inside the bottom segment only. Tables sit wholly in one segment and scroll inside it. |
| Tri-fold (two vertical hinges, three segments) | `horizontal-viewport-segments: 3` | One pane per segment: sidebar, list, detail. The inspector is capped to the trailing segment and overlays the detail there. |

Web fold data comes from the Viewport Segments API (Chrome and Edge 138+, live on Android and Windows: https://developer.chrome.com/blog/viewport-segments-api-shipped, https://developer.mozilla.org/docs/Web/API/Viewport_Segments_API) and the Device Posture API (https://www.w3.org/TR/device-posture/). MoyoLearn's `use-fold-layout.web.ts` returns no folds, so the `@acme/ui` port needs a web fork that reads `window.viewport.segments` (gap G13). In a browser without the API the console is hinge-blind and falls back to width classes; the test matrix records that as a known limit rather than a pass.

## Screens

Each screen has one `h1` (`console-station`), set in the pane that is the screen's subject: the list pane on list screens, the detail pane on two-pane screens.

### Overview

Purpose: tell Mike in one look whether anything is wrong.

1. **Integrity band** (full width of the detail pane). Black band, white type: "0 duplicated Mons" with "Checked 2 min ago" under it and a "Run check" button. Non-zero: the band uses `danger`, reads "2 duplicated Mons", and its button is "Review duplicates" (→ `/integrity`). The band is the only Archivo Black after the `h1`.
2. **Queues** (row of `StatCard`, page surface): Consents pending; Consents expiring within 7 days; Parent requests open; Account deletions scheduled. Each tile links to the filtered list.
3. **Hatching** (row of `StatCard`): Eggs incubating; Eggs ready to hatch; Hatched in the last 24 h; Hatches not yet server-confirmed. No sparkline unless the data has a time series; no trend arrows.
4. **Recent activity**: the last 8 audit events as a `DataTable` (record rows on narrow panes), "Open audit log" link.

States: loading (skeleton tiles, band shows "Checking…" in white on black), error per block (a block that fails shows its own `ErrorMessage` with "Try again"; the others still render), blocked by B1 (a block whose collection does not exist shows "Not connected yet" and the collection name, never a zero).

### Callers

Purpose: find one Caller fast and act on a request.

- **List.** Search first: one `SearchBar` labelled "Find a Caller", matching an exact email or a Caller id. Support sees no rows until they search (D-A3). Ops sees the 50 most recent by default. Filters (chips): Consent status, Age band, Deletion scheduled. Columns, by priority: 1 Caller (masked email, or the Caller id when the email is masked), 2 Age band, 3 Consent status, 4 Mons, 4 Joined, 4 Last sync.
- **Detail.** `KeyValueList` sections:
  - Identity: Caller id (copy button), Email (masked for 13–17; "Show" reveals, logged), Name (masked for 13–17), Age band ("Show year" reveals, logged), Email verified.
  - Sign-in: providers linked (Email, Apple, Google, Passkey: names only), active sessions (count), "Sign out everywhere" (confirm dialog, audited).
  - Consent: status badge; for `pending` a link to the consent record.
  - Mons: the Caller's Mons as record rows (form name, Bloodline, hatched date), each linking to `/mons/:id`.
  - Danger zone (bottom, ops and support): "Schedule account deletion". When scheduled, a `danger` banner at the top of the detail: "Deletion scheduled for 11 October 2026" with "Cancel deletion".
- **Inspector / History:** audit events whose target is this Caller, newest first.

### Consent queue

Purpose: keep every guardian consent moving and every deletion provable, while holding the least data about the child.

- **Lanes** (`SegmentedControl` with counts): Pending · Expiring · Parent requests · Closed. If counsel picks a consent method that needs a human check (B3), a fifth lane, Needs review, appears first.
- **List.** Columns: 1 Consent id (short form, copy in detail), 2 Status, 3 Expires (relative and absolute), 4 Emails sent, 4 Created. No child name column exists, because no child name exists.
- **Detail.** Parent email (masked; "Show" logged), Child's age band ("Under 13"; the stored year shows only through "Show year", logged), Status, Created, Expires, Consent emails sent (count and last sent). Actions:
  - "Resend consent email": once per 24 h per record; disabled with the time it unlocks.
  - "Delete this record now": for a parent's deletion request or a withdrawn request. Type-to-confirm dialog; writes a deletion receipt.
  - Needs review lane only (B3): "Approve" and "Deny", separated by the full row width, each with a reason `Select`, never free text.
- Denied, expired and deleted consents show the receipt: who, when, which reason code. A denied consent's detail says what happened to the Mon, in Decision #15's terms (`05-copy.md`).
- **Inspector / History:** the consent timeline (created, each email, parent response, decision, deletion).

No field on this screen accepts free text (D-A2).

### Mons and eggs

Purpose: answer "where is my Mon?" and prove Law 6 holds. Read-only end to end (D-A5).

- **Tabs in the list pane:** Mons · Eggs · Integrity.
- **Mons list:** 1 Mon (form name, or nickname in the detail only), 2 Bloodline, 3 Caller (Caller id, links to the Caller), 4 Stage, 4 Hatched, 4 Server confirmed.
- **Mon detail:** Mon id (copy), Egg id (link), Species (Dex number, form name, Bloodline), Nickname, Stage, Hatched at, Bond (as a value 0–100 with a `ProgressBar`), Care: Energy, Fullness, Social as read-only `ProgressBar`s, Last applied write (`lastAppliedSeq`), Last update. Integrity for this Mon: "Id matches its egg" ✓/✗ (UUIDv5 recomputed, ADR 0001), "Only Mon from this egg" ✓/✗.
- **Eggs list:** 1 Egg (egg name, e.g. "Metro Egg"), 2 State (Incubating / Ready to hatch / Hatched), 3 Caller, 4 Incubation (15, 30 or 60 min), 4 Ends at.
- **Integrity tab:** a checklist (Klaviyo-review shape, `02-references.md`):
  1. Mons sharing one egg: expected 0.
  2. Mon ids that don't match their egg: expected 0.
  3. Hatched eggs with no Mon, or Mons whose egg isn't marked hatched: expected 0.
  4. Eggs ready for more than 7 days and not hatched: informational, not a failure.
  Each row shows the count, a pass/fail mark, "Last checked", and opens the matching records. A failing check opens with the evidence (both instances side by side, their Callers, creation times, and the audit events around them) and the note "Fix this in the database with a migration. The console never deletes a Mon."

No button on any Mons or Eggs screen writes data.

### Content

Purpose: see what `@acme/content` shipped and what is still `TODO(canon)`.

- Banner at the top of the list pane: "Content ships in code. Changes go through a pull request to packages/content." With the content package version.
- **Bloodlines list:** 1 Bloodline ("Hood Ratti Bloodline", rendered as `${bloodlineName} Bloodline` per `BloodlineSchema`), 2 Id (`F01`), 3 Forms, 4 Open TODO(canon) count.
- **Bloodline detail:** the evolution tree as a nested `List`: Egg → Baby → Small → Mid → each Max. Each node: Dex number, form name or a `TODO(canon)` badge, stage, number of authored evolution events (Phase 1: none, Law 7). Per form, a `KeyValueList` of `MonSpeciesDef` fields; every null field shows the `TODO(canon)` badge, never a blank or a guess (Law 1).
- **Eggs:** the three starter eggs in slot order (`@acme/content` `eggs`): egg name, Dex number, hatches into.

### Audit log

Purpose: prove who did what, without becoming a second copy of personal data.

- Filters: Actor, Action, Target type, Date range, plus "Exact id" search. Columns: 1 When, 2 Action (plain label; the code `consent.denied` in the detail), 3 Target (type and short id), 4 Actor, 4 Reason.
- Detail: When (local time, UTC, ISO 8601), Who (staff name and role at the time), What (action, target type, target id with a link if the target still exists), Why (reason code and label). Never a revealed value, never an email.
- "Events can't be edited or deleted." states the append-only rule as a line under the `h1`.
- Export: ops only, and the export itself is an audit event.

### Settings

- Appearance: `SegmentedControl` Match system / Daylit / Night.
- Your sign-in: passkeys (list, "Add a passkey", remove), active sessions (this one marked), "Sign out other sessions".
- Staff (ops only, `/settings/staff`): staff list with role; "Add staff" creates a staff account with a role; "Change role" and "Remove access". Each is audited. Blocked by B2.

### Sign in

The payload-better-auth plugin replaces Payload's login view with its own and sets `views.login` itself (repo: `packages/payload/src/admin/components.ts` comment; plugin `injectAdminComponents`). Ours goes in through the plugin option `admin.loginViewComponent`, with `admin.login.requiredRole` set to the staff roles, `enablePasskey: true`, `enableSignUp: false` and `enableSocial` off. Payload renders a replaced login inside its `MinimalTemplate` (`getRouteData.js`: a custom view over a built-in key gets `templateType = 'minimal'`), so the console login fills that template edge to edge.

Layout: concrete page, centred `Card` (page surface, corner cut top-left) 400 px max, `BrandWordmark` above it from the repo (never redrawn), `h1` "Sign in to the console", Email + Password, "Sign in" (cta, corner cut), a rule, "Use a passkey" (outline). "Forgot password" shows only when Better Auth's reset is enabled (ADR 0001: reset is disabled until Resend is configured). No sign-up link. A signed-in account without a staff role sees "This console is for NYC-MON staff." and "Sign out".

## Decisions made here

Recorded per `product-decisions` rules (BUILD / STRIKE / DEFER), numbered `D-A#` for this folder.

| # | Decision | Verdict | Why |
|---|---|---|---|
| D-A1 | Personal fields of 13–17 Callers (email, name, birth year) and all guardian data are masked by default; each reveal needs a reason and writes an audit event | BUILD | Risk 1 in `01-research.md`; reveal-with-reason keeps support possible without making browsing free |
| D-A2 | No free-text input on consent records or audit reasons; reasons are fixed codes | BUILD | A notes field is where a child's name would enter the database (ADR 0001 collects none) |
| D-A3 | Support sees Callers search-first (no default list); ops sees a default list | BUILD | Least exposure for the role that needs one record at a time |
| D-A4 | Staff cannot skip the 7-day account-deletion grace or bulk-delete anything | BUILD | BUILD_PROMPT_v3 M20; risk 2 |
| D-A5 | Mons and eggs are read-only in the console; integrity failures are fixed by migration, not by a button | BUILD | Laws 6 and 8; a "delete duplicate" button would delete a Mon |
| D-A6 | Content is read-only in the console; editing content in Payload | STRIKE | `@acme/content` is code parsed by `@acme/core` (Law 5); a second source would fork canon (Law 1) |
| D-A7 | Console follows OS appearance with a manual override, not the clock | BUILD | Decision #4 reserves the clock for the companion shell |
| D-A8 | Charts on Overview | DEFER | No time series exists before B1 lands; revisit when `audit-events` and `mon-instances` have 30 days of data |
| D-A9 | Bottom `TabBar` at `medium` instead of a navigation rail | BUILD | The kit has `TabBar` with stories; a rail is a new component for one width class. Revisit if tablet staff ask for it. |
