# M07 Caller name: handoff

Implementation contract for `platform` and the kit. Inputs: `01-research.md` to `07-a11y.md`, `docs/design/DECISIONS.md` (P4, D10), Law 9, ADR 0001 (queued writes while consent is pending), `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Shared kit daylit fixes (`ErrorMessage` → `danger`, `Button variant="cta"`, `TextField surface="daylit"`) | kit | field, error, Continue |
| B2 | `SignagePlate` (NEW) and `TextField` clear button (variant) with stories (R3) | kit | plate, clear |
| B3 | Name rules confirmed by `platform`: 1–16 characters after trim; letters in any script plus space, hyphen, apostrophe, period; no digits or emoji (`05-copy.md`, proposal). Open: digits (`COPY_DECK.md` open question 7) | `platform` + lead | validation |
| B4 | The block-list filter exists and is tested on names from the communities `V11 ¶53` lists before launch (`06-critique.md` blocker 2) | `platform` | `m07.error.blocked` |
| B5 | Schema mismatch: `CallerProfileSchema.callerName` in `@acme/core` allows 1–32 characters; the UI rule is 16. Tighten the schema to the confirmed rule so data and UI agree (Law 5) | `sim-core` | storage |

Not blocking: Q32 (do Babies speak) stays open and no longer touches M07 (P4). Name changes later and wrong-block reporting are out of scope (`05-copy.md` open questions 1 and 3); the copy promises neither.

## Route and intent

Route `/(onboarding)/caller`. Shell: none (D1). Theme: OS appearance (D8). Reached from M03 (13+) or M05 sent (under-13). Next: M08.

| Priority | Intent |
|---|---|
| P1 | Get a Caller name the Mon will use, with plain rules and kind errors |
| P2 | Preview it as the H-Lynk will show it, on a signage plate, in the UI voice (P4) |
| P3 | Steer under-13s to a nickname; keep it on the phone while consent is pending |
| P4 | Never call a name offensive |

## Layout

Compact: back; title (two lines on SE); status row item if consent is pending; field with label, hint and clear button; 24 pt gap; plate (full width inside the 16 pt gutter, appears on the first character); Continue pinned above the keyboard.

| Class / posture | Layout |
|---|---|
| Medium and up | single column, max 480 pt, centred; plate keeps its SE width |
| Book posture | column in the leading pane |
| Tabletop | field and plate above the hinge; keyboard below; Continue above the keyboard |

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Scroll | `KeyboardAwareScroll` | — | `m07-scroll` |
| Page | `Main` + `Form` | — | `m07-main` |
| Title | `Heading level={1}` `size="title"` | | `m07-title` |
| Pending status | `StatusRow` | consent pending only (`M05/08-handoff.md`) | `status-consent-pending` |
| Field | `TextField` `surface="daylit"` | `label`, `hint`, `error`, `maxLength={16}`, `autoCorrect={false}`, `autoCapitalize="words"`, `textContentType="nickname"`, `clearButton` | `m07-field-caller-name` |
| Error | `ErrorMessage` (in the field) | | `m07-error` |
| Plate | `SignagePlate` | `text`, `accessibilityLabel` | `m07-plate` |
| Continue | `Button` `variant="cta"` `size="lg"` `fullWidth` | disabled while empty or invalid | `m07-continue` |

### `SignagePlate` contract (R5)

`04-components.md` sketched `size` and a one-value `scheme: 'signage'`. Revised: a prop with one possible value is not an option, so `scheme` waits until a second scheme exists; the size steps down by itself, so the caller sets a ceiling, not a size.

```ts
/**
 * The MTA-style signage band: white type on a black band. Shows the Caller
 * name at M07 and the Mon's name at M09 and the hatch.
 */
export interface SignagePlateProps {
  /** Shown exactly as given. The plate renders nothing for an empty string. */
  text: string;
  /** Spoken label, always with the full text even when the plate truncates. */
  accessibilityLabel: string;
  /** Largest type step to try before stepping down. @default 'station' */
  maxSize?: 'station' | 'title';
}
```

On a night page the plate draws a 1 pt `silver` keyline (`07-a11y.md` finding 4). It is never a live region. Stories: `Short`, `Long`, `Empty`, `LargeText`, `NightPage`.

### `TextField` clear button (variant)

```ts
/** Adds a clear button inside the field. Present only while the field has text. */
clearButton?: { accessibilityLabel: string };
```

One optional object instead of `clearable: boolean` plus a separate label prop: the label is required whenever the button exists. The button is 44 × 44 pt and returns focus to the field. Story: `Clearable`.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page | `bg` | `night` |
| Title / label / hint | `text` / `text-muted` | #F8F8F8 / `silver` |
| Field | `surface-raised`, edge `concrete-600` | #0A1230, edge `silver` |
| Plate | `signage-black` band, `signage-white` text | same + 1 pt `silver` keyline |
| Error | `danger` | night value |
| Continue | `cta` / `on-cta` | same tokens |
| Type | `type-title`, `type-label`, `type-caption`, plate `type-station` → `type-title` | |

Measured pairs: `07-a11y.md`.

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| Empty | no plate, Continue disabled | `m07.title`, `m07.field.label`, hint by audience, `m07.continue`, `m07.continue.a11y.hint.disabled`, `m07.back.a11y.label` |
| Hint, 13+ | | `m07.field.hint` |
| Hint, under-13 (consent approved) | | `m07.field.hint.under13` |
| Hint, under-13 pending | plus the status row | `m07.field.hint.pending`, `m05.badge.pending`, `m05.badge.pending.a11y` |
| Typing | plate updates per keystroke, clear button shown | `m07.plate.a11y.label`, `m07.field.clear.a11y.label` |
| Invalid (after ≥ 1 s pause, and on Continue) | one error at a time, in order; plate keeps the text | `m07.error.blank`, `m07.error.too_long`, `m07.error.characters`, `m07.error.blocked` |
| Confirmed | stored, announced, → M08 | `m07.confirmed.a11y.announce` |

Error order (first failing rule wins): blank → too long → characters → blocked.

## Motion and reduced motion

| Motion | Full | Reduced |
|---|---|---|
| Plate first appears | `motion-enter` 300 ms | instant |
| Per-character update, size step-down | none | none |
| Error | kit fade | instant |
| Press | `motion-tap` | colour only |

## Empty, error, offline

- Empty: the arrival state; the plate is absent (no placeholder name, §0A.2).
- Error: validation only; no server call on this screen.
- Offline: works fully. The name is stored locally. 13+: synced with the account on the next write. Under-13 pending: stays on the phone until approval (ADR 0001 queue).

## Data

| Need | Source |
|---|---|
| Validation | NEW pure function in `@acme/core`: `validateCallerName(raw: string): CallerNameResult` |
| Block list | `platform`-owned list, loaded locally (no network on keystroke) |
| Storage | `CallerProfileSchema.callerName` (`@acme/core`, after B5) in the MMKV save, through the Zustand caller slice |
| Audience for hints | stored M04 answer + `consentStatus` |

```ts
/** Result of {@linkcode validateCallerName}. */
export type CallerNameResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'blank' | 'too-long' | 'characters' | 'blocked' };
```

The app maps `reason` to `m07.error.*` with an exhaustive switch. `name` is the trimmed value; the plate shows exactly what was typed until then.

## Accessibility contract

`07-a11y.md`: initial focus on the title, no native autofocus; plate is not a live region; errors after a ≥ 1 s pause (polite) or on Continue (assertive); disabled Continue stays focusable with its hint; clear returns focus to the field; plate wraps to two lines before truncating, with the full name in its label.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`@acme/core`) | `validateCallerName`: each reason, the order, trimming, accented and non-Latin names pass, 16 vs 17 characters, digits and emoji fail (until B3 changes it) |
| Unit (`@acme/core`) | `CallerProfileSchema` rejects names the UI rejects (after B5) |
| Unit | hint chosen by audience: 13+, under-13, under-13 pending |
| Unit | no M07 string contains "Callah", "offensive", "inappropriate", "not allowed", "device" |
| Unit (`packages/ui`) | `SignagePlate` renders nothing for `''`; steps down from station to title; keyline on night; `TextField clearButton` |
| Story | `SignagePlate/*`; `TextField/Clearable` |
| Visual | empty, typing short and 16-character names, each error, pending; daylit and night; SE default and XXL |
| a11y (web) | axe; Enter submits; no live region on the plate |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] VoiceOver and TalkBack: the plate never speaks on its own; errors speak once after the pause.
- [ ] Dynamic Type XXL on SE with a 16-character name: plate wraps, Continue above the keyboard.
- [ ] Names with accents and non-Latin scripts typed with each platform keyboard.
