# M04 Birth year gate: handoff

Implementation contract for `platform` and the kit. Inputs: `01-research.md` to `07-a11y.md`, ADR `docs/adr/0001-auth-and-identity.md` § Age and consent, `docs/design/DECISIONS.md` (P1, D9), FTC COPPA FAQ D.7 and H.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Shared kit daylit fixes (ghost label → `accent`, `ErrorMessage` → `danger`, `Button variant="cta"`, `TextField surface="daylit"`) | kit | links, field, Continue |
| B2 | `YearGrid` with stories `DecadeStep`, `YearStep`, `Selected`, `NoDefault`, `LargeText`, `Night`, `ReducedMotion` (R3) | kit | the grid |
| B3 | Lead signs off on two taps (D9) against §4.1 "one tap". If overruled, this handoff is re-issued; nothing below survives a wheel | lead | the whole screen |
| B4 | The stored age answer persists across Back, app kill and relaunch, and gates the P1 routes (M03 create, M05) | `platform` | routing |

## Route and intent

Route `/(auth)/age`. Shell: none. Theme: OS appearance (D8). Reached only from M02 "Get started" or M03's "New here?" switch (P1). Returning sign-in never sees it.

| Priority | Intent |
|---|---|
| P1 | Collect a birth year with no default and no hint at a threshold (FAQ D.7) |
| P2 | Route: under-13 → M05; 13 and over → M03 create |
| P3 | Typed alternative for players who prefer it |
| P4 | Ask once: a stored answer is never re-asked or changeable from Back |

## Layout

Compact (SE): back; title; why line; 3-column grid of 56 pt tiles with 8 pt gaps (8 decades at step 1, up to 10 years at step 2); Change decade and Type it instead links; Continue pinned 16 pt above the safe bottom inset once a year exists. 16 pt gutter.

| Class / posture | Layout |
|---|---|
| Medium and up | single column, max 480 pt, centred; grid stays 3 columns |
| Accessibility text sizes | 2 columns; grid scrolls; Continue pinned |
| Book posture | column in the leading pane |
| Tabletop | title and grid above the hinge, Continue below |

The grid never straddles a hinge (`@acme/ui/adaptive-panes`, port in progress).

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Page | `Main` | — | `m04-main` |
| Title | `Heading level={1}` `size="title"` | | `m04-title` |
| Why | `Text` `variant="body"` `tone="muted"` | | `m04-why` |
| Grid | `YearGrid` | see contract | `m04-grid`; tiles `m04-decade-{1950}`, `m04-year-{2004}` |
| Change decade | `Button` `variant="ghost"` `size="md"` | | `m04-change-decade` |
| Type / pick toggle | `Button` `variant="ghost"` `size="md"` | | `m04-type-instead`, `m04-pick-instead` |
| Field | `TextField` `surface="daylit"` | `label`, `hint`, `error`, `keyboardType="number-pad"`, `maxLength={4}`, `textContentType="none"`, `autoComplete="off"` | `m04-field-year` |
| Validation | `ErrorMessage` (inside the field) | | `m04-error` |
| Continue | `Button` `variant="cta"` `size="lg"` `fullWidth` | rendered only when a year exists | `m04-continue` |

### `YearGrid` contract (R5)

The `04-components.md` sketch used `value: number | null` and a bare `step` string. Revised so absence is `undefined` and the year step carries its decade, which a bare `'year'` could not:

```ts
/** Which page of {@linkcode YearGrid} is showing. */
export type YearGridStep = { kind: 'decade' } | { kind: 'year'; decadeStart: number };

/** Props for {@linkcode YearGrid}, a no-default birth-year picker. */
export interface YearGridProps {
  step: YearGridStep;
  onStepChange: (step: YearGridStep) => void;
  /** The chosen year. Omitted until the player picks one; the grid never supplies a default. */
  selectedYear?: number;
  onSelectYear: (year: number) => void;
  /** Earliest decade shown starts here. */
  minYear: number;
  /** Latest selectable year, normally the current year. Later years are not drawn. */
  maxYear: number;
  reducedMotion?: boolean;
}
```

Decades shown: from `minYear`'s decade to `maxYear`'s decade. The direction draws 1950s–2020s; set `minYear={1950}` for the grid and let the typed field accept 1900 and later (`m04.error.too_early`). Players born before 1950 type their year.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page | `bg` | `night` |
| Title / why | `text` / `text-muted` | #F8F8F8 / `silver` |
| Tile face / label / edge | `surface-raised` / `text` / `concrete-600` | #0A1230 / #F8F8F8 / `silver` |
| Selected | 2 pt `accent` edge + check glyph in `text` | `carolina-500` edge + glyph |
| Links, focus | `accent`, `focus` | night values |
| Error | `danger` | night value |
| Continue | `cta` / `on-cta` | same tokens |
| Type | `type-title`, `type-body`, `type-label` with tabular figures | |
| Space | 56 pt tiles, 8 pt gaps, 16 pt gutter | |

Measured pairs: `07-a11y.md`.

## States

Every visible and spoken string is identical across adult, 13–17 and under-13 (`05-copy.md`). The branch happens after Continue.

| State | What shows | Copy IDs |
|---|---|---|
| Step 1, decades | 8 decade tiles, nothing selected | `m04.title`, `m04.why`, `m04.grid.decades.a11y.label`, `m04.decade.label`, `m04.decade.a11y.hint`, `m04.type_instead` |
| Step 2, years | the decade's years (future removed), nothing selected | `m04.grid.years.a11y.label`, `m04.year.label`, `m04.change_decade` |
| Year selected | check + edge on the tile; Continue appears | `m04.year.a11y.selected`, `m04.continue`, `m04.continue.a11y.hint` |
| Typed | field replaces grid | `m04.field.label`, `m04.field.hint`, `m04.pick_instead` |
| Typed, invalid (on Continue) | error in the field | `m04.error.incomplete`, `m04.error.future`, `m04.error.too_early` |
| After Continue: 18+ / 13–17 | → M03 `intent=create` | — |
| After Continue: under-13 | → M05 | — |

Under-13 rule: `currentYear − birthYear ≤ 13` (ADR 0001). The comparison lives in one pure function in `@acme/core` (`isConsentRequired(birthYear, currentYear)`) so M04, M03's guard and the server agree. Back from M03 or M05 does not reopen M04 with a fresh choice; Back on M04 itself returns to M02 only before Continue.

## Motion and reduced motion

| Motion | Full | Reduced |
|---|---|---|
| Step change, grid ↔ field | `motion-step` 200 ms slide | 120 ms cross-fade |
| Continue appears | `motion-enter` | 200 ms fade |
| Tile press | `motion-tap` | colour only |

No Mon, no reaction to the answer, no haptic difference by year.

## Empty, error, offline

The empty state is the arrival state (nothing selected). Errors only on the typed path. Offline: works fully; the answer is stored locally and sent with sign-up (`SignUpRequest.birthYear`) or with the M05 request.

## Data

| Need | Source |
|---|---|
| Current year | injected clock (`nowMs`), never `new Date()` inside a component, so tests are deterministic |
| Answer storage | app store slice (Zustand, persisted to MMKV): `{ birthYear: number; answeredAtMs: number }`, zod-parsed on read (Law 5) |
| Consent rule | `@acme/core` `isConsentRequired` (NEW, pure) |
| Later use | `CallerProfileSchema.birthYear` (`@acme/core`, min 1900); `SignUpRequest.birthYear` (`@acme/auth`) |

No analytics event carries the year or the branch taken.

## Accessibility contract

`07-a11y.md`: initial focus on the title, never in the grid; step change moves focus to the group label; radiogroup roving focus without checking; selection by glyph + edge + `checked`; validation assertive on Continue only; field `autoComplete="off"`; 2 columns at accessibility sizes.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`@acme/core`) | `isConsentRequired` at the boundary years, matching ADR 0001; property test over 1900–current |
| Unit | every M04 string and accessibility string is identical for any selected year (snapshot of the rendered tree for three years, diffed) |
| Unit | no tile is selected or focused on arrival, in both steps, on native and web |
| Unit | future years are not rendered; typed validation order |
| Unit | stored answer survives a store rehydrate; Back from M03/M05 does not clear it |
| Unit (`packages/ui`) | `YearGrid` keyboard: roving focus does not check; Space checks |
| Story | `YearGrid/*` listed in B2 |
| Visual | step 1, step 2 selected, typed with error; daylit and night; SE default and accessibility size (2 columns) |
| a11y (web) | axe; radiogroup semantics |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] VoiceOver and TalkBack: decade read-out, radiogroup state, nothing preselected.
- [ ] Switch Control (iOS) and Switch Access (Android) through both steps.
- [ ] Dynamic Type XXL and accessibility sizes on SE: 2-column fallback, Continue reachable.
