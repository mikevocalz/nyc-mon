# M03 Sign in / Create account: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Page | `KeyboardAwareScroll` + `@acme/ui/primitives` `Main`, `Heading level={1}` | | exist |
| Title | `Heading` `size="title"` | | exists |
| Intent switch | `Button` `variant="ghost"` `size="sm"` `tone="royal"` | | exists |
| Apple | `AuthProviderButton` `provider="apple"` | `style` black on daylit, white on dark | NEW |
| Google | `AuthProviderButton` `provider="google"` | | NEW |
| Passkey | `AuthProviderButton` `provider="passkey"` | hidden when unsupported | NEW |
| Email | `AuthProviderButton` `provider="email"` expanding to `TextField` (`label`, `textContentType="emailAddress"`) + `Button` `variant="primary"` `tone="orange"` | | NEW + exist |
| Per-provider error | `ErrorMessage` | | exists |
| Verification sent | `Text` `variant="body"` + `Button` `variant="ghost"` ×2 | | exist |
| Legal links | `@acme/ui/html` `Link` ×3 | `type-caption` | exists |

## New components

### `AuthProviderButton`

| Prop | Type | Notes |
|---|---|---|
| `provider` | `'apple' \| 'google' \| 'passkey' \| 'email'` | exhaustive switch |
| `intent` | `'create' \| 'sign-in'` | label wording |
| `loading`, `disabled` | `boolean` | |
| `onPress` | `() => void` | |

Apple and Google buttons must meet each brand's published rules (Apple HIG Sign in with Apple, https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple; Google sign-in branding, https://developers.google.com/identity/branding-guidelines). On iOS the Apple button should be the native `ASAuthorizationAppleIDButton`; verify `expo-apple-authentication` is installed before targeting it (Law 2). Stories: `AllProviders`, `Loading`, `Error`, `PasskeyHidden`, `Dark`.

The Apple and Google marks are not in the repo (`docs/REPO_MAP.md` §7). The logo rule (§0A.2) forbids redrawing them: the brand-supplied assets must be added to `packages/assets` first.

## Token diffs

Email button edge: `concrete-600` on `concrete-50` = 5.33:1 (ui, passes). Uses `docs/DESIGN_SYSTEM.md` tokens only.
