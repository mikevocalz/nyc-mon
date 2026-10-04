# Ops console: copy

Owner: `design-director` (strings for `ux-writer` review). Written 2026-10-04. Rules: `docs/COPY_DECK.md` (voice `ui`, sentence case, buttons start with a verb, errors say what happened then what to do, no exclamation marks) and Law 9. Every string here is `voice: "ui"`; the console has no character strings.

Staff-facing differences from the game deck: staff read ids, dates and counts all day, so copy is shorter and more literal; COPPA and canon rules are stated plainly because staff need the rule, not a story.

## Vocabulary

| Use | Never | Note |
|---|---|---|
| Caller | user, player, account holder | the Payload slug `users` never appears in UI |
| Staff | admin, user | the role names are Ops, Support, Consent, Content |
| Mon | creature, pet, monster | |
| Bloodline | family, line | Decision #11; render `${bloodlineName} Bloodline` |
| H-Lynk | device | only if a string needs it; none here does |
| Guardian consent | parental permission, COPPA request | "parent" is fine in running text |
| Schedule deletion / Deletion scheduled | delete account, purge, wipe | the grace period is part of the action |
| Hidden / Show | masked, redacted, PII | staff-facing plain words |

## Shell

| ID | String | Limit | Notes |
|---|---|---|---|
| `admin.nav.label` | Console | — | `Nav` accessible name |
| `admin.nav.overview` | Overview | 12 | |
| `admin.nav.callers` | Callers | 12 | |
| `admin.nav.consent` | Consent | 12 | full title on the screen: "Consent queue" |
| `admin.nav.mons` | Mons | 12 | |
| `admin.nav.content` | Content | 12 | |
| `admin.nav.audit` | Audit log | 12 | |
| `admin.nav.settings` | Settings | 12 | |
| `admin.nav.more` | More | 12 | compact tab |
| `admin.nav.section_select` | Section | — | book-fold `Select` label |
| `admin.staff_menu.label` | Your account | — | `IconButton` label |
| `admin.staff_menu.sign_out` | Sign out | — | |
| `admin.alert.integrity_failing` | {count} duplicated Mons. Review now. | 48 | global strip; link text "Review now" |
| `admin.back` | Back to {section} | — | compact detail back control |

## Overview

| ID | String |
|---|---|
| `admin.overview.h1` | Overview |
| `admin.overview.band.healthy` | 0 duplicated Mons |
| `admin.overview.band.failing` | {count} duplicated Mons |
| `admin.overview.band.checked` | Checked {relativeTime} |
| `admin.overview.band.checking` | Checking… |
| `admin.overview.band.run` | Run check |
| `admin.overview.band.review` | Review duplicates |
| `admin.overview.queues.h2` | Queues |
| `admin.overview.tile.consent_pending` | Consents pending |
| `admin.overview.tile.consent_expiring` | Consents expiring within 7 days |
| `admin.overview.tile.parent_requests` | Parent requests open |
| `admin.overview.tile.deletions` | Account deletions scheduled |
| `admin.overview.hatching.h2` | Hatching |
| `admin.overview.tile.incubating` | Eggs incubating |
| `admin.overview.tile.ready` | Eggs ready to hatch |
| `admin.overview.tile.hatched_24h` | Hatched in the last 24 hours |
| `admin.overview.tile.unconfirmed` | Hatches not yet confirmed by the server |
| `admin.overview.recent.h2` | Recent activity |
| `admin.overview.recent.link` | Open audit log |
| `admin.block.not_connected` | Not connected yet. The {collection} collection doesn't exist. |
| `admin.block.error` | This didn't load. |
| `admin.block.retry` | Try again |

## Callers

| ID | String |
|---|---|
| `admin.callers.h1` | Callers |
| `admin.callers.search.label` | Find a Caller |
| `admin.callers.search.placeholder` | Email or Caller id |
| `admin.callers.search_first` | Search by exact email or Caller id. Callers aren't listed until you search. |
| `admin.callers.empty.title` | No Caller matches |
| `admin.callers.empty.body` | Check the spelling. Search matches a whole email or a whole Caller id. |
| `admin.callers.privacy_notice` | Email, name and birth year are hidden for Callers under 18. Showing one asks for a reason and is logged. |
| `admin.callers.col.caller` | Caller |
| `admin.callers.col.age` | Age band |
| `admin.callers.col.consent` | Consent |
| `admin.callers.col.mons` | Mons |
| `admin.callers.col.joined` | Joined |
| `admin.callers.col.last_sync` | Last sync |
| `admin.age.under13` | Under 13 |
| `admin.age.teen` | 13 to 17 |
| `admin.age.adult` | 18 and over |
| `admin.age.unknown` | Not given |
| `admin.callers.detail.identity` | Identity |
| `admin.callers.detail.caller_id` | Caller id |
| `admin.callers.detail.email` | Email |
| `admin.callers.detail.name` | Name |
| `admin.callers.detail.age` | Age band |
| `admin.callers.detail.verified` | Email verified |
| `admin.callers.detail.signin` | Sign-in |
| `admin.callers.detail.providers` | Signs in with |
| `admin.callers.detail.sessions` | Active sessions |
| `admin.callers.sign_out_all` | Sign out everywhere |
| `admin.callers.detail.mons` | Mons |
| `admin.callers.detail.no_mons` | No Mons yet. |
| `admin.callers.danger.h2` | Delete account |
| `admin.callers.danger.body` | Deletion waits 7 days, then removes this Caller's account, sign-ins and Mons. You can cancel it during those 7 days. |
| `admin.callers.danger.button` | Schedule deletion |
| `admin.callers.scheduled.title` | Deletion scheduled for {date} |
| `admin.callers.scheduled.body` | Scheduled by {staff} on {date}. Reason: {reason}. |
| `admin.callers.scheduled.cancel` | Cancel deletion |
| `admin.callers.history.h2` | History |

## Masked values

| ID | String |
|---|---|
| `admin.mask.hidden` | Hidden |
| `admin.mask.show` | Show |
| `admin.mask.show.a11y` | Show {field}. Asks for a reason. |
| `admin.mask.hide` | Hide |
| `admin.mask.dialog.title` | Why do you need to see this? |
| `admin.mask.dialog.body` | Your reason is saved in the audit log with your name. The value isn't. |
| `admin.mask.dialog.confirm` | Show {field} |
| `admin.reason.label` | Reason |
| `admin.reason.support_request` | Answering this Caller's support request |
| `admin.reason.parent_request` | Answering a parent's request |
| `admin.reason.deletion_check` | Checking a deletion |
| `admin.reason.legal` | Legal or safety request |
| `admin.reason.caller_request` | The Caller asked |
| `admin.reason.parent_withdrew` | The parent withdrew the request |
| `admin.reason.sent_in_error` | The request was sent in error |

## Deletion dialog

| ID | String |
|---|---|
| `admin.delete.title` | Schedule deletion for this Caller? |
| `admin.delete.consequence.account` | Their account and email are deleted on {date}. |
| `admin.delete.consequence.signins` | Every sign-in, session and passkey is removed. |
| `admin.delete.consequence.mons` | Their Mons are removed with the account. |
| `admin.delete.consequence.cancel` | Anyone on staff can cancel before {date}. |
| `admin.delete.type_label` | Type {code} to confirm |
| `admin.delete.type_hint` | The last 6 characters of the Caller id. |
| `admin.delete.confirm` | Schedule deletion |
| `admin.delete.cancel` | Keep account |
| `admin.delete.done` | Deletion scheduled for {date} |
| `admin.delete.cancelled` | Deletion cancelled |
| `admin.delete.error` | Deletion wasn't scheduled. Nothing changed. Try again. |
| `admin.signout_all.title` | Sign this Caller out everywhere? |
| `admin.signout_all.body` | Every session ends. Their Mons and account stay as they are. |
| `admin.signout_all.confirm` | Sign out everywhere |
| `admin.signout_all.done` | Signed out of {count} sessions |

## Consent queue

| ID | String |
|---|---|
| `admin.consent.h1` | Consent queue |
| `admin.consent.rule` | We hold a parent's email and the child's birth year only to ask for consent. No child name or email exists here. |
| `admin.consent.lane.review` | Needs review |
| `admin.consent.lane.pending` | Pending |
| `admin.consent.lane.expiring` | Expiring |
| `admin.consent.lane.requests` | Parent requests |
| `admin.consent.lane.closed` | Closed |
| `admin.consent.col.id` | Consent |
| `admin.consent.col.status` | Status |
| `admin.consent.col.expires` | Expires |
| `admin.consent.col.emails` | Emails sent |
| `admin.consent.col.created` | Created |
| `admin.consent.detail.parent_email` | Parent's email |
| `admin.consent.detail.child_age` | Child's age band |
| `admin.consent.detail.status` | Status |
| `admin.consent.detail.expires` | Expires |
| `admin.consent.detail.emails` | Consent emails sent |
| `admin.consent.resend` | Resend consent email |
| `admin.consent.resend.locked` | You can resend at {time} |
| `admin.consent.resend.done` | Consent email sent |
| `admin.consent.delete` | Delete this record now |
| `admin.consent.delete.title` | Delete this consent record? |
| `admin.consent.delete.consequence` | The parent's email and the child's birth year are deleted now. A receipt with the date and your reason stays. |
| `admin.consent.delete.confirm` | Delete record |
| `admin.consent.delete.done` | Record deleted. Receipt saved. |
| `admin.consent.approve` | Approve |
| `admin.consent.deny` | Deny |
| `admin.consent.receipt.h2` | Receipt |
| `admin.consent.receipt.body` | {outcome} on {date} by {actor}. Reason: {reason}. |
| `admin.consent.denied.mon` | The child's Mon was not deleted. In the story it stays with Dr. Santoro (Decision #15). If consent comes later, the child starts fresh. |
| `admin.consent.empty.pending` | No consents are waiting on a parent. |
| `admin.consent.empty.requests` | No open parent requests. |
| `admin.consent.history.h2` | Timeline |

`admin.consent.receipt.body` `{outcome}` values: "Approved", "Denied", "Expired and deleted", "Deleted on request".

## Mons and eggs

| ID | String |
|---|---|
| `admin.mons.h1` | Mons |
| `admin.mons.tab.mons` | Mons |
| `admin.mons.tab.eggs` | Eggs |
| `admin.mons.tab.integrity` | Integrity |
| `admin.mons.read_only` | Read only. Mons and eggs change only through the game API. |
| `admin.mons.col.mon` | Mon |
| `admin.mons.col.bloodline` | Bloodline |
| `admin.mons.col.caller` | Caller |
| `admin.mons.col.stage` | Stage |
| `admin.mons.col.hatched` | Hatched |
| `admin.mons.col.confirmed` | Server confirmed |
| `admin.mons.detail.mon_id` | Mon id |
| `admin.mons.detail.egg_id` | Egg id |
| `admin.mons.detail.species` | Species |
| `admin.mons.detail.nickname` | Nickname |
| `admin.mons.detail.no_nickname` | Not named yet |
| `admin.mons.detail.bond` | Bond |
| `admin.mons.detail.care` | Care |
| `admin.mons.detail.energy` | Energy |
| `admin.mons.detail.fullness` | Fullness |
| `admin.mons.detail.social` | Social |
| `admin.mons.detail.last_write` | Last applied write |
| `admin.mons.check.id_matches` | Id matches its egg |
| `admin.mons.check.only_one` | Only Mon from this egg |
| `admin.eggs.col.egg` | Egg |
| `admin.eggs.col.state` | State |
| `admin.eggs.col.incubation` | Incubation |
| `admin.eggs.col.ends` | Ends |
| `admin.eggs.state.incubating` | Incubating |
| `admin.eggs.state.ready` | Ready to hatch |
| `admin.eggs.state.hatched` | Hatched |
| `admin.eggs.incubation` | {minutes} min |
| `admin.integrity.check.shared_egg` | Mons sharing one egg |
| `admin.integrity.check.id_mismatch` | Mon ids that don't match their egg |
| `admin.integrity.check.orphans` | Hatched eggs with no Mon, or Mons whose egg isn't hatched |
| `admin.integrity.check.stale_ready` | Eggs ready for more than 7 days |
| `admin.integrity.expected_zero` | Expected 0 |
| `admin.integrity.informational` | For information |
| `admin.integrity.passing` | Passing |
| `admin.integrity.failing` | Failing |
| `admin.integrity.fix_note` | Fix this with a database migration. The console never deletes a Mon. |

## Content

| ID | String |
|---|---|
| `admin.content.h1` | Content |
| `admin.content.banner` | Content ships in code. Changes go through a pull request to packages/content. |
| `admin.content.version` | Content version {version} |
| `admin.content.col.bloodline` | Bloodline |
| `admin.content.col.id` | Id |
| `admin.content.col.forms` | Forms |
| `admin.content.col.todo` | Open TODO(canon) |
| `admin.content.todo` | TODO(canon) |
| `admin.content.todo.a11y` | Not decided in canon yet |
| `admin.content.evolutions` | {count} authored evolutions |
| `admin.content.eggs.h2` | Starter eggs |
| `admin.content.eggs.hatches_into` | Hatches into |

## Audit log

| ID | String |
|---|---|
| `admin.audit.h1` | Audit log |
| `admin.audit.rule` | Events can't be edited or deleted. |
| `admin.audit.search.label` | Exact id |
| `admin.audit.col.when` | When |
| `admin.audit.col.action` | Action |
| `admin.audit.col.target` | Target |
| `admin.audit.col.actor` | Staff |
| `admin.audit.col.reason` | Reason |
| `admin.audit.detail.when` | When |
| `admin.audit.detail.who` | Who |
| `admin.audit.detail.what` | What |
| `admin.audit.detail.why` | Why |
| `admin.audit.target_gone` | This record no longer exists. |
| `admin.audit.export` | Export |
| `admin.audit.empty` | No events match these filters. |

Action labels (code → label): `caller.value_shown` "Showed a hidden value", `caller.deletion_scheduled` "Scheduled deletion", `caller.deletion_cancelled` "Cancelled deletion", `caller.deleted` "Deleted account", `caller.signed_out_everywhere` "Signed out everywhere", `consent.email_sent` "Sent consent email", `consent.approved` "Approved consent", `consent.denied` "Denied consent", `consent.expired` "Consent expired", `consent.deleted` "Deleted consent record", `integrity.check_run` "Ran integrity check", `staff.added` "Added staff", `staff.role_changed` "Changed staff role", `staff.removed` "Removed staff", `audit.exported` "Exported audit log".

## Settings

| ID | String |
|---|---|
| `admin.settings.h1` | Settings |
| `admin.settings.appearance` | Appearance |
| `admin.settings.appearance.system` | Match system |
| `admin.settings.appearance.daylit` | Daylit |
| `admin.settings.appearance.night` | Night |
| `admin.settings.signin` | Your sign-in |
| `admin.settings.passkeys` | Passkeys |
| `admin.settings.add_passkey` | Add a passkey |
| `admin.settings.remove_passkey` | Remove |
| `admin.settings.sessions` | Sessions |
| `admin.settings.this_session` | This session |
| `admin.settings.sign_out_others` | Sign out other sessions |
| `admin.settings.staff.h2` | Staff |
| `admin.settings.staff.add` | Add staff |
| `admin.settings.staff.change_role` | Change role |
| `admin.settings.staff.remove` | Remove access |
| `admin.role.ops` | Ops |
| `admin.role.support` | Support |
| `admin.role.consent` | Consent |
| `admin.role.content` | Content |

## Sign in

| ID | String |
|---|---|
| `admin.login.h1` | Sign in to the console |
| `admin.login.email` | Email |
| `admin.login.password` | Password |
| `admin.login.submit` | Sign in |
| `admin.login.submitting` | Signing in… |
| `admin.login.passkey` | Use a passkey |
| `admin.login.forgot` | Forgot password |
| `admin.login.error.credentials` | That email and password don't match. Check both and try again. |
| `admin.login.error.passkey_cancelled` | (none: a cancelled passkey prompt shows nothing) |
| `admin.login.error.passkey_unsupported` | This browser can't use passkeys. Sign in with your email and password. |
| `admin.login.error.network` | Couldn't reach the server. Check your connection and try again. |
| `admin.login.not_staff.title` | This console is for NYC-MON staff |
| `admin.login.not_staff.body` | You're signed in, but your account has no staff role. Ask the console owner if you need access. |
| `admin.login.not_staff.sign_out` | Sign out |

## Accessibility strings

| ID | String |
|---|---|
| `admin.a11y.copy` | Copy {thing} |
| `admin.a11y.copied` | Copied |
| `admin.a11y.row_expand` | Show more about {record} |
| `admin.a11y.sort` | Sort by {column} |
| `admin.a11y.filter_remove` | Remove filter {filter} |
| `admin.a11y.pagination` | Pagination |
| `admin.a11y.page_status` | Showing {from} to {to} of {total} |
| `admin.a11y.history_toggle` | Show history |
| `admin.a11y.band_status` | Integrity check: {count} duplicated Mons |
