# M05 Parental consent: handoff

Implementation contract for `platform` (server and app) and the kit. Inputs: `01-research.md` to `07-a11y.md`, ADR `docs/adr/0001-auth-and-identity.md` § Age and consent, canon Decision #15, `docs/design/DECISIONS.md` (P1), FTC COPPA FAQ C.11, I.2, I.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), 16 CFR 312.5 (https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5), `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

M05 has the most open decisions in M01–M07. The ask and pending states can be built now; approved, denied and expired cannot ship until their rows clear.

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | **Consent method: email-plus or a stronger 312.5(b) method. Counsel's call** (ADR 0001). The ask copy, the email body and both links change with it | counsel → lead | the email (`mail.consent.*`), the yes/no pages, launch |
| B2 | **Denied with an egg incubating or ready: `TODO(canon)`** (`m05.denied.title.egg`, `05-copy.md` open question 1). Decision #15 covers a hatched Mon only. Until Mike rules, the denied screen must not ship for that case | Mike (canon) | denied, egg case |
| B3 | **Santoro custody art and any Santoro line: `TODO(canon)`** (#15; `m05.denied.illustration.alt`, `m05.denied.santoro_line`). The screen ships without both, never with a placeholder | Mike, `3d-lookdev` | denied visuals only |
| B4 | **Retention window `{days}`** (FAQ C.11) | lead + counsel | expired state, `mail.consent.body.silence`, `mail.consent.footer` |
| B5 | **Expired with a hatched Mon**: same effect as denied, or the Mon stays local until a new answer (`05-copy.md` open question 2) | lead | expired state |
| B6 | **Offline at Send**: may the child continue to M07 with the email queued? Copy assumes Send must succeed (open question 3) | lead | offline path |
| B7 | `TODO(counsel)` on `mail.consent.body.keep`: the list of retained data checked against the data model | counsel | the email |
| B8 | Server: the `guardian-consents` collection and endpoints are **designed in ADR 0001 but not built**; Resend has no key yet | `platform` | everything after Send |
| B9 | Kit: shared daylit fixes; `TextField surface="daylit"`; `Badge tone="neutral"` at a 13 pt+ text size; `EmptyState illustration` slot; `StatusRow` (NEW) | kit | the screen |

## Route and intent

Route `/(auth)/consent`. Shell: none. Theme: OS appearance (D8). Reached from M04 when `isConsentRequired(birthYear, currentYear)`. Denied and expired are entered from `resolveBootRoute` on the next app open (`M01/08-handoff.md`).

| Priority | Intent |
|---|---|
| P1 | Tell the child they can keep playing, before anything else |
| P2 | Collect one thing: a parent or guardian's email (FAQ I.2) |
| P3 | Pending never blocks play; approved and denied arrive on a later app open |
| P4 | Denied is no one's fault, never shows the Mon deleted, and only shows after deletion has finished |

## Layout

Compact: back; title; body; email field with hint; preview toggle (expands the email inline); Send pinned 16 pt above the safe bottom inset or above the keyboard. Sent replaces the form in place. Denied and expired are full screens: title, body paragraphs, optional illustration slot, action(s) pinned at the bottom.

| Class / posture | Layout |
|---|---|
| Medium and up | single column, max 480 pt, centred |
| Book posture | column in the leading pane |
| Tabletop | form above the hinge, keyboard below |

`StatusRow` on later screens sits under the safe top inset. On H-Lynk screens (M08 onward) it sits below the scanner head inside `HLynkScreen`'s `statusRow`, never over the head (`06-critique.md`).

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Scroll | `KeyboardAwareScroll` | — | `m05-scroll` |
| Page | `Main` | — | `m05-main` |
| Title | `Heading level={1}` `size="title"` | | `m05-title` |
| Body | `Text` `variant="body"` | | `m05-body` |
| Form | `@acme/ui/html` `Form` | | `m05-form` |
| Guardian email | `TextField` `surface="daylit"` | `label`, `hint`, `error`, `textContentType="emailAddress"`, `keyboardType="email-address"`, `autoComplete="off"` | `m05-field-guardian-email` |
| Preview | `Collapsible` with `Text` on `surface-sunken` | | `m05-preview` |
| Send | `Button` `variant="cta"` `size="lg"` `fullWidth` `loading` | | `m05-send` |
| Sent | `Heading level={2}`, `Text`, `Button variant="cta"` (Keep playing), `Button variant="ghost" size="md"` ×2 | | `m05-sent`, `m05-keep-playing`, `m05-resend`, `m05-change-email` |
| Pending badge | `StatusRow` item, `Badge tone="neutral" size="md"` | | `status-consent-pending` |
| Approved | `notify` → `ToastCard variant="success"` | persists until dismissed or read | `m05-toast-approved` |
| Denied / expired | `EmptyState` | `title`, `description`, `illustration` (absent until B3), `action` | `m05-denied`, `m05-expired` |
| Denied close | `Button variant="ghost" size="md" fullWidth` | | `m05-denied-close` |
| Expired actions | `Button variant="cta"` (Ask again), `Button variant="ghost"` (Not now) | | `m05-ask-again`, `m05-expired-close` |

### `StatusRow` contract (R5)

Shared by M02 (offline), M05 (pending), M11 (notifications off). One status per item, discriminated by tone so an action is typed where it exists:

```ts
/** The look of one {@linkcode StatusRow} item. */
export type StatusTone = 'neutral' | 'info' | 'danger';

/** One line in a {@linkcode StatusRow}. */
export interface StatusItem {
  /** Stable key; also the testID suffix (`status-{id}`). */
  id: string;
  /** Visible text, at least `type-caption`. */
  label: string;
  /** Spoken text when it must say more than the visible label. Defaults to `label`. */
  accessibilityLabel?: string;
  tone: StatusTone;
  /** One optional text action, e.g. "Open Settings". */
  action?: { label: string; accessibilityHint?: string; onPress: () => void };
}

export interface StatusRowProps {
  items: readonly StatusItem[];
}
```

New items announce politely once. Items never use colour alone: each tone carries its text.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page | `bg` | `night` |
| Text | `text`, `text-muted` | #F8F8F8, `silver` |
| Preview well | `surface-sunken` `concrete-100` | #000212 |
| Pending badge | `concrete-700` on `concrete-100` | `silver` on #000212 |
| Success mark | `success` `leaf-700` | `leaf-500` |
| Links, focus | `accent`, `focus` | night values |
| Error | `danger` | night value |
| CTA | `cta` / `on-cta` | same tokens |

Measured pairs: `07-a11y.md`. No orange outside the one CTA per state. No lock icon anywhere.

## States

| State | When | Copy IDs |
|---|---|---|
| Ask | arrival from M04 | `m05.ask.title`, `m05.ask.body`, `m05.field.label`, `m05.field.hint`, `m05.preview.toggle` (+ `.a11y.hint`), `m05.send`, `m05.send.loading`; preview shows `mail.consent.*` |
| Ask, error | after Send | `m05.error.email.invalid`, `m05.error.offline`, `m05.error.server` |
| Sent (pending) | Send succeeds | `m05.sent.title`, `.body`, `.continue`, `.resend`, `.change_email`, `.resent` |
| Pending, later screens | `consentStatus === 'pending'` | `m05.badge.pending`, `m05.badge.pending.a11y` |
| Approved | next app open after approval | `m05.approved.toast` (once), badge removed |
| Denied, hatched + named | `consentStatus === 'denied'`, Mon named | `m05.denied.title`, `.body.reason`, `.body.mon`, `.body.data`, `.body.later`, `.close` |
| Denied, hatched, unnamed | | `m05.denied.title.unnamed` + body with `.unnamed` substitution |
| Denied, no egg yet | | `m05.denied.title.no_mon`, `m05.denied.body.no_mon`, `.close` |
| Denied, egg incubating / ready | | `m05.denied.title.egg` **`TODO(canon)`, blocked (B2)** |
| Expired | retention window passed | `m05.expired.title`, `.body`, `.body.mon` (if hatched, pending B5), `.send_again`, `.close` |

Navigation: Keep playing → M07. Close (denied) → first run (M01 → M02) after local data is cleared. Ask again → the empty ask form. Not now → the previous screen state (the Caller keeps playing locally until B5 rules).

Ordering rule: the denied screen renders only after the server confirms deletion **and** the app has cleared the child's local personal data, because its copy is in the past tense (`05-copy.md`).

## Motion and reduced motion

| Motion | Full | Reduced |
|---|---|---|
| Sent replaces form | `motion-enter` | 200 ms fade |
| Preview expand | `Collapsible` animation | instant |
| Approved toast | kit enter | fade |
| Denied / expired | none | none |

## Empty, error, offline

- Errors after Send, in the field (`m05.error.email.invalid`) or under Send (`.offline`, `.server`).
- Offline: Send fails with `m05.error.offline` (until B6 rules otherwise). The child is not stuck: Back still works.
- Resend failure uses `m05.error.server`.
- Missing art (B3): the illustration slot renders nothing.

## Data

| Need | Source |
|---|---|
| Consent rule | `@acme/core` `isConsentRequired` (M04) |
| Consent state | `CallerProfileSchema.consentStatus` (`not-required` / `pending` / `approved` / `denied`) in `@acme/core`; local save mirrors the server |
| Request | NEW server endpoint creating a `guardian-consents` record `{ parentEmail, birthYear, status: 'pending', expiresAt }` (ADR 0001), zod-parsed request and response (Law 5), versioned under `/v1` with the §1.4 contract. No child email, name or identity is sent |
| Mail | Resend through `packages/payload` (Decision #3), plain text from `mail.consent.*` |
| Queued play | `@acme/core` write queue; replays on approval (ADR 0001) |
| Mon name for denied copy | the M09 nickname from the local save, else `.unnamed` |

The guardian email is held only on the server record and is deleted on denial or expiry (312.5(c)(1)). The app keeps it in memory for the sent screen and does not persist it beyond the pending request.

## Accessibility contract

`07-a11y.md`: focus to the title on every state change; sent focus to `m05.sent.title`; preview expanded state; errors assertive after Send; approved toast persists until dismissed or read; badge text ≥ 13 pt; denied reading order puts reassurance before data; empty illustration renders nothing.

## Tests to write

| Kind | Test |
|---|---|
| Unit | request payload contains only `parentEmail` and `birthYear`; no child identifiers |
| Unit | state routing from `consentStatus` and save contents to each denied variant; egg case is unreachable while B2 is open (feature-flagged off) |
| Unit | denied screen does not render before the deletion confirmation resolves |
| Unit | no string on M05 contains a countdown, "hurry", lock language, or a Santoro line (`TODO(canon)` rows render nothing) |
| Unit (`packages/ui`) | `StatusRow` exhaustive tone switch; `Badge tone="neutral"` sizes; `EmptyState` with an absent illustration leaves no gap |
| Unit (`packages/theme`) | M05 pairs in `contrast.test.ts` |
| Story | `StatusRow/Pending`, `/Offline`, `/Both`; `Badge/Neutral`; `EmptyState/WithIllustration`, `/WithoutIllustration` |
| Visual | ask, ask with preview open, sent, denied (named, unnamed, no Mon), expired; daylit and night; SE default and XXL |
| Integration (server) | create, approve, deny, expire a `guardian-consents` record; expiry deletes the email |
| a11y (web) | axe; Enter submits; Escape collapses the preview |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] Resend delivery of the guardian-consent email (DEVICE_CHECKS "Resend delivery").
- [ ] VoiceOver and TalkBack on ask, sent, denied; the denied screen in one swipe pass.
- [ ] Dynamic Type XXL on SE: `{email}` never truncates; Close reachable.
- [ ] The email read by iOS Mail and Gmail screen readers as plain text.
