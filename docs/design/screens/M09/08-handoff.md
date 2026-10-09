# M09 Naming ceremony: handoff

Implementation contract for `platform`, `sim-core` and the kit. Inputs: `01-research.md` to `07-a11y.md`; canon #1, #4, #5, #9, #11, #14; PS-005; Q14, Q17, Q32; design D8, D10; `screens/M07/08-handoff.md`; `packages/core/sim/hatch.ts`, `packages/core/sim/boot.ts`, `packages/app/features/mon/create-mon-store.ts`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `nameActiveMon` store action (missing, contract in § Data) | app (`packages/app/features/mon`) | confirm |
| B2 | Boot: a hatched Mon with `nickname === null` must route here. `OnboardingStep` gains `'mon-name'` in `packages/core/sim/boot.ts` (checked before `companion`), and `bootPath` maps it to `/(onboarding)/name` in the same PR as the route | `sim-core` + `platform` | resume (D19 proposed) |
| B3 | Server seam for the nickname. §1.4 has no endpoint that accepts it: `PUT /v1/mons/:id/care` takes care writes only, and the egg is created with `nickname: null` (Decision #5). Propose `PATCH /v1/mons/:id` with `UpdateMonNicknameRequestSchema = z.object({ nickname: MonNameSchema })`, idempotent, queued offline like care writes | `sim-core` + server | sync of the name |
| B4 | `validateMonName(raw, filter, reserved?)` in `@acme/core/sim`, sharing the character rule and length unit with `validateCallerName`; reasons `'blank' \| 'too-long' \| 'characters' \| 'reserved' \| 'blocked'`; `monNameErrorCopyId(reason)` maps to `m09.error.*` | `sim-core` | validation |
| B5 | Schema: `MonInstanceSchema.nickname`, `EggRecordSchema.nickname` and `CreateEggRequestSchema.nickname` allow 1–64; tighten to the 16-character `MonNameSchema` so data and UI agree (Law 5; same fix as M07 B5) | `sim-core` | storage |
| B6 | `MonStillReaction` (missing primitive) with stories `Tilt`, `Lift`, `ReducedMotion`; per-still pivots for squeaklet, kittee-cee, yotito | kit + lookdev | head tilt |
| B7 | M12 handoff routes `hatched` → M09 (not M13) and leaves the Baby in its last pose for the continuity arrival | `design-director` (M12) | entry |
| B8 | Route path. This file keeps the brief's `/(onboarding)/name`; the M12 lane (`M12/08-handoff.md` B5) proposes `/(home)/name` so M09 shares `/(home)/_layout.tsx` and its `CreatureStage` for an unbroken creature canvas. Pick one before either screen ships; `/(home)/name` is the better fit for continuity, and nothing in this contract depends on the group | lead | route, boot `mon-name` path |

Not blocking: Q32 (sound slot stays off), "Ratti" ruling (reserved list ships empty), Baby models (stills now).

## Route and intent

Route `/(onboarding)/name`. Shell: H-Lynk Core, `scheme="night"` (D18 proposed). Reached from M12 `hatched`, or boot `resume-onboarding` / `mon-name` (B2). Next: M13 `/(home)`.

| Priority | Intent |
|---|---|
| P1 | The Caller names this individual, in its presence |
| P2 | Same plain rules and kind errors as the Caller name |
| P3 | The Baby notices the typing; never judges the name |
| P4 | Write the name to the one `MonInstance`; never create or re-mint (Law 6) |

## Layout by breakpoint

| Breakpoint | Keyboard down | Keyboard up |
|---|---|---|
| Phone portrait | measured shell; 3:4 screen; Baby full-bleed; scrim strip from 45% of screen height down holding caption, title, field, hint, plate; 16 pt gutters, 8 pt between caption and title, 12 pt title → field, 16 pt field → plate | `layout="compact"`: 24 pt head; Baby cropped to the top 35% of the window (face focal point); caption, title, field, plate below; Use this name pinned 8 pt above the keyboard |
| Tablet portrait | shell capped at 560 pt; same stack | shell compact; the content column max 480 pt centred over the Baby |
| Tablet landscape / short windows | compact; two columns: Baby leading half, form trailing half | same; keyboard under the trailing column |
| Quest 2D window 1280 × 800 dp | compact; Baby leading 55%, form trailing 45% (max 440 dp); field and CTA 56 dp tall | the system keyboard is a separate panel; layout unchanged |

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Chrome | `HLynkShell` | `scheme="night"`, `status={{ led: 'off' }}`, `layout` = `'compact'` while the keyboard is visible else measured, `trackpad`, `keys`, `reducedMotion`, `testIDPrefix="m09"` | `m09-shell` |
| Screen | `HLynkScreen` | `aspect` `3:4` / `fill` | `m09-screen` |
| Scroll | `KeyboardAwareScroll` | | `m09-scroll` |
| Baby | `MonStillReaction` › `Image` | `playKey` bumped on a ≥ 800 ms typing pause and once on confirm; `reaction="tilt"`; `pivot` per still | `m09-baby` |
| Scrim | `night` view at 88% | | `m09-scrim` |
| Identity | `Text` `type-caption` | `m09.identity`, a11y `m09.identity.a11y` | `m09-identity` |
| Title | `Heading level={1}` | `m09.title` | `m09-title` |
| Field | `TextField` | `label`, `hint`, `error`, `maxLength={16}`, `autoCorrect={false}`, `autoCapitalize="words"`, `textContentType="none"`, `clearButton={{ accessibilityLabel: m09.field.clear.a11y.label }}` | `m09-field-name` |
| Error | `ErrorMessage` | | `m09-error` |
| Plate | `SignagePlate` | `text`, `accessibilityLabel=m09.plate.a11y.label`, `maxSize="station"` | `m09-plate` |
| Use this name | `Button variant="cta" size="lg" fullWidth` | disabled while empty or invalid; `loading` during save | `m09-confirm` |
| Save error | `ErrorMessage` + outline `Button` | `m09.save_error.*` | `m09-save-error`, `m09-retry` |

### Trackpad and keys

| Input | Behaviour |
|---|---|
| `trackpad.label` / `hint` | `m09.trackpad.label` / `m09.trackpad.hint` |
| `onActivate` | focus the field (opens the keyboard) |
| `onCommit` + `commitLabel` (hold 600 ms) | submit, same as Use this name; when invalid, shows the error and does not commit |
| `onStep` | not set (no peers) |
| `keys.back` | disabled (the hatch can't be undone; back would only re-enter M12's `already-hatched`) |
| `keys.home` | disabled until named (D19 proposed) |
| `keys.forward` | disabled |
| `keys.menu` | companion menu |

Haptics: `haptics.success` on a saved name. No haptic per keystroke or on errors.

## Tokens

| Use | Value (night) |
|---|---|
| Page / screen | `night` |
| Scrim | `night` at 88% (floor 80%) |
| Title / caption, hint | #F8F8F8 / `silver` |
| Field | #0A1230 face, `silver` edge |
| Plate | `signage-black` band, `signage-white` text, 1 pt `silver` keyline |
| Error | `danger` night (`apple-400`) |
| CTA | `cta` / `on-cta` (night values) |
| Focus | `royal-300` |
| Type | `type-caption`, `type-title`, `type-label`, `type-body`, plate `type-station` → `type-title` |
| Space | gutter 16 pt (24 dp Quest); 8 / 12 / 16 pt stack steps |

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| empty | no plate (space reserved); CTA disabled | `m09.identity`, `m09.title`, `m09.field.label`, `m09.field.hint`, `m09.cta`, `m09.cta.a11y.hint.disabled` |
| typing | plate per keystroke; clear button; tilt on ≥ 800 ms pause | `m09.plate.a11y.label`, `m09.field.clear.a11y.label` |
| invalid | one error after ≥ 1 s pause or on submit; plate keeps text; no Baby reaction | `m09.error.blank`, `.too_long`, `.characters`, `.reserved` (only if enabled), `.blocked` |
| saving | CTA `loading` (one frame in practice) | — |
| confirmed | `nameActiveMon` writes; announce; one tilt; → M13 with `motion-step` + `motion-scheme` | `m09.confirmed.a11y.announce` |
| save error | write threw; text kept; retry | `m09.save_error.*` |
| already-named | `nickname !== null` on mount → `router.replace('/(home)')` | — |
| no Mon / not Baby | `selectActiveMon` undefined or `selectStage !== 'Baby'` → `router.replace` to `resolveBootPath(now).path` | — |
| offline | name saved locally; the `PATCH` waits in the queue (B3) | — |
| consent pending | name stays on the phone until approval (ADR 0001) | — |

## Motion and reduced motion

| Element | Trigger | Full | Duration / easing | Reduced |
|---|---|---|---|---|
| Arrival | from M12 | Baby holds its last pose (no cut); scrim + form rise 8 pt | `motion-enter` 300 ms | 200 ms fade |
| Head tilt | typing pause ≥ 800 ms | 6° about the pivot + 4 pt lift, hold, return | 320 / 400 / 320 ms, `standard` | none |
| Plate | first character | fade + 8 pt rise | `motion-enter` | instant |
| Shell compact | keyboard show / hide | follows the keyboard curve | platform keyboard timing | instant |
| Confirm | saved | tilt toward the plate, then step to M13; scheme to clock | 300 ms + `motion-step` 200 ms + `motion-scheme` 500 ms | cut; 200 ms scheme fade |

The pause detector is a debounced shared value on the UI thread; it never runs `setState` per keystroke. A new keystroke during a tilt lets it finish its return; it doesn't stack (`MonStillReaction` contract).

## Data and Mon-store contract

| Need | Source (exact export) |
|---|---|
| The Mon being named | `useMonStore(selectActiveMon)` (`packages/app/features/mon/mon.store.ts`): `monInstanceId`, `speciesId`, `nickname` |
| Stage guard | `useMonStore(selectStage)` must be `'Baby'` |
| Bloodline (art, sound slot, label) | `useMonStore(selectStarterBloodlineId)` → `bloodlines` (`@acme/content`) for `bloodlineName` |
| Form name, Dex number | `allSpecies` from `@acme/content`, matched on `speciesId` (`formName`, `dexId`) |
| Baby still and alt | `CREATURE_ART` (`@acme/assets/creatures`), `kind === 'baby'`, matched on `dexId` |
| Validation | **missing** `validateMonName` (B4); block list: the platform list used by M07 (`defaultCallerNameFilter` pattern) |
| Write | **missing** `nameActiveMon` (B1) |
| Reduced motion | `useReducedMotion` from `@acme/ui` |

Proposed addition to `MonStoreState`:

```ts
/**
 * Sets the active Mon's nickname (Decision #5: the individual is named after
 * the hatch). Re-reads the save first, like applyCare. Writes only when the
 * Mon's nickname is null, so a double submit or a replay is a no-op that
 * returns the stored name. Queues PATCH /v1/mons/:id (B3). Throws when there
 * is no active Mon. `name` must already have passed validateMonName.
 */
nameActiveMon: (name: string, atMs: number) => MonInstance;
```

It changes `nickname` only: `monInstanceId`, `speciesId`, `hatchedAt`, `bond` and stage stay as minted (Law 6).

## Tests to write

| Kind | Test |
|---|---|
| Unit (core) | `validateMonName`: each reason and order; 16 vs 17; accented and non-Latin pass; `reserved` only when the list is non-empty |
| Unit (core) | boot: hatched Mon with null nickname → `resume-onboarding` / `mon-name`; named → `companion` |
| Unit (store) | `nameActiveMon` sets the name once; second call returns the stored name and writes nothing; `monInstanceId` unchanged |
| Unit (core) | schemas reject a 17-character nickname (B5) |
| Unit (app) | already-named → M13; no Mon → boot path; not Baby → boot path |
| Unit | no M09 string contains "Callah", "device", "offensive" or a suggested name; a reviewed allow-list check that no "it", "he" or "she" refers to the Mon ("Hold to use it" refers to the name) |
| Unit (kit) | `MonStillReaction`: plays once per `playKey`, none when `reducedMotion` |
| Visual | empty, typing short and 16-character names, each error, keyboard up/down; SE, Pro Max, iPad, 1280 × 800; XXL |
| a11y (web) | Enter submits; plate not live; focus stays on the field across the compact switch |

## Device verification

Open; no device yet.

- [ ] SE: keyboard up switches the shell to compact without dropping focus; Use this name visible above the keyboard.
- [ ] Kill the app on M09: relaunch returns to M09 with the same Mon (B2).
- [ ] VoiceOver / TalkBack: title first, plate silent, errors once after the pause.
