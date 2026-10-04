# Ops console: references

Mobbin queries (2026-10-04): web "admin dashboard users table with status badges, filters, search, and pagination in a left sidebar layout"; web "approval review queue with pending items list and detail pane with approve and deny buttons"; web "audit log table showing actor, action, target and timestamp with filter by event type"; web "delete account confirmation dialog requiring typing the name to confirm a destructive action"; web "admin sign in screen with email field and passkey button for an internal dashboard"; web "operations overview dashboard with a row of metric tiles and a needs-attention list of pending tasks"; iOS "mobile admin list of customers shown as stacked cards with status and a bottom tab bar". References inform hierarchy and behaviour, never pixels. The look is NYC-Tron (`packages/ui/README.md`).

Reference consoles in Mike's other repos: DVNT `packages/cms/src/payload.config.ts` (`admin.components.views.dashboard` mounts the ops console) and `apps/web/src/dashboard/AdminApp.tsx`; MoyoLearn `packages/payload/src/components/Logo.tsx` and `Icon.tsx` (`admin.components.graphics`).

## Lists and tables

| Ref | Take | Reject |
|---|---|---|
| Browserbase sessions — https://mobbin.com/screens/0ed8ac51-f8b3-402e-bca1-60c8f591222f | Filters as removable chips over the table ("Status is Completed ×"); rows-per-page and "Viewing 1–3 results" in a footer bar; sort as a labelled menu ("Newest") | Truncated ids with no way to copy the full value; we show the full Caller id in detail and copy on press |
| Shopify companies — https://mobbin.com/screens/7c5875cc-c53f-4721-9ea5-5380c32044fa | One combined "Search and filter" field with a saved-view selector ("All"); status as a badge with a dot | Row checkboxes on every list; bulk selection only where a bulk action exists (consent resend, id export) |
| DoorDash Merchant manage users — https://mobbin.com/screens/27645a35-c952-4dfb-82b9-436777caa654 | A privacy notice above the table that says what is hidden and why ("users outside of this store aren't visible below"); this is how our masking banner reads | The large hero heading and empty half-page; a dense tool starts the table near the top |
| Calendly org directory — https://mobbin.com/screens/4be5c2e5-5478-4b3d-97af-b4e0fbd288d7 | Tabs with counts over one table ("Active (2) · Pending (1)") for the consent queue lanes | The onboarding side panel competing with the table |
| Square plans — https://mobbin.com/screens/85857182-8f04-4314-b06e-29df202cf84a | Sortable header with a visible direction arrow; a muted row for an inactive record, still readable | Ellipsis menus as the only route to row actions; ours keeps the primary action visible on the row |
| Delphi audience — https://mobbin.com/screens/daa8763e-b92e-4f2f-9a7d-2d50d333805a | Filter chips that read as sentences ("Messages 51–100 messages") | Avatar-led rows; Callers have no photos in the console |

## Queues and review

| Ref | Take | Reject |
|---|---|---|
| Canny autopilot — https://mobbin.com/screens/53716998-2d84-4caf-8ff2-48f3efe1b8c4 | Source list on the left, items in the middle, per-item actions in a fixed column on the right: our three panes | One-click "Delete" beside "Looks good"; destructive and approving actions never sit next to each other in our queue |
| AirOps comparison prompts — https://mobbin.com/screens/6642909e-6268-45ee-8028-72f19c646023 | Toast that confirms the action and its count ("1 item declined") | "Decline All" / "Accept All" bulk buttons; consent decisions are one at a time |
| Klaviyo review submission — https://mobbin.com/screens/02359910-64f7-4f23-8280-f1bf18c8e95f | A checklist of conditions with pass/fail marks and a warning banner at the top that says what is irreversible; the hatch-integrity panel borrows this shape | The yellow warning fill; ours uses the danger and info tokens |
| Featurebase post detail — https://mobbin.com/screens/d92a3d67-4c8b-4240-b622-0aa5ec931987 | A right-hand key/value column (Date, Author, User ID, First seen) next to the main content: the model for our `KeyValueList` in the inspector | Showing a raw email and user id side by side with no masking |
| Cofounder approval — https://mobbin.com/screens/666ce02d-80fc-49a0-993b-a131ff8fa168 | "Reject" and "Approve" separated, with an optional reason field above them | Free-text feedback as the record of a decision; we store a reason code, not prose |

## Audit log

| Ref | Take | Reject |
|---|---|---|
| Klaviyo activity log — https://mobbin.com/screens/1f44450b-8a6f-4d19-83e8-24addf2ca0e8 | Filter row (search by id, user, action, timeframe), "Last synced: now" with a refresh control | Actions written as title-cased sentences; ours use a fixed action vocabulary (`consent.denied`) plus a plain label |
| Railway audit logs — https://mobbin.com/screens/3668d9f6-d6bb-4fdf-a4a8-97087947c044 | Event detail drawer with When (local, UTC, ISO), Who, What sections and a full event id: our audit inspector | Raw JSON of the session, user agent and IP; we store none of that about Callers, and staff IP stays out of the UI |
| Grok audit log — https://mobbin.com/screens/9944ef66-050d-405c-bf43-f9a289a67d17 | Exact-id search next to description search; operation as a fixed code column | The volume chart above the table; a count line is enough at Phase 1 scale |
| Toggl workspace log — https://mobbin.com/screens/2deef352-1f6b-4757-a4c9-dcce106b0e6a | "From → To" chips for a changed value | Showing the old and new value of personal fields; ours shows that a field changed, not the values |
| Customer.io audit logs — https://mobbin.com/screens/decad923-b3e9-4e22-8166-7b20e6c22140 | Expandable rows that open in place on narrow widths | "Export CSV" of the whole log by default; export is owner-only and is itself audited |

## Destructive actions

| Ref | Take | Reject |
|---|---|---|
| Railway delete account — https://mobbin.com/screens/9795528f-c37d-4d0d-be3f-dc261f7dd8d1 | Type-to-confirm with the exact identifier shown in the prompt; the destructive button names the result | "Forever" in the button; ours names the grace date instead |
| AirOps delete items — https://mobbin.com/screens/f4e2bee1-3cf3-4c30-b20a-95a192688ed1 | Lists exactly what will be removed before the confirm field; button disabled until the match | Folder-style cascade copy; we list record types, not files |
| Greptile delete account — https://mobbin.com/screens/9ff8bdbd-7405-45cc-967c-be2ebe409d19 | Danger zone separated at the bottom of settings | A tiny dialog over a busy page; ours becomes a sheet on compact |
| Cofounder delete account — https://mobbin.com/screens/c2d179de-914a-4272-90fb-6ac9b65c59e1 | Reason chosen from fixed options | Survey framing aimed at retention |

## Sign-in

| Ref | Take | Reject |
|---|---|---|
| Shopify log in — https://mobbin.com/screens/4697d474-32a0-48dc-b2e1-32e382619f5a | Email first, passkey as an equal second path | Social buttons; staff sign in with email or passkey only (plugin `admin.login.enableSocial` stays off) |
| Clerk sign in — https://mobbin.com/screens/12201556-0db6-4e6a-8fe2-5b747d68d208 | "Use passkey instead" as a one-line switch | "Don't have an account? Sign up"; staff accounts are created by the owner |
| Plain — https://mobbin.com/screens/42ecbd80-9dc0-4982-8143-950274a2149e | One card, product mark above, nothing else on the page | Generic grey; ours carries the NYC-MON wordmark and the NYC-Tron frame |

## Overview

| Ref | Take | Reject |
|---|---|---|
| Browserbase overview — https://mobbin.com/screens/5999d971-3c12-4486-9f23-8ff1098139bc | A strip of totals, then a short recent table with "View all" | Getting-started cards on an ops home |
| DoorDash operations quality — https://mobbin.com/screens/42ab5b35-a14e-43a8-a0db-f1108591f96d | Each metric says its target and whether it is met ("Meets goal of 1% or lower"); our integrity tiles state "0 duplicates" as the goal | Illustrations inside metric cards |
| Plain priorities — https://mobbin.com/screens/4b396c6e-917b-4dcf-bea8-0587c3dd4b1e | Segmented bar of a queue by state | Ten columns of N/A |

## Phone

| Ref | Take | Reject |
|---|---|---|
| Luma hosts — https://mobbin.com/screens/a19eef6b-882a-4665-9e90-e9574cbb9ff2 | A table becomes a list of two-line rows (name, email under it) with a trailing badge and a bottom bar; our `DataTable` compact layout | Floating pill tab bar; the kit `TabBar` is the bottom bar |
| Fly Delta account — https://mobbin.com/screens/5401a8ab-2e53-49fa-9939-c44232930a42 | "More" as the fifth tab for rarely used sections | Promotional image cards |

## Foldables (platform sources, not Mobbin)

- Chrome 138 ships the Viewport Segments API: `window.viewport.segments`, `@media (horizontal-viewport-segments: 2)`, `env(viewport-segment-*)`. On an unfolded or non-folding screen `segments` is one rect. https://developer.chrome.com/blog/viewport-segments-api-shipped · https://developer.mozilla.org/docs/Web/API/Viewport_Segments_API
- Device Posture API (`folded` / `continuous`), its sister: https://www.w3.org/TR/device-posture/
- The ported `AdaptivePanes` in MoyoLearn (`packages/ui/adaptive-panes/README.md`) plans pane boundaries onto hinges from native fold geometry and normalises posture to `flat` / `book` / `tabletop`. Its web fork (`use-fold-layout.web.ts`) returns no folds. The console is a web app, so the web fork is the one that matters here.
