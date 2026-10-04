# M07 Caller name: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Page | `KeyboardAwareScroll`, `Main`, `Heading level={1}` | | exist |
| Field | `TextField` | `label`, `hint`, `error`, `maxLength`, `autoCorrect={false}`, `textContentType="nickname"` | exists; needs a clear-button affordance (variant) |
| Validation | `ErrorMessage` | | exists |
| Nameplate | `SignagePlate` | see below | NEW |
| Continue | `Button` `variant="primary"` `tone="orange"` `size="lg"` | disabled while empty or invalid | exists |

## New component: `SignagePlate`

The MTA-signage band as a kit component; reused for the Mon's name at M09 and the hatch title.

| Prop | Type | Notes |
|---|---|---|
| `text` | `string` | renders nothing when empty |
| `size` | `'station' \| 'title'` | auto-steps down for long text |
| `scheme` | `'signage'` | black band, white type; one scheme for now |

`accessibilityRole="text"`; label "Caller name preview: {text}". Stories `Short`, `Long`, `Empty`, `LargeText`.

## Variants

- `TextField` `clearable` (story `Clearable`).

## Token diffs

Uses `signage-black` / `signage-white` from `docs/DESIGN_SYSTEM.md`.
