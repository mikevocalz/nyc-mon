# M03 Sign in / Create account: direction

Inputs: `01-research.md`, `docs/design/DECISIONS.md` (P1, D8), ADR `docs/adr/0001-auth-and-identity.md`, `docs/DESIGN_SYSTEM.md`. Route `/(auth)/sign-in`. Shell: none. States: idle / loading / error (per provider) / passkey unsupported.

## Two intents, one screen, decided before arrival (P1)

- **create**: reached only after M04 (and M05 for under-13s). Under-13s never reach Apple or Google here: ADR 0001 creates no account for them. The create intent is for 13+ only.
- **sign-in**: reached from M02 "Sign in" or from M01 when a session expired. No age step.

The screen title states the intent in `type-title`; a single text link under it switches intent ("New here?" ↔ "Already a Caller?", final words `ux-writer`). Switching from sign-in to create routes to M04 first, not in place (P1).

## The one move

Nothing decorative. A concrete page, the title, four stacked full-width provider buttons, legal links. The calm is the point: this is the one screen where a teen hands over an identity.

## Layout (iPhone SE, 375 × 667)

```
 ┌──────────────────────────────┐
 │ ‹                            │  back (stack header)
 │ Title, type-title            │  y ≈ 64
 │ switch-intent link           │
 │                              │
 │ [  Sign in with Apple      ] │  48 pt each, 12 pt gap
 │ [  Continue with Google    ] │
 │ [  Use a passkey           ] │
 │ [  Continue with email     ] │  expands inline to one email field + Continue
 │                              │
 │ Terms · Privacy · Children's │  type-caption, ends above y ≈ 600 on SE
 └──────────────────────────────┘
```

Total: 64 + 24 + 32 + 4 × 48 + 3 × 12 + 24 + 36 ≈ 408 pt of content; fits SE without scroll with room for Dynamic Type L. At XXL the page scrolls; legal links stay reachable.

Email expands in place (no modal stacking, §4.1). Apple and Google sheets are the only modals.

## States

| State | Treatment |
|---|---|
| idle | as drawn |
| loading (per provider) | the tapped button shows `loading`; others disable; no full-screen overlay |
| error (per provider) | `ErrorMessage` under the tapped button, plain cause and next step; other providers stay available |
| passkey unsupported | the passkey button is not shown; no error, nothing the Caller caused (`01-research.md`) |
| verification sent (email) | inline confirmation with "Resend" and "Change email" (ADR 0001 lockout risk) |

## Type

`type-title` title, `type-label` buttons, `type-caption` legal. Signage black on `concrete-50`.

## Colour

No orange on this screen except the email path's Continue button. Provider buttons follow their brands' rules (Apple: black or white; Google: its own). The email button is a white face with a `concrete-600` edge (5.33:1 on `concrete-50`, ui).

## No-list

- No sign-in with Apple/Google on the create path before M04 (P1).
- No modal over a system sheet.
- No "device", no "owner" (Law 9).
- No password-only create.
- No marketing hero image; the H-Lynk does not appear (D1).
