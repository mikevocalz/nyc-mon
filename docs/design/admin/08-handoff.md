# Ops console: handoff

Owner: `design-director`. Written 2026-10-04. The implementation contract for the custom Payload admin console (LAWS R4: this file is the gate). Reads with `03-direction.md` (what and why), `04-components.md` (components, kit gaps, verified Payload seams), `05-copy.md` (strings), `07-a11y.md` (accessibility). Status: **ready for platform prerequisites and kit work; screens blocked on X1–X3** (`06-critique.md`).

Owners: `platform` (prerequisites, collections, endpoints, registration), kit owner (`packages/ui` gaps G1–G19, H1–H6, stories first), console builder (views under `packages/payload/src/admin/console/`).

## 1. Platform prerequisites

From the admin-vite infra work (commits `c9cbff8`, `f12672d`; ADR 0003). None of the console renders until these hold.

| # | Prerequisite | Detail | Done when |
|---|---|---|---|
| P1 | react-native-web in admin-vite | Port the `react-native` → `react-native-web` alias and the `.web.*` extension resolution order from `apps/storybook/.storybook/main.ts` into `apps/admin-vite/vite.config.ts`, for the client and RSC environments | a `@acme/ui` `Button` renders in a console route |
| P2 | Theme scoping | Payload 4 defines `--color-bg`, `--color-border`, `--color-text` and others; Tailwind preflight resets Payload's elements. Scope the `@acme/theme` CSS to the console root (`.nycmon-console` on `html.Page`) or a cascade layer below Payload's, and never load preflight globally | Payload's `MinimalTemplate` around sign in and the console both render correctly on one page load |
| P3 | Narrow kit entry | `@acme/ui/admin` (G19) re-exports only the console's components. The root barrel pulls in Skia, three.js and WebGPU | the admin client bundle contains no `canvaskit`, `three` or `typegpu` module |
| P4 | Nitro externals | Every package the console imports that Nitro externalises is a direct `apps/admin-vite` dependency (ADR 0003 "pnpm is isolated here") | `pnpm --filter admin-vite build` and the Vercel output boot |
| P5 | Tailwind v4 | Tailwind 4 PostCSS config taken from `apps/storybook`; `react-native-css` for web styling as in `packages/ui/tw.tsx` | kit classes resolve in the console |
| P6 | Collections (X1) | §4 below | migrations applied in dev |
| P7 | Staff roles (X2) | §4 below | `hasAdminRoles({ adminRoles })` and the plugin's `login.requiredRole` read the staff roles |
| P8 | Fold data on web (G13) | `AdaptivePanes` web fork reads `window.viewport.segments` | `AdaptivePanes/BookFold` story passes |

## 2. Build order

1. P1–P5, then one smoke route (`/admin/overview` rendering a kit `Heading`).
2. HTML primitives H1–H6 and kit gaps G1, G2, G3, G5, G6, G7, G8, G9, G14, G15, G16, G17, G19, each with its story and a Storybook a11y addon pass.
3. P6, P7 and the console endpoints (§5).
4. Shell + Callers (it exercises reveal, audit, destructive confirm, responsive table, inspector).
5. Consent queue, Audit log, Settings, Sign in.
6. Mons and eggs + Integrity (G11, G12, G18), Overview.
7. Content.
8. Redirects for every stock route; `pnpm --filter admin-vite payload:importmap`; the full test matrix (§8).

## 3. Routes

All registered in `packages/payload/src/admin/components.ts` (`adminComponents.views`), component paths `./admin/console/<File>#<Export>`. Root custom views render with no Payload template (`04-components.md` §5).

| Route | View key → Component | Panes | Roles | `h1` |
|---|---|---|---|---|
| `/admin` | `dashboard` → `DashboardRedirect` | — | staff | — (redirect to `/admin/overview` via `req.server.redirect`) |
| `/admin/overview` | `overview` → `OverviewView` | sidebar + detail | all staff | Overview |
| `/admin/callers/:callerId?` | `callers` → `CallersView` | sidebar + list + detail + inspector | ops, support | Callers |
| `/admin/consent/:consentId?` | `consent` → `ConsentView` | sidebar + list + detail + inspector | ops, consent | Consent queue |
| `/admin/mons/:monInstanceId?`, `/admin/eggs/:eggId?`, `/admin/integrity` | `mons`, `eggs`, `integrity` → `MonsView` | sidebar + list + detail + inspector | ops, support | Mons |
| `/admin/content/:rest*` | `content` → `ContentView` | sidebar + list + detail | ops, content | Content |
| `/admin/audit/:eventId?` | `audit` → `AuditView` | sidebar + list + detail | all staff (own events), ops (all) | Audit log |
| `/admin/settings`, `/admin/settings/staff` | `settings` → `SettingsView` | sidebar + detail | all; staff tab ops only | Settings |
| `/admin/account` | `account` → `AccountRedirect` | — | — | → `/admin/settings` |
| `/admin/login` | plugin `admin.loginViewComponent` → `ConsoleLogin` | single card | public | Sign in to the console |
| `/admin/collections/users/**` | `users` `views.list.Component`, `views.edit.root.Component` → `CollectionRedirect` | — | — | → `/admin/callers[/:id]` |
| `/admin/collections/<other>/**` | same on every collection | — | — | → `/admin/overview` |

Query parameters are state, so links are shareable: `?q=` search, `?lane=` consent lane, `?status=`, `?age=`, `?sort=joined.desc`, `?page=`, `?history=1` (inspector open). Detail ids are path segments.

Plugin options in `payload.config.ts`: `admin: { loginViewComponent: './admin/console/ConsoleLogin#ConsoleLogin', enableManagementUI: false, login: { requiredRole: STAFF_ROLES, enablePasskey: true, enableSignUp: false } }`. Every collection: `admin.hidden: true`. `admin.theme: 'all'`. `graphics.Logo` → `ConsoleLogo` (`BrandWordmark height={32}`), `graphics.Icon` → `ConsoleIcon` (`BrandLogo size={28}`), `Nav` → `ConsoleNavFallback`.

## 4. Data: collections the console needs (X1, X2)

Proposals for `platform`; the field names are the contract the views read. All live in `packages/payload/src/collections/`, schema `payload`, with Payload migrations. Shapes follow `@acme/core` where a schema exists (Law 5).

**`users` (existing) — add:**
- `role` options gain `ops`, `support`, `consent`, `content` (or a separate `staffRole` select; either way the plugin `requiredRole` and `hasAdminRoles({ adminRoles })` list them). Callers keep `user`.
- `deletionScheduledFor` (date, nullable), `deletionScheduledBy` (relationship → users, staff), `deletionReason` (select of reason codes). Field access: update by ops/support only.

**`guardian-consents` (new; ADR 0001 "Age and consent"):** `parentEmail` (email), `birthYear` (number), `status` (select `pending | approved | denied | expired`, mirrors `ConsentStatusSchema` minus `not-required`), `expiresAt` (date), `emailsSent` (number), `lastEmailSentAt` (date), `parentRequest` (select `none | review | delete`). **No text field of any kind.** Read: ops, consent. Never exposed over anonymous REST.

**`eggs`, `mon-instances` (new; ADR 0001 `/v1`):** fields as `EggRecordSchema` and `MonInstanceSchema` (`packages/core/schemas/egg.ts`, `mon.ts`) plus `hatched` (checkbox) on eggs and `serverConfirmedAt` on instances; unique index on `eggs.eggId` and `mon-instances.eggId`. Care state as `CareStateSchema` plus `lastAppliedSeq`. Read: ops, support. No create, update or delete from the console.

**`audit-events` (new):** `at` (date, indexed), `actor` (relationship → users), `actorRole` (text snapshot of the role at the time), `action` (select of the codes in `05-copy.md` "Action labels"), `targetType` (select `caller | consent | mon | egg | staff | audit | integrity`), `targetId` (text, indexed), `reasonCode` (select), `requestId` (text). Access: `create`, `update`, `delete` → `false` for every role (written only by server code with `overrideAccess: true` and `req`), `read` → ops all, others `actor equals self`. Never stores an email, name, birth year or revealed value.

**`integrity-runs` (new):** `at`, `trigger` (`manual | scheduled`), `actor` (nullable), `sharedEgg`, `idMismatch`, `orphans`, `staleReady` (numbers). The Overview band reads the latest row.

## 5. Data access and mutations

### Reads (server components)

Each view is a React Server Component receiving `AdminViewServerProps`. It reads with the Local API through `initPageResult.req`:

```ts
const { req } = initPageResult;
const callers = await req.payload.find({
  collection: 'users',
  where: { role: { equals: 'user' }, ...searchWhere },
  select: { email: true, name: true, birthYear: true, consentStatus: true, createdAt: true, deletionScheduledFor: true },
  sort: '-createdAt',
  limit: 50,
  page,
  depth: 0,
  user: req.user,
  overrideAccess: false,
  req,
});
```

- Always `user: req.user, overrideAccess: false` (payload skill, "Local API Access Control"). Always `select` and `depth: 0`.
- **Masking happens on the server.** A view maps each doc to a view model where hidden fields are already the mask string; the unmasked value never reaches the client bundle or the RSC payload.
- Age band is computed server-side from `birthYear` with `needsGuardianConsent` (`packages/payload/src/auth/age.ts`) plus the 18 boundary; the year itself is dropped from the view model.
- Content reads `@acme/content` directly and parses it with `@acme/core` schemas; no Payload call.
- Sessions, accounts and passkeys are read only as counts and provider ids (`payload.count`, `select: { providerId: true }`).

### Mutations (custom endpoints)

Root `endpoints` in `payload.config.ts`, served under `/payload-api/console/*` by admin-vite's `handleEndpoints`. Each handler: authenticate (`req.user`, staff role check), zod-parse the body (Law 5), open a transaction, write the change and its audit event with the same `req`, commit. Errors are thrown `APIError`s with a stable `code`; the client maps codes to `05-copy.md` strings.

| Endpoint | Body | Success | Errors (`code`) |
|---|---|---|---|
| `POST /console/reveal` | `{ targetType, targetId, field, reasonCode }` | `{ value }` | `FORBIDDEN_ROLE`, `NOT_FOUND`, `AUDIT_WRITE_FAILED` (value never returned) |
| `POST /console/callers/:id/deletion` | `{ reasonCode, confirmText, expectedUpdatedAt }` | `{ scheduledFor }` (server time + 7 days) | `CONFIRM_MISMATCH`, `ALREADY_SCHEDULED`, `RECORD_CHANGED` |
| `DELETE /console/callers/:id/deletion` | `{ expectedUpdatedAt }` | `{}` | `NOT_SCHEDULED`, `RECORD_CHANGED` |
| `POST /console/callers/:id/sign-out-everywhere` | `{ reasonCode }` | `{ sessionsEnded }` | `NOT_FOUND` |
| `POST /console/consents/:id/resend` | `{}` | `{ lastEmailSentAt }` | `RESEND_LOCKED` (with `unlocksAt`), `NOT_PENDING`, `EMAIL_DISABLED` |
| `DELETE /console/consents/:id` | `{ reasonCode, confirmText }` | `{ receiptEventId }` | `CONFIRM_MISMATCH`, `NOT_FOUND` |
| `POST /console/consents/:id/decision` (B3 only) | `{ decision: 'approve' \| 'deny', reasonCode, expectedUpdatedAt }` | `{ status }` | `NOT_REVIEWABLE`, `RECORD_CHANGED` |
| `POST /console/integrity/run` | `{}` | `{ run }` | `RUN_IN_PROGRESS` |
| `POST /console/staff`, `PATCH /console/staff/:id`, `DELETE /console/staff/:id` | `{ email, role }` / `{ role }` / `{ reasonCode }` | staff row | `LAST_OPS` (can't remove the last ops), `NOT_STAFF` |
| `GET /console/audit/export` | query = filters | CSV stream | `FORBIDDEN_ROLE` |

`RECORD_CHANGED` comes from comparing `expectedUpdatedAt` with the row inside the transaction (two staff on one record, `06-critique.md` H5). The deletion job that runs after the grace period is the platform's; it writes `caller.deleted` with the same rules.

Client calls go through a small typed client in `packages/payload/src/admin/console/api.ts` that returns a result union `{ ok: true; data } | { ok: false; code }`, the same shape `@acme/auth` uses (ADR 0001 "What runs today").

## 6. State

Per Law 4 and the kit's per-instance store rule: no `useState` for business state. Each screen has one Zustand slice in `packages/payload/src/admin/console/stores/`: selection, open dialog, revealed values (cleared on route change), inspector open, appearance (persisted to `localStorage` in a try/catch, falling back to "Match system"). Server data comes from the RSC; after a mutation the view calls `router.refresh()` (`useRouter` from `@payloadcms/ui`).

## 7. Screen states and test IDs

`testID` on kit components becomes `data-testid` on web through react-native-web.

| Screen | States to build | Test IDs |
|---|---|---|
| Shell | sidebar, rail, bottom bar, book-fold select; integrity strip on/off | `console-nav`, `console-nav-{section}`, `console-tabbar`, `console-section-select`, `integrity-strip` |
| Overview | loading, ready, block error, block not connected, band healthy / failing / checking | `integrity-band`, `integrity-run`, `tile-{key}`, `overview-recent` |
| Callers list | search-first empty, results, no match, loading, error, filtered | `callers-search`, `callers-filters`, `callers-table`, `callers-row-{callerId}`, `pagination` |
| Caller detail | ready, value revealed, deletion scheduled, deletion pending (request in flight), error | `caller-detail`, `caller-id-copy`, `mask-{field}-show`, `mask-{field}-hide`, `caller-signout-all`, `caller-delete-schedule`, `caller-delete-cancel` |
| Destructive dialog | idle, text mismatch, ready, pending, error | `confirm-reason`, `confirm-input`, `confirm-submit`, `confirm-cancel` |
| Consent | each lane, empty lane, resend locked, receipt | `consent-lane-{lane}`, `consents-table`, `consent-detail`, `consent-resend`, `consent-delete`, `consent-receipt` |
| Mons / eggs | Mons, Eggs, Integrity tabs; check passing / failing / unavailable | `mons-tab-{tab}`, `mons-table`, `mon-detail`, `eggs-table`, `check-row-{key}` |
| Content | list, tree, TODO(canon) badges | `bloodlines-table`, `bloodline-tree`, `todo-canon` |
| Audit | filters, detail, export (ops) | `audit-filters`, `audit-table`, `audit-detail`, `audit-export` |
| Settings | appearance, passkeys, sessions, staff | `appearance-control`, `passkey-add`, `sessions-signout-others`, `staff-table` |
| Sign in | idle, submitting, credentials error, passkey unsupported, not staff | `login-email`, `login-password`, `login-submit`, `login-passkey`, `login-not-staff` |
| Inspector | closed, open, history section (below `extraLarge`) | `inspector-toggle`, `inspector` |

## 8. Test matrix

Playwright on admin-vite (`http://localhost:5174`) in daylit and night, plus the device rows. Each cell checks: no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`), the expected panes, nav form, table layout, dialog form, and 44 px minimum targets (bounding boxes of every focusable element).

| Width (CSS px) | Class | Panes on Callers | Nav | Callers table | Dialog |
|---|---|---|---|---|---|
| 320 | compact | one at a time | `TabBar` | record rows | sheet |
| 390 | compact | one at a time | `TabBar` | record rows | sheet |
| 768 | medium | list + detail | `TabBar` | record rows (list pane 21rem) | dialog `sm` |
| 1024 | expanded | narrow sidebar + list + detail, History in detail | sidebar | record rows | dialog |
| 1280 | extraLarge | sidebar + list + detail, inspector drawer | sidebar | record rows in list pane; Audit and Overview tables in priority-columns layout | dialog |
| 1440 | extraLarge | as 1280 | sidebar | as 1280 | dialog |

Foldable rows, Chrome on Android (138+) for the Viewport Segments API. Hardware where available; otherwise Android Studio's foldable emulator profiles with posture controls. A row that can't be run on hardware or an emulator is recorded as "not verified", never as a pass.

| Device / posture | Expected segments | Expected layout | Checks |
|---|---|---|---|
| Galaxy Z Fold, folded (cover screen) | 1 | compact | as 390 |
| Galaxy Z Fold, unfolded flat | 1 (non-separating) | width class only | as its measured class |
| Galaxy Z Fold, book (half-open, vertical hinge) | 2 side by side | list left, detail right, boundary on the hinge; section `Select`; no bottom bar | no table, form, dialog or key/value pair crosses the hinge rect from `window.viewport.segments` |
| Galaxy Z Fold, tabletop (half-open, horizontal hinge) | 2 stacked | detail top, list and actions bottom; dialogs in the bottom segment | same hinge check; dialog bounds inside the bottom segment |
| Pixel Fold, folded / unfolded / book / tabletop | 1 / 1 / 2 / 2 | as the Galaxy rows | as above |
| Tri-fold, fully open | 3 side by side | sidebar, list, detail, one per segment; inspector capped to the trailing segment | no pane crosses either hinge |
| Any foldable, browser without `window.viewport` | 1 | width class only | recorded as hinge-blind, not as a pass |
| Posture change mid-task (book → flat → tabletop) with a dialog open | — | dialog moves to the right segment, stays open | focus stays on the same element |

Accessibility rows (from `07-a11y.md`): axe zero violations per route and scheme; keyboard-only Callers task; VoiceOver + Safari and TalkBack + Chrome on the Callers table in record-rows layout; 200% zoom on Callers and Consent.

Behaviour rows:
- A support-role session sees no Callers until it searches; an ops session sees 50.
- Revealing an email writes exactly one `caller.value_shown` audit event; if the audit write is forced to fail, no value is returned.
- Scheduling deletion sets `deletionScheduledFor` to server time + 7 days; cancelling clears it; both are audited.
- Two sessions acting on one consent: the second gets `RECORD_CHANGED`.
- No route under `/admin` renders Payload's `DefaultTemplate` (assert the absence of Payload's nav and app header classes after every redirect).
- No console route bundle contains Skia, three.js or WebGPU code.

## 9. Acceptance

The console ships when every row in §8 passes or is recorded "not verified" with a reason, X1–X3 are closed, every kit gap it uses has a story with an a11y pass, the new contrast rows are in `packages/theme/contrast.ts` with `pnpm --filter @acme/theme test` green, and Mike has walked through Overview, Callers and Consent on a laptop and a phone.
