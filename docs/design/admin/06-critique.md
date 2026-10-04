# Ops console: critique

Owner: `design-director`. Written 2026-10-04. A heuristic pass (Nielsen's ten, https://www.nngroup.com/articles/ten-usability-heuristics/) and a design critique of `03-direction.md`, `04-components.md` and `05-copy.md` before anything is built. Nothing is on screen yet, so every finding is against the spec.

Verdict: a sound plan with three blockers that stop it shipping, and a handful of spec fixes that are cheap now and expensive later.

## Blockers

| # | Blocker | Why it blocks | Unblocks when |
|---|---|---|---|
| X1 | Collections missing: `guardian-consents`, `eggs`, `mon-instances`, care state, `audit-events` (B1) | Four of seven sections, and the integrity band, read data that has no table. The audit requirement (every reveal and deletion logged in the same transaction) has nowhere to write. | `platform` adds the collections with the fields in `08-handoff.md` §4 and Payload migrations |
| X2 | No staff roles (B2) | Masking by role, search-first for support, consent-only access and owner-only export can't be enforced. Every staff member is a full admin, which defeats D-A1 and D-A3. | `users.role` gains staff values (or a separate `staffRole`), the plugin's `login.requiredRole` and `hasAdminRoles({ adminRoles })` list them, and access functions read them |
| X3 | `@acme/ui` can't render in `apps/admin-vite` (B4) | No react-native-web alias, no `.web.*` resolution, Payload's CSS variables (`--color-bg`, `--color-border`, `--color-text`) collide with the theme's, the root barrel drags in Skia, three.js and WebGPU | the platform prerequisites in `08-handoff.md` §1 are done and one kit component renders in a console route |

Not blockers, but they gate parts of the design: B3 (consent method, decides whether "Needs review" exists), B5 (parent-request deadline and receipt retention, decides the "Due by" column), and the web fold API (G13; without it the console is hinge-blind on foldables).

## Heuristics

**H1 Visibility of system status**
- The integrity band says when it last checked and lets ops run a check; good. Spec gap: the band must say "Checking…" while a check runs and must not show a stale 0 after a failed check. Fixed in `03-direction.md` (loading state) and `05-copy.md` (`admin.overview.band.checking`); the failed-check state still needs a string: use `admin.block.error` inside the band.
- Every mutating action ends in a toast that repeats the action's name ("Deletion scheduled for 11 October 2026"). Keep that pairing in the build; reviewers check button text against toast text.
- A block whose collection doesn't exist says "Not connected yet" instead of 0. This matters most for the integrity band: a 0 from a missing table would be a false all-clear.

**H2 Match with the real world**
- Staff language is plain ("Hidden", "Show", "Schedule deletion"); jargon like PII, redact, purge is out. Canon terms stay (Caller, Bloodline), which matches what staff hear from Callers.
- Risk: "Server confirmed" is engineering language. Support may not know what an unconfirmed hatch means for the Caller. Add a one-line hint in the Mon detail: "The H-Lynk showed the hatch; the server hasn't saved it yet." (to `ux-writer`).

**H3 User control and freedom**
- Deletion has a 7-day undo (cancel) and the cancel is on the same screen as the banner. Good.
- Showing a hidden value can be undone with "Hide", and leaving the screen re-hides it.
- Consent record deletion is immediate and has no undo, by law (312.5(c)(1) requires it). The dialog says so; the receipt is the only trace. Correct as designed.

**H4 Consistency and standards**
- Fixed in this spec: `TabBar` uses tab roles for route navigation (G15) and `BottomSheet` lacks `aria-modal` (G9). Both are kit defects the console would otherwise inherit.
- The kit's night facades vs a daylit console (G1). Without G1 the console mixes night tables with daylit panes, which reads as two products.
- Status colours: denied is neutral, not red, everywhere it appears (badge, receipt, audit label). Keep it consistent or the reviewer will read "denied" as a failure to fix.

**H5 Error prevention**
- Type-to-confirm with the last 6 characters of the record id, a required reason, and the button disabled until both are set (G8). Destructive and approving buttons never sit side by side (Needs review lane spec).
- No bulk destructive actions (D-A4). Bulk selection exists only for resend and id export.
- Gap: two staff could act on the same consent record at once. The build needs an optimistic check (`updatedAt` match) and a "This record changed while you were looking at it" error. Added to `08-handoff.md`.

**H6 Recognition rather than recall**
- Filters show as chips with their values, lanes show counts, the Caller detail lists Mons by name. Staff never have to remember an id from another screen; copy buttons sit next to every id.
- Record rows on narrow panes keep three values per row (priority 1–3), enough to pick the right Caller without opening each.

**H7 Flexibility and efficiency**
- Exact-id search on Callers and Audit log; deep links for every record (`/admin/callers/:id`), so a support ticket can carry a link.
- Missing: keyboard shortcuts. A `/` to focus search and `j`/`k` for the next and previous row would help daily users. DEFER until staff ask; it is easy to add on top of row links.

**H8 Aesthetic and minimalist design**
- One bold element (the integrity band), no backgrounds, no charts (D-A8). The Overview is four blocks.
- Watch: the Caller detail has five sections. On `compact` that is a long scroll; Danger zone sits last on purpose so it is never the first thing a thumb lands on.

**H9 Error recovery**
- Each error string says what happened and what to do ("Deletion wasn't scheduled. Nothing changed. Try again."). Partial failures on the Overview stay per block.
- Gap: when a reveal's audit write fails, the value must not show. Spec'd in `08-handoff.md` (reveal is server-side and atomic with its audit event).

**H10 Help and documentation**
- The two rules staff most need are on screen where they act: the consent rule line ("We hold a parent's email and the child's birth year only to ask for consent…") and the read-only line on Mons. No separate help page in Phase 1.

## Design critique

**First impression.** On a 1440 screen the eye goes to the black band first, which is correct: it is the one P0 signal. On a phone, the band sits above the fold too, then the queue tiles.

**Hierarchy.** One Archivo Black `h1` per screen plus the band headline; everything else Space Grotesk. Section headings at 18 px against 15 px body is a small step; if walkthroughs show sections blurring, raise `console-title` to 20 px before adding rules or colour.

**Consistency with NYC-Tron.** Corner cuts on the primary action and the sign-in card, notch on the active nav item, square everywhere else. That is the kit's own rule ("components have no rounded corners unless asked", `packages/ui/README.md`). The console drops the kit's glow, skyline and backgrounds on daylit, which `docs/DESIGN_SYSTEM.md` already prescribes ("On daylit pages the vocabulary is drawn as hard keylines and solid faces, without the glow").

**What works.** Masking by default with reveal-and-log; read-only Mons with a migration note instead of a fix button; root custom views so no Payload chrome renders; a single place (`components.ts`) that owns every route.

## Priority actions

1. Land X1 and X2 together: the audit collection and staff roles are what make the privacy design real. Without them the console is a list of personal data with no trail.
2. Land the platform prerequisites (X3) and G1/G2 next; every screen depends on a page-surface, server-mode `DataTable`.
3. Build Callers first (search, detail, masking, deletion), because it exercises every risky pattern: reveal, audit, destructive confirm, responsive table and the inspector.
