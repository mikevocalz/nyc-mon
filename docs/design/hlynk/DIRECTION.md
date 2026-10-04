# H-Lynk Entry chrome: direction

Owner: `design-director`. Written 2026-10-04. Status: proposal for the kit build queue. Nothing here is implemented; every part maps to an existing `@acme/ui` component or to a new kit component that needs a story before any screen uses it (repo law R3, `prompts/LAWS.md`).

## Sources

- v11 device description, quoted in `docs/canon/STARTERS_EXTRACT.md` §11: "The H-Lynk is a slim 3:4-screen handheld with a central tactile trackpad/control, two buttons on each side, rear L/R controls, right-side volume/power, left-side action control, a top antenna and a separate red scanner/emitter. The backplate reads H-Lynk. Entry, Mid and Pro tiers differ in materials and sensor/camera sophistication; Entry is plastic and Pro is the most premium." (`V11 ¶63`)
- "H-Lynk ("Hood Link") is an optional communication/care/recovery device. It is not proof of ownership, personhood or partnership." (`V11 ¶23`)
- `docs/canon/DECISIONS.md` #4 (daylit default; dark for night and the hatch), #7 (the scanner LED is red; orange is the CTA and hatch accent), #8 (companion screens are framed as an H-Lynk Entry unit Santoro hands the Caller; the bond lives on the `MonInstance`, never on the H-Lynk), #14 (the Mon's choice happens at hatch).
- `prompts/BUILD_PROMPT_v3.md` §1.1, §2.4, §4.
- Contrast method: `docs/design/CONTRAST.md` (WCAG 2.2 relative luminance, 0.04045 threshold). Every ratio below was computed with that formula; `docs/DESIGN_SYSTEM.md` carries the full table.
- The H-Lynk Bible (`NYC_MON_HLynk_Capture_and_Handoff_Bible_v11.md`) is not in the repo. Every value it would settle is marked `TODO(canon)`.

## The one move

The phone becomes an H-Lynk Entry. The Mon lives in a 3:4 window; below it sits a matte plastic deck with one big square trackpad under the thumb and two keys on each side of it. A small red lens at the top tells you, in one glance, whether the egg is incubating, ready, or needs you. Everything else on a companion screen stays quiet so that lens and that pad are what people remember.

## Where the chrome appears

| Screen | Chrome | Why |
|---|---|---|
| M01 Boot | Yes: shell powers on, LED boot cue, then routes | The cold start is the H-Lynk waking. It is the only pre-companion screen with chrome (screen map §4.1). |
| M08 Meet, M10 Incubation, M11 Incubating, M12 Hatch, M09 Naming | Yes | Companion screens per §4.2 |
| M13 Home, M14 Feed, M15 Rest, M16 Social | Yes | Companion loop per §4.3 |
| M02–M07 onboarding and auth | Never | §2.4: never on auth or settings. A sign-in form inside a toy shell reads as a toy asking for a password. |
| M17 Dex, M18 Journal, M19–M22 settings, system | Never | §4.3/§4.4 mark them `none` |

M01 is a deliberate exception, already written into the screen map. M01 on a first run hands off to M02 with the shell powering down to plain daylit page (see "Boot" below), so the Caller sees the object once, then the plain onboarding pages, then the object again when Santoro hands it over at M08.

## Anatomy on a phone

v11 describes a physical object. A phone is a 9:19.5 slab with its own safe areas, so each part is translated, not traced.

```
 ┌──────────────────────────────┐  ← OS status bar (safe top inset, untouched)
 │  ▕antenna▏          ◉ LED    │  top band, 40 pt: antenna nub left of centre, LED lens right
 │┌────────────────────────────┐│
 ││                            ││
 ││        3:4 screen          ││  width = window − 2 × rail (rail 12 pt)
 ││   (Mon / egg / scene)      ││  height = width × 4 / 3
 ││                            ││
 │└────────────────────────────┘│
 │  [L1]   ┌────────────┐  [R1] │  deck: takes the rest of the height
 │         │  trackpad  │       │  trackpad 112 pt square, centred
 │  [L2]   └────────────┘  [R2] │  two keys each side, 48 pt
 └──────────────────────────────┘  ← home indicator (safe bottom inset kept clear)
```

Measured fit (points, portrait):

| Device | Window | Safe top / bottom | Screen (3:4) | Deck left for trackpad + keys |
|---|---|---|---|---|
| iPhone SE 3 | 375 × 667 | 20 / 0 | 351 × 468 | 667 − 20 − 40 − 468 = 139 |
| iPhone 16 Pro Max | 440 × 956 | 62 / 34 | 416 × 555 | 956 − 62 − 40 − 555 − 34 = 265 |
| Pixel 8 | 412 × 915 | 24 / 24 (gesture nav, approx.) | 388 × 517 | 915 − 24 − 40 − 517 − 24 = 310 |

On SE the deck is 139 pt: trackpad 112 pt plus 12 pt padding top and bottom, keys 48 pt stacked with 8 pt gap (104 pt) fit beside it. That is the tightest case and it fits; anything shorter (landscape, split view, iPad slide-over) drops to the compact layout: screen goes full-bleed and the deck collapses to a 72 pt bar with the trackpad as a wide pill. Phase 1 is portrait-only on phones.

The whole deck sits in the bottom 40% of the window on every device in the table, which satisfies the thumb-reach rule in §4.

Translation choices:

- **"Two buttons on each side"**: drawn as two keys flanking the trackpad, not on the phone's edges. A 12 pt rail cannot hold a 44 pt target (Apple HIG minimum, https://developer.apple.com/design/human-interface-guidelines/accessibility#Buttons-and-controls).
- **Rear L/R, right-side volume/power, left-side action control**: not drawn. They would be on the back or edges of a real unit; the phone's own hardware buttons already sit there. They stay in the 3D device model for the web hero (`DeviceStage`). STRIKE for Phase 1 mobile, recorded in `docs/design/DECISIONS.md`.
- **Top antenna**: a short nub on the top band, decorative and hidden from assistive tech.
- **Backplate "H-Lynk"**: not visible in a front view. Not drawn. The H-Lynk mark does not exist in the repo (`docs/REPO_MAP.md` §7); we never draw one (§0A.2 logo rule).
- **Separate red scanner/emitter**: a round lens in the top band, physically separate from the screen and the trackpad, as v11 says "separate".

## Primary affordance: the trackpad

The trackpad is the one control that is always there on a companion screen, and it does the screen's main job.

| Gesture | Meaning | Screen examples |
|---|---|---|
| Tap | Primary action of this screen | M08 approach the focused egg; M10 confirm time; M13 open the next care need |
| Flick left/right | Move focus between peers | M08 between the three eggs; M10 between 15/30/60 |
| Hold (600 ms) | Commit a choice that matters | M08 choose this egg; M12 nothing (skip is a separate control) |
| Drag (M13 only) | Pan the room | §4.3 M13 |

Rules:

- Every trackpad action also exists as a plain on-screen control, labelled in words, for VoiceOver, TalkBack, Switch Control and anyone who does not discover gestures. The trackpad is a shortcut and a feel, never the only path.
- Accessibility: role `adjustable` when it moves focus between peers (VoiceOver swipe up/down maps to flick), with `accessibilityActions` for activate and the hold commit. Label reads the current target ("Metro Egg, 1 of 3"). Hold has a timeout-free alternative: the activate action plus a confirm step (WCAG 2.2 2.5.1 Pointer Gestures, https://www.w3.org/TR/WCAG22/#pointer-gestures).
- Haptics: tap = light, flick step = selection tick, hold commit = success. Through the existing `haptics` export in `packages/ui/haptics.native.ts` (react-native-pulsar today; `expo-haptics` is pinned but not installed, `docs/REPO_MAP.md` §10).
- Keys L1/L2/R1/R2: each screen assigns at most two of the four. Unassigned keys render as blank plastic, inert and hidden from assistive tech. No key is ever destructive (§4 thumb rule).

## The scanner LED is a status light

Red only (#7). Three meaningful states plus boot and off. Each state differs in *rhythm*, not in colour, because colour alone fails WCAG 1.4.1 (Use of Color) and red/orange/amber confusion is common.

| State | When | Lit | Rhythm (full motion) | Reduced motion (authored) | Text equivalent (VoiceOver and visible chip) |
|---|---|---|---|---|---|
| `off` | No egg, no Mon (M08 before choice) | dark lens | none | none | none |
| `boot` | M01 power-on | `apple-500` | one ramp 0 → 100% over 240 ms, hold | steps straight to 100% | "H-Lynk on" (announced once, polite) |
| `incubating` | Egg in the case, timer running | `apple-500` | slow breath, 4 s period, 35 → 100% | steady at 100% plus a small ring segment showing progress | "Incubating, 12 minutes left" |
| `ready` | Egg ready or overdue | `apple-500` | two short blinks, then steady, repeating every 6 s | steady, plus a filled dot beside the lens | "Ready to hatch" |
| `needsYou` | Any meter under the M13 threshold | `apple-500` | three quick blinks every 10 s | steady, plus an exclamation dot | "Needs you: Fullness" |

- The LED never pulses while loading data. Loading uses the kit's progress family inside the screen.
- Blinks stay under 3 per second (WCAG 2.3.1).
- The lens sits in a dark well in both themes, so the LED clears 3:1 whatever the body colour: `apple-500` on the well `concrete-900` #1C1E21 = **3.97:1**, on `night` #00041C = **4.83:1**. On a bare light body it would fail (`apple-500` on `concrete-200` #D2D4D6 = 2.83:1), and on a Knicks-royal body it fails badly (`apple-500` on `royal-500` = 1.33:1). That is why the well exists.
- The chip text sits outside the bezel, in the screen's own status row, so no information depends on reading the LED.
- Copy rule (#8, Law 9): the LED reports the egg's or the Mon's state. It never says the H-Lynk "holds", "controls" or "owns" the Mon, and visible text says "H-Lynk", never "device".

## Body colour, light and dark

v11 says only "Entry is plastic" (`V11 ¶63`). BUILD_PROMPT §1.1 says "Knicks blue body"; §1.3 says "concrete greys for the H-Lynk body". `docs/canon/OPEN_QUESTIONS.md` Q5 is open. Direction until it closes:

| Part | Daylit (default, #4) | Night (#4: night and the hatch) |
|---|---|---|
| Body plastic | `concrete-200` #D2D4D6, matte | `concrete-800` #303337, matte |
| Body edge keyline | `concrete-400` #9A9EA2 (decorative) | `concrete-700` #484C51 (decorative) |
| Screen bezel lip | `concrete-900` #1C1E21 | `night` #00041C |
| LED well | `concrete-900` #1C1E21 | `night` #00041C |
| Trackpad face | `concrete-100` #E6E7E8 | `concrete-900` #1C1E21 |
| Trackpad edge (ui, 3:1) | `concrete-600` #61656A on body = **3.95:1** | `concrete-400` #9A9EA2 on body = **4.71:1** |
| Key face | `concrete-300` #B8BBBE | `concrete-700` #484C51 |
| Key glyph (ui, 3:1) | `signage-black` on key = **10.89:1** | `concrete-300` on `concrete-800` = **6.58:1** |
| Accent on the shell | none; orange appears only on the primary CTA and the hatch | orange-500 rim on the trackpad during the hatch only |

`TODO(canon)` Q5: if Mike rules Knicks royal for the Entry body, swap the body plastic to `royal-500` and keep every other row; the dark LED well keeps the LED at 3.97:1, and the trackpad edge moves to `ink-50` (5.27:1 on royal, already measured in `CONTRAST.md`).

Night switches by time of day (device clock, §3.2) and for the hatch sequence. The switch is a 500 ms cross-fade of the shell tokens; reduced motion swaps instantly.

## Boot (M01) in one line

Dark shell → LED `boot` ramp → screen lights to the routed destination, inside 600 ms. First run: the shell then folds away to the plain M02 page. Details in `docs/design/screens/M01/03-direction.md`.

## Reduced motion

`AccessibilityInfo.isReduceMotionEnabled` gates at the sim-core adapter (§3.6). The chrome reads a single `reducedMotion` prop from that adapter; components never query the OS themselves.

| Animation | Full | Reduced (authored) |
|---|---|---|
| LED rhythms | per table above | steady light + a static shape cue |
| Shell power-on | screen fades up 0 → 1 in 240 ms, body scale 0.98 → 1 | screen cuts on; no scale |
| Daylit ↔ night | 500 ms token cross-fade | instant swap |
| Trackpad press | 0.97 scale (`PressScale`) + haptic | no scale; haptic and a face-colour change |
| Key press | 1 pt depress | face-colour change |

## Kit mapping (R3)

Existing components first. Anything with "NEW" needs a story in `packages/ui` before a screen uses it.

| Part | Kit component | Status |
|---|---|---|
| Safe-area handling | `SafeArea` (`packages/ui/SafeArea.tsx`) | exists, no story; story needed |
| Night scoping inside the shell | `NightScope` (`packages/ui/NightScope.tsx`) | exists, no story |
| Press feedback | `PressScale` (`packages/ui/press-scale.tsx`) | exists, no story |
| Haptics | `haptics` (`packages/ui/haptics.ts`) | exists |
| Entry/exit motion | `FadeIn`, `ScaleIn` (`packages/ui/motion.tsx`) | exist; no reduced-motion branch today. Needs a `reducedMotion` prop (variant, not a new component). |
| Status chip text | `Badge` `variant="default"` `size="sm"` | exists |
| Shell | `HLynkShell` | NEW |
| Screen window | `HLynkScreen` | NEW |
| LED | `ScannerLed` | NEW |
| Trackpad | `Trackpad` | NEW |
| Keys | `HLynkKey` | NEW |
| Antenna | part of `HLynkShell`, not exported | NEW (internal) |
| Shell tokens | `hlynk.*` token group in `@acme/theme` | NEW tokens, see `docs/DESIGN_SYSTEM.md` |

### NEW `HLynkShell`

The persistent frame for companion screens.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tier` | `'entry'` | `'entry'` | Mid/Pro are typed but unimplemented (expansion rule §0) |
| `scheme` | `'daylit' \| 'night'` | from time-of-day adapter | #4 |
| `led` | `ScannerLedState` | `'off'` | |
| `ledLabel` | `string` | required when `led !== 'off'` | text equivalent |
| `reducedMotion` | `boolean` | from sim-core adapter | |
| `layout` | `'standard' \| 'compact'` | measured | compact when the deck would be under 120 pt |
| `screen` | `ReactNode` | required | contents of `HLynkScreen` |
| `trackpad` | `TrackpadProps` | required | |
| `keys` | `Partial<Record<'L1'\|'L2'\|'R1'\|'R2', HLynkKeyProps>>` | `{}` | max two assigned |
| `power` | `'off' \| 'booting' \| 'on'` | `'on'` | M01 drives it |

Stories: `Daylit`, `Night`, `Compact`, `PowerOn` (with reduced-motion toggle), `AllLedStates`, `SE3Viewport`, `ProMaxViewport`, `RoyalBodyPendingQ5`.

### NEW `HLynkScreen`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactNode` | | three.js canvas, Skia HUD, kit controls layered per §3.1 |
| `statusRow` | `ReactNode` | | holds the LED text chip and meters |
| `aspect` | `'3:4' \| 'fill'` | `'3:4'` | `fill` in compact layout |

Stories: `WithEggPlaceholder`, `WithStatusRow`, `Fill`.

### NEW `ScannerLed`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `state` | `'off' \| 'boot' \| 'incubating' \| 'ready' \| 'needsYou'` | `'off'` | exhaustive switch |
| `progress` | `number` 0–1 | | `incubating` reduced-motion ring |
| `reducedMotion` | `boolean` | | |
| `scheme` | `'daylit' \| 'night'` | | well colour |

Accessibility: `accessibilityRole="image"` with the state label; live region polite on state change only. Stories: `States`, `ReducedMotionStates`, `OnNight`, `OnDaylit`.

### NEW `Trackpad`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | `string` | required | current target, e.g. "Metro Egg, 1 of 3" |
| `onActivate` | `() => void` | | tap |
| `onStep` | `(dir: -1 \| 1) => void` | | flick; also VoiceOver increment/decrement |
| `onCommit` | `() => void` | | hold 600 ms, or activate + confirm |
| `onPan` | `(dx: number, dy: number) => void` | | M13 only |
| `accent` | `'none' \| 'hatch'` | `'none'` | orange rim only during the hatch (#7) |
| `disabled` | `boolean` | `false` | |
| `reducedMotion` | `boolean` | | |

Stories: `Idle`, `Pressed`, `Stepping`, `HoldCommit`, `HatchAccent`, `Disabled`, `VoiceOverActions`.

### NEW `HLynkKey`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `slot` | `'L1' \| 'L2' \| 'R1' \| 'R2'` | required | |
| `label` | `string` | required | visible text under the key (12 pt) and the accessible name |
| `icon` | kit icon name | | from `@acme/ui/icons` |
| `onPress` | `() => void` | | unassigned keys render inert |

Stories: `Assigned`, `Inert`, `Pressed`, `Night`.

## Open values (TODO(canon), need the H-Lynk Bible)

- Entry body colour (Q5): concrete grey proposal vs Knicks royal.
- LED lens shape and exact position on the top band; whether the scanner and emitter are one lens or two.
- Antenna length and side.
- Exact key count on the deck if v11's "two buttons on each side" means the device's edges only.
- Whether the H-Lynk shows any boot text or mark (the mark does not exist in the repo).
- Capture case (Q4): whether the egg incubates in it; its look belongs to M10/M11, not this chrome.
