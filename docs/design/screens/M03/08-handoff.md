# M03 Sign in / Create account: handoff

Implementation contract for `platform` and the kit. Inputs: `01-research.md` to `07-a11y.md`, ADR `docs/adr/0001-auth-and-identity.md`, `docs/design/DECISIONS.md` (P1, D8), canon Decisions #2, #3, `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Kit daylit fixes: ghost label → `accent`; `ErrorMessage` → `danger`; `Button variant="cta"`; full-width labels wrap (`M02/07-a11y.md`, `07-a11y.md`) | kit | every control on M03 |
| B2 | `TextField surface="daylit"` (white face, `concrete-600` edge, label above) | kit | email block |
| B3 | `AuthProviderButton` with stories `AllProviders`, `Loading`, `Error`, `PasskeyHidden`, `Dark` (R3) | kit | providers |
| B4 | Apple and Google brand assets added to `packages/assets` from the brands' own downloads. Agents never redraw a logo (§0A.2) | lead | Apple (Android/web fallback), Google |
| B5 | Law 2 reads: `expo-apple-authentication` and `@better-auth/expo` are **not installed** (checked `node_modules` 2026-10-04; DEVICE_CHECKS "Sign in with Apple and Google in the Expo app"). Install, then read their types before targeting them | `platform` | Apple, Google on native |
| B6 | P1 guard: the `create` intent is unreachable without a stored age answer from M04, and never for under-13 | `platform` | create intent |
| B7 | Open question 6 (`COPY_DECK.md`): can Better Auth's passkey plugin create an account, or only add a passkey to one? `@acme/auth` today exposes `addPasskey()` and `signIn({ method: 'passkey' })` only. Until confirmed, the create intent does **not** render the passkey button | `platform` | passkey on create |

## Route and intent

Route `/(auth)/sign-in?intent=create|sign-in`. Shell: none. Theme: OS appearance (D8). The intent is a required, validated search param (zod), never inferred.

| Priority | Intent |
|---|---|
| P1 | Sign in or create with the fewest steps: Apple, Google, passkey, then email |
| P2 | Per-provider failure with a plain next step; the other providers stay live |
| P3 | Email verification and password reset inline, never a stacked modal |
| P4 | Legal links visible without scroll on SE |

## Layout

Compact (SE 375 × 667), per `03-direction.md`: back at the stack header; title at y ≈ 64; subtitle; intent switch; four 48 pt provider buttons with 12 pt gaps; legal block ending above y ≈ 600. 16 pt gutter.

| Class / posture | Layout |
|---|---|
| Medium and up | single column, max 480 pt, centred, 24 pt gutter |
| Book posture | column in the leading pane |
| Tabletop | column above the hinge; keyboard below |

The provider stack never straddles a hinge (`@acme/ui/adaptive-panes`, port in progress).

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Scroll + keyboard | `KeyboardAwareScroll` | — | `m03-scroll` |
| Page | `Main` | — | `m03-main` |
| Title | `Heading` `level={1}` `size="title"` | | `m03-title` |
| Subtitle | `Text` `variant="body"` `tone="muted"` | | `m03-subtitle` |
| Intent switch | `Button` `variant="ghost"` `size="md"` | `tone="royal"` | `m03-switch-intent` |
| Apple | `AuthProviderButton` | `provider="apple"`, `intent` | `m03-provider-apple` |
| Google | `AuthProviderButton` | `provider="google"`, `intent` | `m03-provider-google` |
| Passkey | `AuthProviderButton` | `provider="passkey"`, `intent`; not rendered when unsupported or on create until B7 | `m03-provider-passkey` |
| Email | `AuthProviderButton` | `provider="email"`, `expanded` | `m03-provider-email` |
| Email form | `@acme/ui/html` `Form` | — | `m03-email-form` |
| Email / password | `TextField` `surface="daylit"` | `label`, `hint`, `error`, `textContentType`, `autoComplete`, `secureTextEntry` | `m03-field-email`, `m03-field-password` |
| Show password | `IconButton` | 44 pt, toggle state | `m03-password-toggle` |
| Submit | `Button` `variant="cta"` `size="lg"` `fullWidth` `loading` | the only orange | `m03-email-submit` |
| Forgot | `Button` `variant="ghost"` `size="md"` | sign-in only | `m03-password-forgot` |
| Errors | `ErrorMessage` | under the provider that failed | `m03-error-{provider}` |
| Verify / reset blocks | `Heading level={2}`, `Text`, `Button` ghost ×2 | | `m03-verify`, `m03-reset` |
| Legal | `Text` `variant="caption"` with `@acme/ui/html` `Link` ×3, underlined | | `m03-legal-terms`, `-privacy`, `-children` |

### `AuthProviderButton` contract (R5)

```ts
/** The sign-in methods M03 offers. Rendered by {@linkcode AuthProviderButton}. */
export type AuthProvider = 'apple' | 'google' | 'passkey' | 'email';

/** Whether M03 is creating an account or signing in. Picks the label wording. */
export type AuthIntent = 'create' | 'sign-in';

export interface AuthProviderButtonProps {
  provider: AuthProvider;
  intent: AuthIntent;
  /** Shows the provider's loading label and spinner; the button stays focused. */
  loading?: boolean;
  disabled?: boolean;
  /** Email only: whether the inline email form is open. */
  expanded?: boolean;
  onPress: () => void;
}
```

`provider` is switched exhaustively. On iOS, `provider="apple"` renders the native `ASAuthorizationAppleIDButton` (after B5) with `type` SIGN_UP / SIGN_IN; the kit never draws an Apple mark on iOS. The component holds no auth logic: the screen calls `@acme/auth`.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page | `bg` `concrete-50` | `night` |
| Title / subtitle | `text` / `text-muted` | #F8F8F8 / `silver` |
| Ghost links, legal links, focus | `accent` / `focus` `royal-500` | `carolina-500` |
| Passkey and email faces | `surface-raised` #FFFFFF, edge `concrete-600` | #0A1230, edge `silver` |
| Apple | black style | white style |
| Google | light theme (#FFFFFF, stroke #747775, text #1F1F1F) | dark theme (#131314, stroke #8E918F, text #E3E3E3) |
| Error | `danger` | `danger` (night value) |
| Submit | `cta` / `on-cta` / `cta-pressed` | same tokens |
| Type | `type-title`, `type-body`, `type-label`, `type-caption` | |

Measured pairs: `07-a11y.md`.

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| idle, create | title, subtitle, switch, providers, legal notice + links | `m03.title.create`, `m03.subtitle.create`, `m03.switch.to_sign_in`, `m03.provider.*.label.create`, `m03.legal.notice.create`, `m03.legal.*` |
| idle, sign-in | same without the notice | `m03.title.sign_in`, `m03.subtitle.sign_in`, `m03.switch.to_create`, `m03.provider.*.label.sign_in` |
| loading (per provider) | tapped button busy, others disabled | `m03.provider.apple.loading`, `.google.loading`, `.passkey.loading`, `m03.email.loading`, `m03.email.loading.create` |
| cancelled sheet | nothing shown, focus back on the button | `m03.error.apple.cancelled`, `.google.cancelled`, `.passkey.cancelled` (empty) |
| error, Apple / Google | under that button | `m03.error.apple.failed`, `m03.error.google.failed` |
| error, passkey | under the passkey button | `m03.error.passkey.not_found`, `m03.error.passkey.failed` |
| error, email | under the field or submit | `m03.error.email.invalid`, `.credentials`, `.password.too_short`, `.password.too_long`, `.account_exists`, `.not_verified` |
| offline | under the tapped button | `m03.error.offline` |
| server | under the tapped button | `m03.error.server` |
| needs age | no message, silent route to M04 | `m03.error.needs_age` |
| passkey unsupported | button not rendered, no copy | — |
| email expanded | fields, submit, forgot (sign-in) | `m03.email.field.label`, `m03.password.field.label`, `m03.password.field.hint.create`, `m03.password.show.a11y.label`, `m03.password.hide.a11y.label`, `m03.email.submit.*`, `m03.password.forgot` |
| verification sent | replaces the email block | `m03.verify.title`, `.body`, `.resend`, `.change_email`, `.resent`, `.resend.wait`, `.stuck` |
| password reset | replaces the email block | `m03.reset.title`, `.body`, `.submit`, `.sent`, `.unavailable` |

Error mapping: `AuthResult` `{ ok: false, error }` → `error.code` (Better Auth codes listed in `05-copy.md`) → copy ID, through one exhaustive map in the app. Unknown codes map to `m03.error.server`. `error.status === 0` maps to `m03.error.offline`. Server text is never shown.

Navigation: success, create → M07 (13+). Success, sign-in → M01 route resolution (`resolveBootRoute`). Intent switch to create → M04. Back → previous route.

## Motion and reduced motion

| Motion | Full | Reduced |
|---|---|---|
| Email block expand, verify/reset replace | `motion-enter` 300 ms | 200 ms fade |
| Press | `motion-tap` | colour only |
| Spinner in button | kit activity indicator | same |

## Empty, error, offline

No empty state. Errors per provider (above). Offline: every provider shows `m03.error.offline` on tap; nothing is queued, because an account needs the server. No full-screen overlay in any state.

## Data

| Need | Source |
|---|---|
| Sign in | `@acme/auth` `createAuth(...).signIn(SignInRequest)` → `AuthResult` (never throws; branch on `ok`) |
| Create (email) | `signUp(SignUpRequest)` with `birthYear` from the stored M04 answer |
| Passkey sign-in | `signIn({ method: 'passkey' })`; create path waits on B7 |
| Social | `signIn({ method: 'social', provider, callbackURL })` on web; native Apple/Google via B5 packages, then the Better Auth Expo client |
| Stored age answer | app store slice persisted in MMKV (written by M04); zod-parsed on read |
| Passkey support | platform capability check at mount (no error when absent) |

`signUp.name` is required by `SignUpRequest`. The Caller name is not known until M07: platform decides what goes there (a server-side placeholder that is never shown, or a later update). Never ask the player for a real name here.

## Accessibility contract

`07-a11y.md`: focus order; focus to the email field on expand, to the error after submit, to the verify title; focus returns to the provider after a sheet closes; throttle label updates at most every 10 s; paste never blocked; legal links underlined; ghost links 44 pt.

## Tests to write

| Kind | Test |
|---|---|
| Unit | error-code → copy-ID map is exhaustive over the codes in `05-copy.md`; unknown → `m03.error.server`; `status 0` → `m03.error.offline` |
| Unit | create intent without a stored age answer redirects to M04; under-13 answer never reaches create |
| Unit | cancelled Apple/Google/passkey shows no message |
| Unit | passkey button absent when unsupported, and on create until B7 |
| Unit (`packages/ui`) | `AuthProviderButton` exhaustive provider switch; `TextField surface="daylit"` colours; `ErrorMessage` uses `danger` |
| Unit (`packages/theme`) | M03 pairs in `contrast.test.ts`, including the Google stroke on both pages |
| Story | `AuthProviderButton/*`; `TextField/Daylit`; `ErrorMessage/Daylit` |
| Visual | idle create, idle sign-in, email expanded, each error, verify sent; daylit and night; SE default and XXL |
| a11y (web) | axe; Enter submits; Escape collapses the email block |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] Passkey ceremonies on iOS and Android (associated domains, asset links).
- [ ] Sign in with Apple and Google in the Expo app.
- [ ] Resend delivery of the verification and reset emails.
- [ ] VoiceOver and TalkBack: focus returns to the provider after each sheet; errors announced once.
- [ ] Dynamic Type XXL on SE: page scrolls, legal links reachable, labels wrap.
