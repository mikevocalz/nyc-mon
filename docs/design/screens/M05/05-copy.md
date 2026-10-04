# M05 Parental consent: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`, `06-critique.md`; canon Decision #15; `docs/design/DECISIONS.md` P1; ADR 0001 § Age and consent; FTC COPPA FAQ C.11, I.2, I.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions); UK ICO Children's Code standard 13. Voice and glossary: `docs/COPY_DECK.md`.

Two readers: the child on screen (under 13, or a 13-year-old caught by year-only resolution) and the parent or guardian who gets the email.

All strings are `voice: "ui"`. There are no Santoro lines: v11 gives her no dialogue (`V11 ¶83`, `¶84` describe her; no line is quoted), so every place a Santoro line could go is `TODO(canon)`.

## Rules

- Lead with "you can keep playing" (`03-direction.md` § The one move).
- Ask for the parent or guardian's email and nothing else (FAQ I.2).
- Never ask the child to persuade anyone. No "ask your parent to hurry", no Mon or Santoro asking for approval (ICO standard 13).
- No countdowns, no urgency, no lock language.
- Denied and expired are nobody's fault. The child did nothing wrong, and a parent who says no is not the villain either.
- On screen the Mon is never deleted and never turned back into an egg (Law 8, Decision #15). It stays with Dr. Santoro.
- Reading level: short sentences, common words. "Parent or guardian" in full on the ask screen; "grown-up" only in the status chip, where space is tight.

## Ask

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m05.ask.title` | You can keep playing | ui | 26 | `Heading level={1}`, `type-title` | ADR 0001: child plays locally while pending |
| `m05.ask.body` | A parent or guardian needs to say yes to your account. We'll email them. Until they do, your game stays on this phone. | ui | 130 | `type-body` | ADR 0001 (queued writes stay local) |
| `m05.field.label` | Parent or guardian's email | ui | 30 | `textContentType="emailAddress"`, `autoComplete="off"` | — |
| `m05.field.hint` | We only use it to ask them. | ui | 48 | True under FAQ I.2 (sole purpose) and ADR 0001 | — |
| `m05.preview.toggle` | See the email we'll send | ui | 30 | Ghost link; opens `Collapsible` with `mail.consent.*` below as plain text | — |
| `m05.preview.toggle.a11y.hint` | Shows the whole email | ui | — | | — |
| `m05.send` | Send email | ui | 20 | Orange CTA | — |
| `m05.send.loading` | Sending… | ui | 20 | | — |

### Ask errors

| ID | String | Voice | Max | Trigger |
|---|---|---|---|---|
| `m05.error.email.invalid` | That email looks off. Check it for a typo. | ui | 80 | Client check or server `INVALID_EMAIL` |
| `m05.error.offline` | You're offline, so the email can't go out yet. Try again when you're connected. | ui | 96 | No network. Whether the child may continue to M07 before it sends is open (question 3) |
| `m05.error.server` | That didn't send. Try again in a minute. | ui | 80 | Resend or server failure |

## Pending

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m05.sent.title` | Email sent | ui | 26 | Replaces the form, `motion-enter` (reduced: fade) |
| `m05.sent.body` | We sent it to {email}. Once they say yes, your account is ready. Keep playing in the meantime. | ui | 130 | `{email}` in `type-body-strong` so a typo is easy to spot |
| `m05.sent.continue` | Keep playing | ui | 20 | Orange CTA → M07 |
| `m05.sent.resend` | Send it again | ui | 24 | Ghost |
| `m05.sent.change_email` | Change email | ui | 24 | Ghost; returns to the form with the email kept |
| `m05.sent.resent` | Sent again. | ui | 24 | Polite announcement |
| `m05.badge.pending` | Waiting for a grown-up | ui | 24 | `Badge tone="neutral"` in `StatusRow` on later screens |
| `m05.badge.pending.a11y` | Your account is waiting for a parent or guardian to say yes. | ui | — | |

## Approved

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m05.approved.toast` | Your parent or guardian said yes. Your account is ready. | ui | 64 | `ToastCard variant="success"`, once, next app open. The badge then goes |

## Denied

A full daylit screen on the next app open (`03-direction.md`). One action. Decision #15: the hatched Mon stays with Dr. Alessandra Santoro; the child's personal data is deleted; if consent comes later, the Caller starts fresh.

`{monName}` is the nickname from M09. If the player never reached M09, use the `.unnamed` variant. The screen must not show until deletion has finished, because the copy states it in the past tense.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m05.denied.title` | {monName} is staying with Dr. Santoro | ui | 52 | Hatched, named | Decision #15; Santoro: `V11 ¶83`, `¶84` |
| `m05.denied.title.unnamed` | Your Mon is staying with Dr. Santoro | ui | 52 | Hatched, not yet named | Decision #15 |
| `m05.denied.body.reason` | Your parent or guardian said no to an account. That's their call, and you didn't do anything wrong. | ui | 120 | | — |
| `m05.denied.body.mon` | Dr. Santoro will keep {monName} safe. | ui | 80 | `.unnamed`: "Dr. Santoro will keep your Mon safe." How she does it is `TODO(canon)` (#15); the copy promises nothing more than the decision says | Decision #15 |
| `m05.denied.body.data` | We've deleted everything this app saved about you. | ui | 80 | Required by COPPA; platform confirms deletion before the screen shows | ADR 0001 |
| `m05.denied.body.later` | If they change their mind later, you can start fresh as a new Caller. | ui | 96 | "Start fresh" is the honest limit of #15. It does not promise this Mon back | Decision #15; Caller: `V11 ¶109` |
| `m05.denied.close` | Close | ui | 20 | Returns to first run (M01 → M02) |
| `m05.denied.illustration.alt` | TODO(canon) | — | — | Santoro custody art does not exist (#15) | — |
| `m05.denied.santoro_line` | TODO(canon) | character | — | Optional Santoro line. Stays empty unless canon supplies her words | — |

**Denied before a Mon hatched.** #15 covers a hatched Mon only. If the player has no egg yet, use `.no_mon` below. If an egg is incubating, the outcome is `TODO(canon)` (open question 1); until Mike rules, platform must not ship the denied screen for that case.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m05.denied.title.no_mon` | Your parent or guardian said no | ui | 52 | No egg chosen yet |
| `m05.denied.body.no_mon` | That's their call, and you didn't do anything wrong. We've deleted everything this app saved about you. If they change their mind later, you can start fresh. | ui | 180 | |
| `m05.denied.title.egg` | TODO(canon) | ui | — | Egg incubating or ready; open question 1 |

## Expired (no answer in the retention window)

Same effect as denied (`03-direction.md`), and the request offers to go again. `{days}` is the retention window, which is not set yet (`06-critique.md` blocker 4).

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `m05.expired.title` | We didn't hear back | ui | 26 | |
| `m05.expired.body` | Your parent or guardian didn't answer within {days} days, so we deleted the request and their email address. | ui | 130 | FAQ C.11 |
| `m05.expired.body.mon` | Dr. Santoro is keeping {monName} safe. | ui | 80 | Only if a Mon hatched; `.unnamed` as above. Depends on open question 2 |
| `m05.expired.send_again` | Ask again | ui | 20 | Orange CTA → the ask form, empty |
| `m05.expired.close` | Not now | ui | 20 | Ghost |

## Email to the parent or guardian

Plain text only (the mailer in `packages/payload/src/auth/email.ts` sends `text`). Sender name "NYC-MON". No urgency words. "Caller" is explained on first use (`01-research.md`). The consent method (email plus or stronger) is counsel's call (ADR 0001); the two links below assume a simple yes/no page and change if counsel picks another method.

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `mail.consent.from_name` | NYC-MON | ui | — | |
| `mail.consent.subject` | Your child asked to set up an NYC-MON account | ui | 60 | Plain, no "action required", no "verify" |
| `mail.consent.body.intro` | Hi. Someone entered this email address in the NYC-MON app and asked you to approve an account for a child under 13. | ui | — | Says how the address got there |
| `mail.consent.body.what` | NYC-MON is a game set in New York. Players look after a creature called a Mon on their phone. The game calls players Callers. | ui | — | |
| `mail.consent.body.keep` | If you say yes, we keep your child's birth year, the Caller name they choose and their Mon's progress, so the game works on a new phone. | ui | — | TODO(counsel): confirm the full list against the data model before launch |
| `mail.consent.body.dont` | We show no ads based on what your child does, and the only notification is sent by the phone itself when an egg is ready. | ui | — | ADR 0001: no behavioural ads; local notifications only, no push token. Re-check if Phase 2 adds anything |
| `mail.consent.body.no` | If you say no, we delete your email address and everything your child saved with us. In the game, their Mon goes to stay with one of the characters, so your child doesn't see it deleted. | ui | — | Decision #15 in parent terms |
| `mail.consent.body.silence` | If you don't answer within {days} days, we delete this request and your email address. | ui | — | FAQ C.11 |
| `mail.consent.link.yes` | Yes, set up the account: {yesUrl} | ui | — | |
| `mail.consent.link.no` | No thanks: {noUrl} | ui | — | |
| `mail.consent.link.notice` | Read our children's privacy notice: {noticeUrl} | ui | — | |
| `mail.consent.footer` | You got this email because someone typed your address into NYC-MON. If you don't know who, you can ignore it and we'll delete it in {days} days. | ui | — | Anti-phishing reassurance |

## Open questions

1. **Egg in the case when consent is denied.** Decision #15 covers a hatched Mon. If the guardian says no while an egg is incubating or ready, does the egg also stay with Santoro, and does it hatch first? Goes to Mike. `TODO(canon)`.
2. **Expired with a hatched Mon.** `03-direction.md` says expired has the same effect as denied. If so, the Mon is with Santoro and "Ask again" starts a fresh game. If not, the Mon stays local until a new answer. Needs the lead's ruling and the retention window (`{days}`).
3. **Offline at Send.** Can the child go on to M07 with the email unsent and queued, or must Send succeed first? The copy above assumes it must succeed.
4. **Consent method.** Email plus or stronger (ADR 0001, counsel). The email's yes/no links change if counsel picks another method.

## Reduced motion

No copy changes. The sent state fades in; the denied screen has no animation.

## Slopmonster gate

`deslop.py` over every String cell (screen and email; `TODO(canon)` rows skipped): **5/5 CLEAN**. Rival-model cleanse (`tools/cleanse.sh`) not run.
