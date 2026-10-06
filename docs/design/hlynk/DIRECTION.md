# H-Lynk Core chrome: direction

Owner: `design-director`. Written 2026-10-04, revised the same day for canon Decision #16 (commit 9609b0d). Status: proposal for the kit build queue. Nothing here is implemented; every part maps to an existing `@acme/ui` component or to a new kit component that needs a story before any screen uses it (repo law R3, `CONTRIBUTING.md`).

## Sources

- v11 device description, quoted in `docs/canon/STARTERS_EXTRACT.md` §11: "The H-Lynk is a slim 3:4-screen handheld with a central tactile trackpad/control, two buttons on each side, rear L/R controls, right-side volume/power, left-side action control, a top antenna and a separate red scanner/emitter. The backplate reads H-Lynk. Entry, Mid and Pro tiers differ in materials and sensor/camera sophistication; Entry is plastic and Pro is the most premium." (`V11 ¶63`)
- "H-Lynk ("Hood Link") is an optional communication/care/recovery device. It is not proof of ownership, personhood or partnership." (`V11 ¶23`)
- `docs/canon/DECISIONS.md`:
  - #4: daylit by default; dark for night and the hatch.
  - #7: the scanner LED is red; orange is the CTA and hatch accent.
  - #8: companion screens are an H-Lynk unit Santoro hands the Caller; the bond lives on the `MonInstance`.
  - #14: the Mon's choice happens at hatch.
  - **#16: the creator's three-tier sheet.** Entry is the **H-Lynk Core** in matte red plastic. It has a black scanner head across the top with red emitters projecting a red fan upward (a barcode scanner), a black stub antenna top-left and a dark screen bezel. The bottom control row is home, menu, a large square centre trackpad ringed in red, back and forward. The side keys are volume +/−, power and a left action key. A thin vertical red status light sits on the back, and the tier name is on the backplate. "The red LED and scanner always sit in the black scanner head, never on bare red plastic."
- `docs/canon/OPEN_QUESTIONS.md`:
  - Q40: the EngineX mark on the sheet. Not drawn.
  - Q41–Q42: the HP meter, tab labels and "CALL MON" are concept text, not canon.
- `docs/phase-1-brief.md` §1.1, §2.4, §4.
- Contrast method: `docs/design/CONTRAST.md` (WCAG 2.2 relative luminance, 0.04045 threshold). Every ratio here was computed with that formula. `docs/DESIGN_SYSTEM.md` carries the full table.
- The sheet image is not yet in `docs/canon/source/`, and the H-Lynk Bible is not in the repo. Exact proportions, emitter count and key glyph shapes are `TODO(canon)` until both land.

## The one move

The phone becomes an H-Lynk Core. A red plastic handheld wraps the screen. Its black scanner head across the top carries the red light that tells you, in one glance, whether the egg is incubating, ready or needs you. Under the thumb is one black square trackpad ringed in red. People should remember the red body, the black head and that pad, so everything inside the screen stays quiet.

## Where the chrome appears

| Screen | Chrome | Why |
|---|---|---|
| M01 Boot | Yes: the shell powers on, the scanner head lights, then the app routes | The cold start is the H-Lynk waking. It is the only pre-companion screen with chrome (screen map §4.1). |
| M08 Meet, M10 Incubation, M11 Incubating, M12 Hatch, M09 Naming | Yes | Companion screens per §4.2 |
| M13 Home, M14 Feed, M15 Rest, M16 Social | Yes | Companion loop per §4.3 |
| M02–M07 onboarding and auth | Never | §2.4: never on auth or settings |
| M17 Dex, M18 Journal, M19–M22 settings, system | Never | §4.3/§4.4 mark them `none` |

M01 is the deliberate exception the screen map already gives (`docs/design/DECISIONS.md` D1).

## Anatomy on a phone

Decision #16 describes a physical object. A phone is a 9:19.5 slab with its own safe areas, so each part is translated rather than traced.

```
 ┌──────────────────────────────┐  ← OS status bar (safe top inset, untouched)
 │ ▌ ███████ scanner head ██(◉)█ │  black head, 40 pt, full width inside the rails;
 │ ▌antenna                     │  red emitter lens(es) inside it; stub antenna top-left
 │┌────────────────────────────┐│
 ││                            ││  black bezel lip, then the 3:4 screen
 ││        3:4 screen          ││  width = window − 2 × rail (rail 12 pt, red body)
 ││   (Mon / egg / scene)      ││  height = width × 4 / 3
 │└────────────────────────────┘│
 │ [⌂] [≡]  ┏━━━━━━━━┓  [‹] [›] │  control row: home, menu, trackpad, back, forward
 │          ┃trackpad┃          │  trackpad 112 pt square, black face, red ring
 │          ┗━━━━━━━━┛          │  keys 48 pt square, black, light glyphs
 └──────────────────────────────┘  ← home indicator (safe bottom inset kept clear)
```

Measured fit (points, portrait):

| Device | Window | Safe top / bottom | Screen (3:4) | Height left for the control row |
|---|---|---|---|---|
| iPhone SE 3 | 375 × 667 | 20 / 0 | 351 × 468 | 667 − 20 − 40 − 468 = 139 |
| iPhone 16 Pro Max | 440 × 956 | 62 / 34 | 416 × 555 | 956 − 62 − 40 − 555 − 34 = 265 |
| Pixel 8 | 412 × 915 | 24 / 24 (gesture nav, approx.) | 388 × 517 | 915 − 24 − 40 − 517 − 24 = 310 |

Width check on SE: 351 pt between the rails holds 4 keys × 48 pt plus the 112 pt trackpad (304 pt) with four gaps of about 11 pt. Height: 112 pt pad plus 12 pt top and bottom = 136 pt, inside 139. SE is the tightest case and it fits. Anything shorter (landscape, split view, iPad slide-over) drops to the compact layout: the screen goes full-bleed, the head shrinks to a 24 pt strip, and the control row becomes a 72 pt bar with the trackpad as a wide pill. Phase 1 is portrait-only on phones.

The whole control row sits in the bottom 40% of the window on every device in the table, which meets the thumb-reach rule in §4.

Translation choices:

- **Scanner head**: a black band across the top edge, below the OS status bar. The emitter lens sits inside it. The red fan of light projects upward only during a scan moment. Phase 1 has no scanning, so the fan appears only at M01 boot (one sweep) and stays reserved for Phase 2 `/(hood)/scan`. The fan is decorative and is drawn inside the head's top edge, never over the status bar.
- **Stub antenna**: a short black nub at the top-left of the head. Decorative and hidden from assistive tech.
- **Dark bezel**: a black lip around the screen.
- **Bottom control row**: drawn as specified: home, menu, trackpad, back, forward.
- **Side keys (volume +/−, power, left action)**: not drawn. The phone's own buttons sit on those edges, and a 12 pt rail cannot carry a 44 pt target (Apple HIG, https://developer.apple.com/design/human-interface-guidelines/accessibility#Buttons-and-controls). Kept for the web `DeviceStage` model (`docs/design/DECISIONS.md` D2).
- **Rear red status light, rear camera, backplate tier name**: not visible in a front view and not drawn on mobile. They belong to `DeviceStage` and any turnaround capture. The tier name never appears on the front (#16 puts it on the backplate).
- **EngineX mark**: not drawn anywhere (Q40 open). No H-Lynk mark exists in the repo either (`docs/REPO_MAP.md` §7), and agents never draw one (§0A.2 logo rule).
- **On-screen UI shown on the sheet** (Mon name, "Lv. 12", gender mark, "SCAN READY" chip, HP/Energy/Fullness/Social meters, "CALL MON", DEX/CREW/CARE/BAG/CITY tabs): layout reference only, for M13. Its hierarchy is useful: identity top-left, a status chip top-right, meters under the Mon, a primary action above a tab row. No label from it ships without clearing Law 1 and Law 9 (Q41, Q42).

## Controls

### Trackpad: the primary affordance

The trackpad is always present on a companion screen, and it does the screen's main job.

| Gesture | Meaning | Screen examples |
|---|---|---|
| Tap | Primary action of this screen | M08 approach the focused egg; M10 confirm time; M13 open the next care need |
| Flick left/right | Move focus between peers | M08 between the three eggs; M10 between 15/30/60 |
| Hold (600 ms) | Commit a choice that matters | M08 choose this egg |
| Drag (M13 only) | Pan the room | §4.3 M13 |

Rules:

- **Every trackpad action has an on-screen equivalent.** Each one also exists as a plain control labelled in words, for VoiceOver, TalkBack, Switch Control and anyone who doesn't discover gestures.
- **Accessibility role.** The trackpad is `adjustable`; the VoiceOver increment and decrement actions map to flick. It has `accessibilityActions` for activate and commit, and its label reads the current target ("Metro Egg, 1 of 3"). Hold has a timeout-free alternative: activate, then confirm (WCAG 2.2 2.5.1 Pointer Gestures, https://www.w3.org/TR/WCAG22/#pointer-gestures).
- **The red ring.** The ring sits on the pad's black face, inset 4 pt so black separates it from the red body: `apple-500` on black is 4.99:1. A ring touching the body would measure 1.30:1 against it, and that pair is forbidden.
- **Haptics.** Tap = light, flick step = selection tick, hold commit = success. They go through the existing `haptics` export (`packages/ui/haptics.native.ts`).

### Keys: home, menu, back, forward

| Key | Default action | Notes |
|---|---|---|
| Home | Go to M13 (or M11 while the egg incubates) | Disabled on the home screen itself |
| Menu | Opens the companion menu | Contents `TODO(canon)` Q42; until settled it opens Dex, Journal, Settings by their existing screen names |
| Back | Router back | Mirrors Android system back and the iOS edge swipe; never destructive |
| Forward | Same as a trackpad flick right | Lets one-handed players step focus without a gesture; disabled where there is nothing to step |

Each key has a visible text label only in its accessible name. The glyph alone is shown on the key, which is fine because these four are standard handheld glyphs and each has an accessible name. A long-press shows the name as a tooltip. Keys are black; their glyphs are `silver-300` (15.89:1 on black). No key is ever destructive (§4 thumb rule).

## The scanner LED is a status light

Red only (#7). It sits inside the black scanner head (#16), so the contrast holds in every scheme: `apple-500` on the black head is **4.99:1**. Three meaningful states plus boot and off. The states differ in *rhythm*, not colour, because colour alone fails WCAG 1.4.1.

| State | When | Rhythm (full motion) | Reduced motion (authored) | Text equivalent (VoiceOver and visible chip) |
|---|---|---|---|---|
| `off` | No egg, no Mon (M08 before choice) | lens dark (`apple-900`) | — | none |
| `boot` | M01 power-on | ramp 0 → 100% over 240 ms, one fan sweep upward | steps to 100%, no fan | "H-Lynk on" (announced once, polite) |
| `incubating` | Egg in the case, timer running | slow breath, 4 s period, 35 → 100% | steady 100% plus a progress tick row in the head | "Incubating, 12 minutes left" |
| `ready` | Egg ready or overdue | two short blinks, then steady, every 6 s | steady plus a filled dot beside the lens | "Ready to hatch" |
| `needsYou` | Any meter under the M13 threshold | three quick blinks every 10 s | steady plus an exclamation dot | "Needs you: Fullness" |

- **Not a loader.** The LED never pulses while data loads; loading uses the kit's progress family inside the screen.
- **Flash safety.** Blinks stay under 3 per second (WCAG 2.3.1).
- **Information is never LED-only.** The text chip sits in the screen's own status row, not on the body.
- **Copy rule (#8, Law 9).** The LED reports the egg's or the Mon's state. It never says the H-Lynk "holds", "controls" or "owns" the Mon. Visible text says "H-Lynk", never "device".
- **Fan.** The red fan is decorative and appears only at boot in Phase 1 (scan moments come in Phase 2). It has no reduced-motion form: it is simply absent.

## Colours, daylit and night

The body does not change with the scheme. Plastic is plastic, so the Core is red by day and by night. Decision #4's daylit/night switch changes the page behind the device and the scene inside the screen, not the shell.

| Part | Token | Hex | Measured against | Ratio | Role |
|---|---|---|---|---:|---|
| Body (matte red plastic) | `hlynk.body` = `apple-600` | #D50000 | — | — | — |
| Body edge vs daylit page | — | — | `concrete-50` #F3F4F4 | 4.98 | decorative (passes anyway) |
| Body edge vs night page | — | — | `night` #00041C | 3.70 | decorative (passes anyway) |
| Scanner head, antenna, bezel, keys, trackpad face | `hlynk.black` = `signage-black` | #000000 | body #D50000 | 3.83 | ui 3: pass. Key and pad edges identify the controls |
| LED / emitter (on) | `led-on` = `apple-500` | #F80000 | black head | 4.99 | ui 3: pass |
| LED (off) | `led-off` = `apple-900` | #5E0000 | black head | — | decorative |
| Trackpad ring | `hlynk.ring` = `apple-500` | #F80000 | pad face #000000 | 4.99 | ui 3: pass |
| Key glyph | `hlynk.glyph` = `silver-300` | #DFE0E1 | key #000000 | 15.89 | ui 3: pass |
| Key glyph, pressed | `signage-white` | #FFFFFF | key #000000 | 21.00 | ui 3: pass |
| Any text printed on the red body | `signage-white` | #FFFFFF | body #D50000 | 5.48 | text 4.5: pass. White is the only ink allowed on the body |
| Hatch accent (orange rim on the trackpad, hatch only) | `orange-500` | #FC7C00 | pad face #000000 | 8.02 | ui 3: pass |

Why `apple-600` and not a deeper red: black keys on `apple-700` #AE0000 measure 2.23:1 (`concrete-900` keys) and 2.80:1 (pure black keys), and both fail the 3:1 a control boundary needs. On `apple-600`, pure black keys hold 3.83:1. The LED and emitters (`apple-500`) are never placed on the body: 1.30:1 against it.

Forbidden on the Core (added to `docs/DESIGN_SYSTEM.md`):

- black text on the body (3.83:1, under 4.5 for text);
- `apple-500` on the body (1.30:1);
- `apple-400` on the body (1.53:1);
- `concrete-900` keys on the body (3.05:1, too thin a margin; keys are pure black);
- white on `apple-500` (4.21:1).

Night switches by time of day (device clock, §3.2) and for the hatch. Only the screen content and the page behind it change, through a 500 ms token cross-fade; reduced motion swaps instantly.

## Boot (M01) in one line

Dark screen in a red shell → the scanner head lights (`boot` ramp, one fan sweep) → the screen lights to the routed destination, all inside 600 ms. On a first run the shell then lowers away to the plain M02 page. Details in `docs/design/screens/M01/03-direction.md`.

## Reduced motion

`AccessibilityInfo.isReduceMotionEnabled` gates at the sim-core adapter (§3.6). The chrome reads one `reducedMotion` prop from that adapter; components never query the OS themselves.

| Animation | Full | Reduced (authored) |
|---|---|---|
| LED rhythms | per table above | steady light plus a static shape cue |
| Scanner fan | one upward sweep at boot | absent |
| Shell power-on | screen fades up 0 → 1 in 240 ms, body scale 0.98 → 1 | screen cuts on; no scale |
| Daylit ↔ night | 500 ms token cross-fade | instant swap |
| Trackpad press | 0.97 scale (`PressScale`) + haptic | no scale; ring brightens to `signage-white` for 120 ms + haptic |
| Key press | 1 pt depress | glyph turns `signage-white` |

## Kit mapping (R3)

Existing components first. Anything marked NEW needs a story in `packages/ui` before a screen uses it.

| Part | Kit component | Status |
|---|---|---|
| Safe-area handling | `SafeArea` | exists, no story yet |
| Night scoping inside the screen | `NightScope` | exists, no story |
| Press feedback | `PressScale` | exists, no story |
| Haptics | `haptics` | exists |
| Entry/exit motion | `FadeIn`, `ScaleIn` | exist; need a `reducedMotion` prop (variant) |
| Status chip text | `Badge` `size="sm"` | exists |
| Shell | `HLynkShell` | NEW |
| Screen window | `HLynkScreen` | NEW |
| Scanner head + LED + fan | `ScannerLed` (inside `ScannerHead`, internal to the shell) | NEW |
| Trackpad | `Trackpad` | NEW |
| Home / menu / back / forward keys | `HLynkKey` | NEW |
| Antenna | internal to `HLynkShell` | NEW (internal) |
| Shell tokens | `hlynk.*` group in `@acme/theme` | NEW tokens, see `docs/DESIGN_SYSTEM.md` |

### Tier

Every chrome component takes `tier: 'core' | 'standard' | 'pro'`, the three tiers of #16 (H-Lynk Core, H-Lynk, H-Lynk Pro). Phase 1 implements `core` only. `standard` (charcoal/gunmetal) and `pro` (white/silver armour panels with red edge lights) are typed now, render the `core` look with a dev warning, and get their own token sets and stories when they ship. Their contrast must be re-measured then. Example of why: black keys on charcoal will not reach 3:1 and will need a different key face.

### NEW `HLynkShell`

The persistent frame for companion screens.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tier` | `'core' \| 'standard' \| 'pro'` | `'core'` | only `core` implemented |
| `scheme` | `'daylit' \| 'night'` | from time-of-day adapter | #4; affects screen and page, not the body |
| `led` | `ScannerLedState` | `'off'` | |
| `ledLabel` | `string` | required when `led !== 'off'` | text equivalent |
| `reducedMotion` | `boolean` | from sim-core adapter | |
| `layout` | `'standard' \| 'compact'` | measured | compact when the control row would be under 120 pt |
| `screen` | `ReactNode` | required | contents of `HLynkScreen` |
| `trackpad` | `TrackpadProps` | required | |
| `keys` | `{ home?, menu?, back?, forward?: HLynkKeyProps }` | all four present | a missing handler renders the key disabled, never hidden (the row keeps its shape) |
| `power` | `'off' \| 'booting' \| 'on'` | `'on'` | M01 drives it |

Stories: `Core`, `CoreNight` (night page and screen, same red body), `Compact`, `PowerOn` (full and reduced motion), `AllLedStates`, `SE3Viewport`, `ProMaxViewport`, `TierPlaceholders` (standard and pro rendering the core look with the warning).

### NEW `HLynkScreen`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactNode` | | three.js canvas, Skia HUD and kit controls, layered per §3.1 |
| `statusRow` | `ReactNode` | | holds the LED text chip and meters |
| `aspect` | `'3:4' \| 'fill'` | `'3:4'` | `fill` in the compact layout |

Stories: `WithEggPlaceholder`, `WithStatusRow`, `Fill`.

### NEW `ScannerLed`

Renders the black scanner head band, the emitter lens and the fan.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tier` | `'core' \| 'standard' \| 'pro'` | `'core'` | head is black on every tier (#16) |
| `state` | `'off' \| 'boot' \| 'incubating' \| 'ready' \| 'needsYou'` | `'off'` | exhaustive switch |
| `progress` | `number` 0–1 | | the reduced-motion `incubating` tick row |
| `fan` | `boolean` | `false` | one upward sweep; ignored under reduced motion |
| `reducedMotion` | `boolean` | | |

Accessibility: `accessibilityRole="image"` with the state label; a polite live region announces state changes only. Stories: `States`, `ReducedMotionStates`, `BootFan`, `InCompactStrip`.

### NEW `Trackpad`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tier` | `'core' \| 'standard' \| 'pro'` | `'core'` | |
| `label` | `string` | required | current target, e.g. "Metro Egg, 1 of 3" |
| `onActivate` | `() => void` | | tap |
| `onStep` | `(dir: -1 \| 1) => void` | | flick; also VoiceOver increment/decrement |
| `onCommit` | `() => void` | | hold 600 ms, or activate + confirm |
| `onPan` | `(dx: number, dy: number) => void` | | M13 only |
| `accent` | `'ring' \| 'hatch'` | `'ring'` | red ring always; orange rim only during the hatch (#7) |
| `disabled` | `boolean` | `false` | ring drops to `apple-900`; the face stays black |
| `reducedMotion` | `boolean` | | |

Stories: `Idle`, `Pressed`, `Stepping`, `HoldCommit`, `HatchAccent`, `Disabled`, `VoiceOverActions`.

### NEW `HLynkKey`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tier` | `'core' \| 'standard' \| 'pro'` | `'core'` | |
| `role` | `'home' \| 'menu' \| 'back' \| 'forward'` | required | picks the glyph and default accessible name |
| `label` | `string` | from role | accessible name; also the long-press tooltip |
| `onPress` | `() => void` | | absent → disabled |
| `disabled` | `boolean` | | glyph drops to `concrete-700`; exempt as a disabled control |

Stories: `AllRoles`, `Pressed`, `Disabled`, `OnNightPage`.

## Open values (TODO(canon))

- The sheet image must be added to `docs/canon/source/` (#16). Until then, proportions and glyph shapes are read from the decision text only.
- The number of emitters in the head, and the fan's angle and length.
- The exact red of the Core body. The design uses `apple-600` #D50000 because it is the darkest kit red where black controls hold 3:1. If the sheet's red is darker, the keys need a lighter face or a keyline, and the measurements change.
- Menu contents and any tab labels (Q42); HP as a meter (Q41).
- EngineX on the device (Q40): not drawn until answered.
- Capture case (Q4): its look belongs to M10/M11, not this chrome.
