# M01 Boot / power-on: handoff

The implementation contract for `platform` (routing, shell wiring) and the kit build (`packages/ui`). Inputs: `01-research.md` to `07-a11y.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (P1, D1, D3, D8, D11), canon Decisions #4, #7, #8, #16, `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`. Laws: `prompts/LAWS.md` (R1–R5, Laws 2, 3, 9, 10).

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `ScannerLed`, `HLynkKey`, `Trackpad`, `HLynkScreen`, `HLynkShell` exist in `packages/ui` with stories (R3). Build order in § Kit components | kit | everything on this screen |
| B2 | `resolveBootRoute` contract (§ Data) is agreed and lives in `@acme/core` as a pure, synchronous function over the MMKV snapshot (Law 3) | `sim-core` + `platform` | routing |
| B3 | `FadeIn` / `ScaleIn` take a `reducedMotion` prop | kit | first-run hand-off |

Not blocking implementation, blocking visual sign-off: the creator's H-Lynk sheet image in `docs/canon/source/` (#16). Proportions, emitter count and fan angle are `TODO(canon)` until it lands; build from `DIRECTION.md` values and keep them in tokens so the swap is one diff.

## Route and intent

Route `/` (expo-router `apps/mobile/app/index.tsx`). Shell: H-Lynk Core (D1, the only pre-companion screen with chrome).

| Priority | Intent |
|---|---|
| P1 | Decide where this session goes from local state, inside 240 ms, never awaiting the network |
| P2 | Show the H-Lynk Core waking: emitter on, one fan sweep, screen lights into the destination, 600 ms total |
| P3 | Announce "H-Lynk on" once and hand focus to the destination title |
| P4 | First run only: lower the shell away so M02 stands without chrome |

## Layout

Phone portrait (compact width), measured in `DIRECTION.md` § Anatomy:

| Part | Spec |
|---|---|
| Safe areas | `SafeArea` top and bottom; the OS status bar and home indicator are never drawn over |
| Scanner head | 40 pt black band inside the rails; emitter lens right; stub antenna top-left |
| Rails | 12 pt red body each side |
| Screen | width = window − 24 pt; height = width × 4 / 3; black bezel lip |
| Control row | Home, Menu, Trackpad (112 pt), Back, Forward (48 pt keys), centred, 12 pt above and below the pad |
| SE 3 check | 351 × 468 pt screen, 139 pt for the row (136 pt used) |

Per width class (Material 3; `07-a11y.md` § Responsive):

| Class / posture | Layout |
|---|---|
| Compact portrait | as above |
| Short height (< 120 pt left for the row) | `HLynkShell layout="compact"`: full-bleed screen, 24 pt head strip, 72 pt bar, trackpad as a wide pill |
| Medium, expanded, extra-large | shell at phone proportions, centred, max 440 pt wide, on `bg` |
| Book posture | shell entirely in the leading pane |
| Tabletop posture | head + screen above the hinge, control row below (proposal; `design-director` confirms at M08) |

Hinge and reserved regions come from `@acme/ui/adaptive-panes` once its port lands; until then the app's `AdaptiveSplitView` (`apps/mobile/src/navigation/split-view`) is the only fold-aware code. No control group may straddle a hinge.

## Components

All from `@acme/ui` (R3). No raw `View`/`div` styling in the route file.

| Element | Component | Props | testID |
|---|---|---|---|
| Frame | `HLynkShell` | `tier="core"`, `power` `'off' → 'booting' → 'on'`, `scheme` from the time-of-day adapter, `led`, `ledLabel`, `reducedMotion` from the sim-core adapter, `layout` measured, `screen`, `trackpad`, `keys` | `m01-shell` |
| Head, emitter, fan | `ScannerLed` (inside the shell) | `tier="core"`, `state="boot"` then the destination state, `fan` true during boot, `reducedMotion` | `m01-led` |
| Screen | `HLynkScreen` | `aspect="3:4"` (`"fill"` in compact) ; child = destination's first frame | `m01-screen` |
| Trackpad | `Trackpad` | `tier="core"`, `label` from `hlynk.trackpad.label`, `disabled` during boot | `m01-trackpad` |
| Keys | `HLynkKey` ×4 | `role` home / menu / back / forward, labels from `hlynk.key.*.label`, no `onPress` during boot (renders disabled, never hidden) | `m01-key-home`, `m01-key-menu`, `m01-key-back`, `m01-key-forward` |
| Safe areas | `SafeArea` | top, bottom | — |
| First-run hand-off | `FadeIn` (reversed) / cross-fade | `reducedMotion` | `m01-handoff` |

### Public prop contracts (R5, Margelo `api-design`)

The full tables are in `DIRECTION.md` § Kit mapping. Changes this handoff makes to them, so the types encode the rules instead of comments:

- `HLynkShell.led` and `ledLabel` become one discriminated prop: `status: { led: 'off' } | { led: 'boot' } | { led: 'incubating' | 'ready' | 'needsYou'; label: string }`. A lit, meaningful LED without a text label is then unrepresentable (D3, WCAG 1.4.1).
- `ScannerLed.progress` exists only on the `incubating` variant: `{ state: 'incubating'; progress: number }`.
- `Trackpad`: `onStep(direction: -1 | 1)`, `onActivate()`, `onCommit()`, `onPan(dxPt, dyPt)` (units in the names). `disabled?: boolean` stays a plain optional boolean, default `false`.
- `tier: 'core' | 'standard' | 'pro'` on every chrome component; `standard` and `pro` render `core` with a dev warning (`DIRECTION.md` § Tier).
- Every exported prop type gets JSDoc that links the component that consumes it.

## Tokens

| Use | Token | Value |
|---|---|---|
| Body | `hlynk.core.body` | `apple-600` #D50000 |
| Head, antenna, bezel, key and pad faces | `hlynk.core.black` | #000000 |
| Trackpad ring | `hlynk.core.ring` | `apple-500` #F80000 |
| Ring, booting / disabled | `led.off` | `apple-900` #5E0000 |
| Key glyph / pressed / disabled | `hlynk.core.glyph` / `glyphPressed` / `glyphDisabled` | `silver-300` / white / `concrete-700` |
| Emitter on / off | `led.on` / `led.off` | `apple-500` / `apple-900` |
| Page behind the shell | `bg` | `concrete-50` daylit, `night` at night (scheme from the clock, D8) |
| Space | 4 pt grid; rail 12; head 40; key 48; pad 112 | `DIRECTION.md` |
| Motion | `motion-power-on`, `motion-scan-fan`, `motion-enter` | `DESIGN_SYSTEM.md` § Motion |

No orange on M01 (#7: no CTA here). Measured pairs: `07-a11y.md` § Contrast.

## States

| State | Trigger (from `resolveBootRoute`) | Destination | LED after boot | Copy IDs |
|---|---|---|---|---|
| first-run | no save, or save with `caller: null` and no session | M02 panel 1; shell lowers away | — | `m01.a11y.power_on` |
| first-run, offline | as above, no network | M02 with `m02.status.offline` in its `StatusRow` | — | `m01.a11y.power_on`, `m02.status.offline` |
| returning, incubating | an `EggRecord` whose timer is running | M11 | `incubating` | `m01.a11y.power_on`, `hlynk.led.incubating`, `hlynk.led.a11y` |
| returning, ready / overdue | an `EggRecord` past `incubationEndsAt`, not hatched | M11 "ready" | `ready` | `hlynk.led.ready` |
| returning, Baby | a `MonInstance` in the save | M13 | `needsYou` or `off` per `listUnmetNeeds` | `hlynk.led.needs_you` |
| returning, offline | any returning state | same as online; the sim runs locally (§1.4) | as above | as above |
| consent denied | `caller.consentStatus === 'denied'` | M05 denied screen | — | M05 `m05.denied.*` |
| save unreadable | `loadSave` fails | M22 save-recovered | — | owned by M22 |

Every state speaks `m01.a11y.power_on` once at 240 ms. Disabled controls read `hlynk.state.disabled.hint` if focused.

## Motion and reduced motion

| Time | Full | Reduced (authored) |
|---|---|---|
| 0 ms | shell drawn, `power: 'off'`, screen black | same |
| 0–240 ms | emitter ramps 0 → 100%, one fan sweep (400 ms, may overrun into the fade), ring `apple-900` → `apple-500`, body scale 0.98 → 1 | emitter and ring step on at 0 / 240 ms, no fan, no scale |
| 240 ms | `power: 'on'`, announcement | same |
| 240–600 ms | screen fades up | screen cuts on at 240 ms |
| first run, after 600 ms | shell lowers, 300 ms `motion-enter` reversed | 200 ms cross-fade |

`reducedMotion` comes from the sim-core adapter only (§3.6). Haptics: none on boot.

## Empty, error, offline

- **Empty:** first run is the empty state; there is no empty frame to design.
- **Error:** a save that fails `loadSave` (`SaveLoadError`) routes to M22. M01 shows no error copy (`05-copy.md`).
- **Offline:** never awaited. The route resolves from MMKV. A first-run player with no network still reaches M02.
- **Slow device:** if the route is not resolved at 240 ms, the screen stays black under the lit head until it is, and the 600 ms budget is a defect to log, not a reason to add a spinner (the LED is not a loader).

## Data

| Need | Source |
|---|---|
| Save snapshot | `@acme/core` `loadSave` over the single MMKV value, parsed by `SaveCurrentSchema` (Law 5) |
| Route decision | NEW `resolveBootRoute(save: SaveCurrent \| undefined, nowMs: EpochMs): BootRoute` in `@acme/core/sim`, pure and synchronous |
| Unmet needs (Baby) | `listUnmetNeeds` from `@acme/core` |
| Session presence | `@acme/auth` local session read; never a network call on this path |
| Reduced motion, scheme | sim-core adapter and time-of-day adapter (app layer) |

```ts
/** Where M01 sends this session. Produced by {@linkcode resolveBootRoute}. */
export type BootRoute =
  | { kind: 'first-run' }
  | { kind: 'incubating'; eggId: string }
  | { kind: 'egg-ready'; eggId: string }
  | { kind: 'companion'; monInstanceId: string }
  | { kind: 'consent-denied' }
  | { kind: 'save-recovered' };
```

The app maps `BootRoute` to a path with an exhaustive `switch` and `assertNever`. Open for `platform`: whether a returning save with an expired session also routes to M03 sign-in (`M03/03-direction.md` mentions it) or keeps local play and asks later. Default until ruled: keep local play; nothing on M01 waits for auth.

No analytics, account identifier or network request fires on M01 (COPPA risk, `03-direction.md` no-list).

## Accessibility contract

From `07-a11y.md`: polite `m01.a11y.power_on` at 240 ms; boot shell hidden from AT on first run; focus set explicitly on the destination `h1` after the swap; disabled controls keep their names; Large Content Viewer on keys; web keys `aria-disabled`, shell `aria-hidden` on first run.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`@acme/core`, Vitest) | `resolveBootRoute` returns each `BootRoute` kind from fixture saves; is pure (same input, same output, 10k runs); never reads a clock other than `nowMs` |
| Unit | exhaustive route map in the app: a new `BootRoute` kind fails typecheck |
| Unit (`packages/theme`) | `contrast.test.ts` contains every M01 pair in `07-a11y.md`, including the forbidden ones |
| Story | `HLynkShell`: `Core`, `CoreNight`, `Compact`, `PowerOn` (full and reduced), `FirstRunHandOff`, `AllLedStates`, `SE3Viewport`, `ProMaxViewport`, `TierPlaceholders` |
| Story | `ScannerLed`: `States`, `ReducedMotionStates`, `BootFan`, `InCompactStrip`; `Trackpad`: `Idle`, `Disabled`, `VoiceOverActions`; `HLynkKey`: `AllRoles`, `Disabled`, `OnNightPage` |
| Visual | Storybook capture of `PowerOn` frames at 0, 240, 600 ms, full and reduced, daylit and night pages; baseline in `apps/mobile/__captures__` |
| a11y (web) | axe pass on the `PowerOn` story; keys expose `aria-disabled` |
| Timing | instrumented cold start: route resolved ≤ 240 ms, screen lit ≤ 600 ms |

## Device verification

Open; no device is set up. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] M01 routes in ≤ 240 ms from the MMKV snapshot on iPhone SE 3 cold start (DEVICE_CHECKS "M01 boot").
- [ ] H-Lynk Core shell on SE 3, 16 Pro Max, Pixel 8: row fits (SE 139 pt), safe areas, red body contrast under real gamma.
- [ ] VoiceOver and TalkBack: "H-Lynk on" once, focus lands on the destination title, never on a vanishing key.
- [ ] Reduced motion on: no fan, no scale, screen cuts on.
- [ ] Foldable book and tabletop postures: no control group across the hinge (DEVICE_CHECKS "Adaptive panes + fold module").
