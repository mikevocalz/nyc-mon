# Waitlist age screen

Status: implemented 2026-10-12, **legal review required, not done**.
Scope: the waitlist form on `/` and `/get` and `POST /v1/waitlist`.
Related: ADR 0001 "Age and consent" (`docs/adr/0001-auth-and-identity.md`), the app's M04 birth-year gate (`packages/app/features/onboarding/AgeGateScreen.tsx`), `/legal/childrens-privacy`, `PREMIUM_SITE_A11Y.md` (WAITLIST), `PREMIUM_SITE_HANDOFF.md` (WAITLIST).

## What changed and why

Before, the form had one required checkbox, "I'm 13 or older". With JavaScript on, leaving it unticked showed "Check the box to confirm you're 13 or older." The hint under it ("Younger than 13? …") and the privacy line ("Under-13s can't sign up.") also named the age line before the visitor answered. Together these told a child which answer gets through. The FTC's COPPA FAQ says an age screen should be neutral: ask for age without saying which answers are accepted and without encouraging a false answer (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). The server's `under13` answer could only be reached with JavaScript off.

The form now uses the same approach as the app's M04 gate (ADR 0001):

- **One question: birth year.** The field is labelled "Birth year" with the hint "We ask everyone. Four digits." It starts empty, has no placeholder year, and has `autocomplete=off`, so browser autofill on a shared family device can't fill in a passing answer. The app asks for a year only and never a month, so the web form does the same and both use one rule.
- **Nothing before the answer names an age or the line.** The pre-answer copy has no "13", "older" or "younger". The browser checks only the shape of the year, using M04's wording: "Enter all four digits of the year.", "That year hasn't happened yet. Check the number." and "Check that year. It needs to be 1900 or later." None of them says which years can join. A unit test (`copy.test.ts`) fails if a threshold word or a sample year shows up in the form copy.
- **The server decides.** admin-vite applies `isConsentRequired` from `@acme/core/sim`, the same function M04, M03's create guard and the sign-up hook use: `currentYear(UTC) - birthYear <= 13` counts as under 13. A year can't tell 12 from 13, so anyone born in `currentYear - 13` is treated as under 13. That leans protective and matches the app.
- **The under-13 answer is kind and gives no way to retry.** The form is replaced by: "Thanks for wanting in. We can't add you to the waitlist, and nothing you typed was saved. A parent or guardian can join with their own email to hear when NYC-MON is out." A link follows: "For parents: children's privacy" → `/legal/childrens-privacy`. The note names no age, has no "try again" and doesn't suggest another year. Every claim in it is true today: nothing is stored, and any adult can join the waitlist with their own email.
- **Retrying right away is blocked.** Two layers do this:
  1. The page stays in its result state. The `under13` branch renders no form, so the visitor can't pick another year on the same page.
  2. When admin-vite answers `under13`, the server action sets the cookie `nycmon_waitlist_hold=1`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Max-Age=3600`. While the cookie is set, any post to the action (after a reload or the back button, with or without JavaScript) gets `under13` straight back, and the email and year are never sent to admin-vite. The cookie holds no email, no year and no IP. It is in `apps/web/lib/waitlist-hold.ts`.

  We chose a cookie because it is the simplest server-side guard that also works with JavaScript off. The FTC FAQ names a cookie as one way to stop a child from going back and changing their age. It is a speed bump, not a lock: a private window or cleared cookies get around it. We picked one hour to match the per-IP rate-limit window. See the open questions.
- **The `joined` rule is unchanged.** `mapWaitlistResponse` reads `joined` only for HTTP 200 with `{ status: 'joined' }`. Tests now also cover `under13` on a 200, `joined` on a 422 or 201, and a 200 with an unknown or missing status. All of them read as `error`, never as "You're on the list."

## Data handling

| Data | Where it goes | Kept |
|---|---|---|
| Birth year | browser → web server action → admin-vite (JSON body, once) | Never stored. admin-vite holds it in one local variable for the range check and the age rule, then drops it. It is not a `waitlist` field and is not logged. The web action never echoes it back, so the field is empty after every answer |
| Email, under 13 | browser → web server action → admin-vite | Never parsed, looked up or stored. The age check runs before the address is read. The action returns `email: ''`, so it isn't even kept in page state |
| Email, 13 or older | stored in the Payload `waitlist` collection (lowercased) | Until erasure, as before |
| Hold cookie | the visitor's browser only | 1 hour; value `1` |
| Rate-limit counter | `verifications` row keyed on HMAC(IP) + UTC hour | 2 hours, as before; no email, no year (tested) |

The `POST /v1/waitlist` contract: the body is `{ email, birthYear, district?, source?, website? }`. A missing, non-integer, pre-1900 or future `birthYear` answers `400 { status: 'invalid', field: 'birthYear' }`, and that check runs before the email is parsed. An under-13 year answers `422 { status: 'under13' }`. **`ageConfirmed` is no longer accepted.** The web server action was its only caller (checked with grep across the repo: no app, admin or script posts it). A body that carries only `ageConfirmed: true` answers `invalid` / `birthYear`, so no client can get past the screen with a yes/no flag.

**Rollout:** web and admin-vite have to ship together. An old web posting `ageConfirmed` to a new admin-vite gets `invalid` (the visitor sees the year error, nothing is stored). A new web posting `birthYear` to an old admin-vite gets `invalid` too, because the old schema requires `ageConfirmed`. In neither case is a child's data stored, and neither case reads as joined.

## Files

- `packages/payload/src/admin/console/waitlist.ts`: new body schema, birth-year check, `isConsentRequired`
- `packages/payload/src/admin/console/__tests__/waitlist.test.ts`: under-13 years (2026, 2020, 2013), 13+ years (2012, 1990, 1900), the year never stored, invalid years, legacy `ageConfirmed` refused
- `packages/payload/src/collections/Waitlist.ts`: doc comment only
- `apps/web/lib/waitlist.ts`: `birthYear` in the input and the request, `toBirthYear`, `field: 'birthYear'` mapping
- `apps/web/lib/waitlist-hold.ts`: hold cookie name and lifetime (new)
- `apps/web/app/(site)/get/actions.ts`: sends `birthYear`, sets and honours the hold cookie
- `apps/web/components/waitlist/copy.ts` and `copy.test.ts`: neutral copy, `birthYearError`, the under-13 note and link
- `apps/web/components/waitlist/WaitlistForm.tsx`: the year field, the under-13 result view, focus handling
- `apps/web/lib/waitlist.test.ts`: request body, mapping, `toBirthYear`

## Legal review: required, not done

Nothing here is legal advice, and none of it has been reviewed by counsel. Before launch, counsel should confirm:

1. **Is a waitlist for a child-attractive app collecting from children at all?** If the site is "directed to children" under 16 CFR 312.2, an age screen may not be enough, and the waitlist may need to collect no email from under-13s by design. This build already stores none.
2. **Does the year-only rule and its treatment of `currentYear - 13` as under 13 work for the waitlist the way ADR 0001 says it works for accounts?**
3. **Is the hold cookie (1 hour, strictly functional, no personal data) acceptable without a banner, and does the privacy notice need to mention it?** `/legal/privacy` doesn't mention the waitlist at all today: what it collects (email, district, source page), the hashed-IP rate limit, the transient birth year, or the cookie.
4. **Does the under-13 wording work for a child reader, and is pointing to `/legal/childrens-privacy` right,** given that the notice is about app accounts rather than the waitlist?
5. **Is the 312.5(c)(1) parent-email exception relevant?** The waitlist never asks a child for a parent's email, by design. Counsel should confirm that choice.

## Not re-verified in this change

The rendered form wasn't re-run through Playwright, axe or a screen reader, and the production server on :3100 wasn't rebuilt. Rows marked *Re-test* in `PREMIUM_SITE_A11Y.md` need that pass. `PREMIUM_SITE_QA.md` is a historical run log and still describes the checkbox.
