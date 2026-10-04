# M04 Birth year gate: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Page | `@acme/ui/primitives` `Main`, `Heading level={1}` | | exist |
| Question | `Heading` `size="title"` | | exists |
| Why line | `Text` `variant="body"` `tone="muted"` | | exists |
| Decade / year grid | `YearGrid` | see below | NEW |
| Type it instead | `Button` `variant="ghost"` `tone="royal"` → `TextField` (`label`, `keyboardType="number-pad"`, `maxLength={4}`, `textContentType="none"`) | | exist |
| Validation | `ErrorMessage` (future year, before 1900) | | exists |
| Continue | `Button` `variant="primary"` `tone="orange"` `size="lg"` | hidden until a year exists | exists |

## New component: `YearGrid`

| Prop | Type | Notes |
|---|---|---|
| `value` | `number \| null` | `null` by default; never a default year |
| `onChange` | `(year: number) => void` | |
| `minYear` / `maxYear` | `number` | `maxYear` = current year |
| `step` | `'decade' \| 'year'` | controlled |

Accessibility: each tile a `button` with its label ("1990s", "2004"); the group is a `radiogroup` at step 2 with `selected` state. Stories: `DecadeStep`, `YearStep`, `Selected`, `NoDefault`, `LargeText`.

A segmented "tile" look on daylit may become a general kit variant (`SegmentedControl` grid); `YearGrid` is the first user.

## Token diffs

None beyond `docs/DESIGN_SYSTEM.md`.
