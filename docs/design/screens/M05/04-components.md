# M05 Parental consent: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Page | `KeyboardAwareScroll`, `Main`, `Heading level={1}` | | exist |
| Guardian email | `TextField` | `label`, `textContentType="emailAddress"`, `keyboardType="email-address"`, `autoComplete="off"` | exists |
| Email preview | `Collapsible` with `Text` body | | exists |
| Send | `Button` `variant="primary"` `tone="orange"` `size="lg"` `loading` | | exists |
| Sent state | `Text` + `Button` `variant="ghost"` ×2 (Resend, Change email) | | exist |
| Pending badge | `Badge` | needs a daylit neutral tone (`concrete-700` on `concrete-100`) | variant needed |
| Approved | `ToastCard` `variant="success"` via `notify` | | exists |
| Denied / expired | `EmptyState` with `action` | `title`, `description`; needs an optional `illustration` slot for the Santoro art | variant needed |
| Status row host | `StatusRow` | NEW, shared with M01 offline and the H-Lynk chip | NEW |

## New variants or components

- `Badge` `tone="neutral"` for daylit status (story `Neutral`).
- `EmptyState` `illustration` slot (story `WithIllustration`).
- `StatusRow`: a one-line row under the safe top inset for onboarding-time statuses (pending consent, offline). Props: `items: { id, label, tone }[]`. Stories `Pending`, `Offline`, `Both`.

## Token diffs

None beyond `docs/DESIGN_SYSTEM.md`.
