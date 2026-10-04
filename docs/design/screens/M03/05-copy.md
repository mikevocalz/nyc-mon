# M03 Sign in / Create account: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; `docs/design/DECISIONS.md` P1, D8; ADR `docs/adr/0001-auth-and-identity.md`; canon Decisions #2, #3. Error codes read from the installed `@better-auth/core@1.7.7` (`dist/error/codes.mjs`) and `packages/payload/src/auth/options.ts` (Law 2). Voice and glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. No character appears.

## Intent

The screen arrives with one intent already set (P1): `create` (13+ only, after M04) or `sign-in` (from M02 or an expired session). Strings that differ by intent carry `.create` / `.sign_in`.

## Length budget

iPhone SE, 343 pt text width, default Dynamic Type. `type-title` about 26 characters a line, `type-body` 37, `type-label` on a 48 pt full-width button about 34, `type-caption` 48. The whole page must fit above y ≈ 600 pt on SE (`03-direction.md`), so the subtitle is one line where it can be.

## Header

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m03.title.create` | Make your account | ui | 26 | `Heading level={1}` | — |
| `m03.title.sign_in` | Sign in | ui | 26 | | — |
| `m03.subtitle.create` | Your account keeps your Mon with you if you switch phones. | ui | 74 | Answers "why an account" in the player's terms. Never "device" (Law 9) | Same Mon on every surface, server-authoritative: `V11 ¶93` |
| `m03.subtitle.sign_in` | Pick the way you signed up, and your Mon comes with you. | ui | 74 | Marcus's job (`01-research.md`): find the same Mon, not make a second account | `V11 ¶93` |
| `m03.switch.to_create` | New here? Get started | ui | 28 | Sign-in intent. Routes to M04 first, never switches in place (P1) | — |
| `m03.switch.to_sign_in` | Already a Caller? Sign in | ui | 28 | Create intent. Same words as `m02.p3.cta.secondary` | Caller: `V11 ¶109` |
| `m03.back.a11y.label` | Back | ui | — | Stack header | — |

## Provider buttons

Apple and Google labels use the wording each brand allows: Apple HIG lists "Sign in with Apple", "Sign up with Apple" and "Continue with Apple" (https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple); Google's branding guide lists "Sign in with Google", "Sign up with Google" and "Continue with Google" (https://developers.google.com/identity/branding-guidelines). On iOS the native `ASAuthorizationAppleIDButton` renders its own text from the `type` we pass; these strings are the Android and web fallbacks and the `type` choice.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m03.provider.apple.label.create` | Sign up with Apple | ui | 34 | iOS: `type=SIGN_UP` | — |
| `m03.provider.apple.label.sign_in` | Sign in with Apple | ui | 34 | iOS: `type=SIGN_IN` | — |
| `m03.provider.google.label.create` | Sign up with Google | ui | 34 | | — |
| `m03.provider.google.label.sign_in` | Sign in with Google | ui | 34 | | — |
| `m03.provider.passkey.label.create` | Make a passkey | ui | 34 | Hidden when unsupported. See open question on create-by-passkey | — |
| `m03.provider.passkey.label.sign_in` | Sign in with a passkey | ui | 34 | Hidden when unsupported | — |
| `m03.provider.passkey.a11y.hint.ios` | Uses Face ID, Touch ID or your passcode. No password. | ui | — | Also shown as a one-line caption under the button on first visit if the hallway test shows players avoid it (`01-research.md` question 2) | — |
| `m03.provider.passkey.a11y.hint.android` | Uses your fingerprint, face or screen lock. No password. | ui | — | | — |
| `m03.provider.email.label` | Continue with email | ui | 34 | Expands in place | — |

### Loading (per provider)

The tapped button shows its spinner and this text; the others disable. Spoken as a polite announcement.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m03.provider.apple.loading` | Waiting for Apple… | ui | 34 | |
| `m03.provider.google.loading` | Waiting for Google… | ui | 34 | |
| `m03.provider.passkey.loading` | Checking your passkey… | ui | 34 | |
| `m03.email.loading` | Signing you in… | ui | 34 | Sign-in |
| `m03.email.loading.create` | Making your account… | ui | 34 | Create |

## Email, expanded

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m03.email.field.label` | Email | ui | 20 | `textContentType="emailAddress"` |
| `m03.password.field.label` | Password | ui | 20 | `textContentType="newPassword"` on create, `"password"` on sign-in |
| `m03.password.field.hint.create` | At least 10 characters | ui | 48 | `minPasswordLength: 10` in `options.ts` |
| `m03.password.show.a11y.label` | Show password | ui | — | Toggle; becomes `m03.password.hide.a11y.label` |
| `m03.password.hide.a11y.label` | Hide password | ui | — | |
| `m03.email.submit.create` | Make account | ui | 34 | Orange CTA, the only orange on M03 |
| `m03.email.submit.sign_in` | Sign in | ui | 34 | Orange CTA |
| `m03.password.forgot` | Forgot password? | ui | 24 | Ghost link, sign-in only |

## Errors (per provider)

Shape: what happened, then what to do. Shown in `ErrorMessage` under the button that failed; the other providers stay live. No error blames the player. A cancelled Apple or Google sheet shows nothing: the player chose to close it.

| ID | String | Voice | Max | Trigger |
|---|---|---|---|---|
| `m03.error.apple.cancelled` | (no message) | ui | — | User closed the Apple sheet |
| `m03.error.apple.failed` | Apple sign-in didn't go through. Try again, or pick another way. | ui | 96 | Any other Apple failure |
| `m03.error.google.cancelled` | (no message) | ui | — | User closed the Google sheet |
| `m03.error.google.failed` | Google sign-in didn't go through. Try again, or pick another way. | ui | 96 | Any other Google failure |
| `m03.error.passkey.cancelled` | (no message) | ui | — | User dismissed the OS passkey sheet |
| `m03.error.passkey.not_found` | No NYC-MON passkey on this phone. Try another way to sign in. | ui | 96 | Sign-in; no matching credential |
| `m03.error.passkey.failed` | That passkey didn't work. Try again, or pick another way. | ui | 96 | Other passkey failure |
| `m03.error.email.invalid` | That email looks off. Check it for a typo. | ui | 96 | `INVALID_EMAIL`, or fails client check |
| `m03.error.credentials` | That email and password don't match. Check both, or reset your password. | ui | 96 | `INVALID_EMAIL_OR_PASSWORD` (401). Same message whether the email exists or not |
| `m03.error.password.too_short` | Use at least 10 characters. | ui | 96 | `PASSWORD_TOO_SHORT` |
| `m03.error.password.too_long` | That password is too long. Try a shorter one. | ui | 96 | `PASSWORD_TOO_LONG` |
| `m03.error.account_exists` | That email already has an account. Sign in instead. | ui | 96 | `USER_ALREADY_EXISTS`, create intent. Followed by a link that flips to sign-in with the email kept |
| `m03.error.not_verified` | Confirm your email first. We just sent a new link. | ui | 96 | `EMAIL_NOT_VERIFIED` (with `sendOnSignIn: true`, the server resends) |
| `m03.error.offline` | You're offline. Connect to the internet to sign in. | ui | 96 | No network, any provider |
| `m03.error.server` | Something broke on our end. Try again in a minute. | ui | 96 | 5xx, `FAILED_TO_CREATE_USER`, `FAILED_TO_CREATE_SESSION` |
| `m03.error.needs_age` | (no message; route to M04) | ui | — | `GUARDIAN_CONSENT_REQUIRED` or `INVALID_BIRTH_YEAR`. Should be unreachable under P1. If it fires, send the player to M04 silently; never show the server text, which names the consent path |

## Verification sent (email, create)

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m03.verify.title` | Check your email | ui | 26 | Replaces the email block inline |
| `m03.verify.body` | We sent a link to {email}. Open it to finish making your account. | ui | 110 | `{email}` in `type-body-strong` |
| `m03.verify.resend` | Send it again | ui | 24 | Ghost |
| `m03.verify.change_email` | Change email | ui | 24 | Ghost |
| `m03.verify.resent` | Sent again. It can take a few minutes, and it sometimes lands in spam. | ui | 110 | After Resend |
| `m03.verify.resend.wait` | You can send it again in {seconds} s | ui | 40 | While throttled |
| `m03.verify.stuck` | Still nothing? Try Apple, Google or a passkey instead. | ui | 96 | After a second resend; the lockout exit from ADR 0001. Lists only the providers that are visible |

## Password reset

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m03.reset.title` | Reset your password | ui | 26 | Inline, replaces the email block |
| `m03.reset.body` | Enter your email. If it has an account, we'll send a link. | ui | 96 | Same answer for unknown emails |
| `m03.reset.submit` | Send link | ui | 24 | |
| `m03.reset.sent` | If that email has an account, the link is on its way. It works for one hour. | ui | 110 | The one-hour expiry matches the reset mail in `options.ts` |
| `m03.reset.unavailable` | Password reset isn't working right now. Try another way to sign in. | ui | 96 | `RESET_PASSWORD_DISABLED` (no mail sender) |

## Legal

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m03.legal.notice.create` | By making an account, you agree to the Terms and the Privacy Policy. | ui | 96 | `type-caption`, create only; "Terms" and "Privacy Policy" are the links |
| `m03.legal.terms` | Terms | ui | 16 | Link |
| `m03.legal.privacy` | Privacy Policy | ui | 16 | Link |
| `m03.legal.children` | Children's privacy | ui | 20 | Link; the COPPA notice |

## Mail sent by the server (plain text)

Today's subjects and bodies live in `packages/payload/src/auth/options.ts` (platform owns the code). These are the deck's wording for them; the current text is close and the change is small.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `mail.verify.subject` | Confirm your NYC-MON email | ui | 60 | Matches current code |
| `mail.verify.body` | Tap the link to confirm this address and finish setting up your NYC-MON account. If you didn't sign up, you can ignore this email. | ui | — | Adds the "didn't sign up" line |
| `mail.reset.subject` | Reset your NYC-MON password | ui | 60 | Matches current code |
| `mail.reset.body` | Use this link to set a new password. It expires in one hour. If you didn't ask for this, you can ignore it and your password stays the same. | ui | — | Adds the "didn't ask" line |

## Passkey unsupported

No copy. The button is not rendered and nothing tells the player they are missing something (`03-direction.md`).

## Reduced motion

No copy changes.

## Slopmonster gate

`deslop.py` over every String cell: **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
