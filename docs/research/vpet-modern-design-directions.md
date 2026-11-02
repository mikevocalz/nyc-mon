# Mon screen: modern and futuristic directions for the virtual-pet device

Lane 3 of 3 (modern references and the 2026 translation). Written 2026-10-29. Status: research and proposal. No code, token or kit component changed.

Scope: the Mon screen at `/(home)/mon/[id]` (`apps/mobile/app/(home)/mon/[id].tsx`, which renders `DexProfileScreen` in `packages/app/features/companion/DexProfileScreen.tsx`). Mike's brief: "very nostalgic but a modern futuristic take" on Tamagotchi, virtual-pet and Digipet devices, on iPhone and iPad.

Skills loaded for this pass: expo-app-design, building-native-ui, ux-heuristics-review, frontend-design, reanimated-skia-performance, threejs-fundamentals, threejs-materials, threejs-shaders, threejs-bloom, no-ai-slop.

## 0. What the screen is today, and the rules it has to keep

What `/mon/[id]` already does:

- When the 3D stage is up (`useGlassOn`), the route renders `GlassStage`: the procedural H-Lynk Core in three.js (`packages/ui/three/hlynk/device-scene.ts`, TSL nodes from `three/tsl`), this Mon's 3D model standing in front of the glass, and the Dex facts drawn onto the glass as a canvas-2D texture (`glass-screen.ts`, `GlassView` with status, title, lines, actions). On tablets the facts also sit in a `CompanionPane`. The device keys map to `back` and `home`.
- When the stage fails or is off, it falls back to a flat Dex page (portrait plus `DexFacts`).

Spec drift worth fixing before any direction is picked: `docs/design/screens/M17/03-direction.md` and `docs/design/hlynk/DIRECTION.md` ("Where the chrome appears") both say M17 has **no** H-Lynk chrome. The code already wraps it in the device. Mike's brief here points the same way as the code. Whichever direction lands, M17's direction file and the DIRECTION table need the row changed in the same PR.

Rules every direction below obeys (sources in brackets):

| Rule | Consequence for the Mon screen |
|---|---|
| Tokens only from `packages/theme/tokens.ts` | LCD inks, glow and plastic tints come from `hlynk.core.*`, `led.*`, `hud.*`, `neon.*`, `signage.*`, `concrete.*`. Any new colour (an LCD "paper" grey, a phosphor tint) lands as a token with a `contrast.ts` row in the same PR (DESIGN_SYSTEM "Law 10"). |
| Existing kit components only | Reuse `GlassStage`/`HLynkShell`, `HLynkKey`, `Trackpad`, `TrackpadActions`, `ScannerLed`, `CareMeterRing(Group)`, `RoundDots`, `LifecycleTrack`, `FoodTile`, `SignagePlate`, `SignageBand`, `HatchBurst`, `MonStillReaction`, `NotificationPreview`, `StatusRow`, `Announcer`, the `haptics` vocabulary. New parts need a story first (R3, `CONTRIBUTING.md`). |
| Decision #4: daylit default, dark for night and the hatch | Glow and bloom are night-only. Daylit renders keylines and solid faces. |
| Decision #7 and #16: red LED in the black head, never on bare red plastic; Core body is matte red | A translucent shell is a canon change (see Direction C). |
| Decision #8: the bond is the Mon's, never the device's | No copy says the H-Lynk "owns", "holds" or "keeps" the Mon. |
| Decision #28: every shader effect runs through WebGPU + TypeGPU | **No Skia runtime shaders (SkSL) for these effects.** Skia stays for vector drawing (rings, dots). LCD, bloom and holographic effects are TSL nodes on the existing three.js WebGPU stage or TypeGPU functions bridged by `@typegpu/three` 0.12.1. |
| Decision #29: the scanner LED is a status light, never a hatch trigger | No scan sweep in hatch or evolve moments. |
| `docs/phase-1-brief.md:21`: "never a Tamagotchi re-theme" | Nostalgia comes from behaviour and material (the beep, the three-key rhythm, the dot-matrix), not from copying the egg shell or Bandai's icon bar. |

Stack as pinned in `pnpm-workspace.yaml`: Expo 58.0.14, React Native 0.88.0, three 0.186.1, typegpu 0.12.7, react-native-skia 3.6.1, Reanimated 4.7.1, Uniwind 1.12.2, react-native-pulsar 1.7.0 (haptics), expo-audio 58.0.9, expo-notifications 58.1.5, expo-sensors (in `apps/mobile/package.json`).

Performance floor: an A12X iPad (iPad Pro 2018; the 11-inch panel is 1668 × 2388 px). No device capture of the Mon screen on A12X exists in the repo, so every cost below is a relative estimate (passes, full-screen pixel counts, extra render targets) and needs a measurement before it is called a budget.

## 1. Mobbin references

Searched 2026-10-29 with `mcp__mobbin__search_screens` (iOS). Mobbin returned nothing for Pou, the Tamagotchi apps, Pokémon Sleep, Neko Atsume or Bitzee; queries for them came back with unrelated apps, so none of those is cited from Mobbin. Mobbin does not index watch faces. Forest's Live Activity is the reference already used in `docs/design/screens/M11/02-references.md`.

| # | App and screen | Link | What to take |
|---|---|---|---|
| 1 | Abode, pet screen | https://mobbin.com/screens/d450f05c-bebb-4852-a443-c8f62468ff03 | The closest modern Tamagotchi layout on Mobbin: two meters top-left (heart bar, mood bar), a night toggle top-right, the pet centred on a scene, and three big square action buttons in a row under it. Proof that the three-button row still reads on a phone. |
| 2 | Finch, home | https://mobbin.com/screens/cca89013-d652-4235-a629-f9a8c61cadcd | The pet in a room, a speech-bubble line ("Big hug for you!") under it, then one progress bar, then the task list. The pet speaks one sentence, never a paragraph. |
| 3 | Finch, pet profile | https://mobbin.com/screens/b63e72e3-54bd-4a16-9950-0f3b496fc7d4 | A profile card for the pet: portrait, name, age, friendship, human, friend code, measurements. This is M17's job, and Finch shows it as a passport stamp. Our `SignagePlate` band plays the same role. |
| 4 | Finch, egg to hatch | https://mobbin.com/screens/e35e65d4-5375-4ea1-99f1-b83e54d88140 | The egg as a goal with a stated condition ("Complete your repeat goal 7 times"). Clear about what makes it hatch. |
| 5 | BitePal, feed | https://mobbin.com/screens/eb74890f-44ab-41bd-8933-7beebe1036c3 | Feeding framed as the pet asking a question, heart pips under the name, one big round primary button under a thumb. |
| 6 | BitePal, Lock Screen Live Activity | https://mobbin.com/screens/6367f897-015b-4f82-8ce7-0b4d21b5b4d0 | The pet sits on the Lock Screen next to a countdown and a progress bar. The "keychain" already exists on iOS in this form. |
| 7 | Forest, Live Activity | https://mobbin.com/screens/916918da-b9a5-4e16-923a-41d439e60c3f | A timed wait outside the app (already cited for M11). |
| 8 | Tolan, home | https://mobbin.com/screens/46e95f2b-2cdf-4175-bff2-b4d88aa4f8e5 | A 3D companion on a ground plane with three bottom actions (camera, chat, voice). Shows a modern 3D pet at rest with almost no chrome. |
| 9 | Duolingo, streak | https://mobbin.com/screens/f6675d16-c6b5-4847-aa9f-fb66a2d61e88 | The character speaks the stake ("Tomorrow makes 7 days"), one huge number, a week of check dots. The `RoundDots` and `DaysCalendar` kit pieces already cover the dot row. |
| 10 | Duolingo, lesson complete | https://mobbin.com/screens/fe966528-929c-475b-b917-9b342e3868a5 | The celebration moment: the character in a new pose, sparkles, three stat tiles, one button. Our evolve moment needs this shape, not a modal. |
| 11 | Gentler Streak, home | https://mobbin.com/screens/f9bf6004-fa31-4dbe-818a-6acbd51f0cae | A character whose mood is the status ("Day to Rest and Recover") with a segmented bar. Care state carried by pose and one sentence. |
| 12 | Life Reset, character profile | https://mobbin.com/screens/28db14a2-e6a1-4f49-a304-a048fa1880b4 | Dark pixel-art profile: sprite in a framed tile, stat rows, a segmented XP bar. The dot-matrix-plus-modern-type mix done in a utility app. |
| 13 | Babbel, Phrase Maze | https://mobbin.com/screens/7d85cf2e-c1ea-4656-adb9-a03f65955138 | Pixel type and pixel scene inside an otherwise modern app. The pixel layer is fenced inside one frame; the system UI around it stays modern. |
| 14 | Ahead, character skills | https://mobbin.com/screens/ec7ff4d8-ecff-4305-b6d2-3fbc5d082ef9 | Character on top, meters as stepped tracks below. Same split as our glass (Mon) plus pane (facts). |

Pattern across them: the pet is the status. Every one of these apps tells you how the pet is through its pose and a single sentence before any number appears. Meters are secondary and few (two to four). The primary action sits under the thumb as a big round or square button.

## 2. Hardware revivals and concept work

| Device | What it does that matters here | Source |
|---|---|---|
| Tamagotchi Uni (2023) | The three-button formula on a 128 × 128 colour screen, USB-C, Wi-Fi updates, a watch-strap adapter in the box. The reviewer's complaint: three buttons are miserable for text entry. | T3, https://www.t3.com/news/i-tried-the-tamagotchi-uni-and-it-makes-my-pet-free-existence-less-sad |
| Tamagotchi Paradise (2025) | Adds a side dial that zooms from the whole planet to a field, to the Tama, to its cells. Engadget: the dial "feels nice to spin and click", and it fixes the old problem of overshooting a menu item because you can go back. The top flips open to a physical dock for pairing. | The Verge, https://www.theverge.com/news/672451/tamagotchi-paradise-virtual-pet ; Engadget, https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html ; Screenhub, https://www.screenhub.com.au/news/reviews/tamagotchi-paradise-review-2673268/ |
| Bitzee (Spin Master, 2023) | A strip of colour LEDs flaps fast enough to draw a floating 8-bit pet by persistence of vision. You tap the pet's head, tilt, shake, or swipe a touch strip on the base. A neglected Bitzee packs up and leaves and can be coaxed back with treats; it never dies. | Gizmodo, https://gizmodo.com/bitzee-hologram-digital-pet-holographic-led-pixel-tamag-1850428896 ; Spin Master, https://www.spinmaster.com/en-us/brands/bitzee/ |
| Playdate (Panic, Teenage Engineering, 2022) | 400 × 240 1-bit Sharp Memory LCD at 173 ppi, no backlight, "the appearance of paper—specifically, newsprint". A fold-out crank for radial input. When idle the screen becomes a low-power clock. Teenage Engineering's Jesper Kouthoofd wanted to free players from "touch-screen psychosis". | Panic SDK, https://sdk.play.date/1.9.3/Designing%20for%20Playdate.html ; Panic blog, https://panic.com/blog/the-story-of-playdate/ ; https://play.date/ ; Wikipedia, https://en.wikipedia.org/wiki/Playdate_(console) |
| Teenage Engineering Pocket Operator (2015) | Bare PCB, no case, a custom segment LCD showing small looping animations. TE built the controls before the LCDs existed, which freed the LCD to be playful instead of functional. | Wikipedia, https://en.wikipedia.org/wiki/Pocket_Operators ; XLR8R Q&A, https://xlr8r.com/gear/qa-teenage-engineering/ |
| Nothing Glyph Interface and Glyph Matrix | Rear lights built to show calls and notifications while the phone is face down. Phone (3) (July 2025) swapped strips for a round 25 × 25 grid of 489 micro-LEDs plus a Glyph Button, with "Glyph Toys" (clock, stopwatch, battery, Magic 8 Ball). "Essential Notifications" keeps one zone lit until a chosen app's notification is read. | nothing.wiki, https://nothing.wiki/software/glyph_interface ; Trusted Reviews, https://www.trustedreviews.com/explainer/what-is-glyph-matrix |
| Rabbit R1 (2024) | Teenage Engineering's orange square with a scroll wheel and a push-to-talk key. One physical wheel plus one button carried the whole UI. | Dezeen, https://www.dezeen.com/2024/01/16/rabbit-r1-reimagines-digital-experience-ai-powered-device/ ; Fast Company, https://www.fastcompany.com/91013196/how-design-drove-10m-in-pre-orders-for-rabbit-r1-ai-hardware |
| Humane AI Pin (2024–2025) | No screen; "laser ink" projected onto the palm. Shut down on 28 February 2025 after HP bought the company's assets. The lesson for us is negative: novelty display, no reason to look. | TechSpot, https://www.techspot.com/news/106833-humane-shuts-down-ai-pin-business-hp-buys.html ; Axios, https://www.axios.com/2025/02/18/humane-ai-pin-shut-down-hp |
| Game Boy Color "Atomic Purple" (1998) | Translucent purple shell with the board visible. The reference for the clear-plastic side of Y2K. | Computing History, https://www.computinghistory.org.uk/det/52503/Game-Boy-Color-Atomic-Purple/ |
| Apple Watch | Third-party code cannot ship a watch face; a pet lives in complications and the Smart Stack. That is the watch "keychain" surface (not verified against watchOS 26 docs in this pass). | Apple watchOS HIG (load `watchos-design-guidelines` before any watch work) |

Takeaways for the Mon screen:

1. Every successful revival added one physical input and kept it simple: Paradise's dial, Playdate's crank, R1's wheel. The H-Lynk already has one: the square trackpad ringed in red. It should get a rotary gesture on the ring rather than new buttons.
2. The display technology is the nostalgia. Playdate sells the reflective LCD, Bitzee sells the floating LED pet, Nothing sells a grid of dots. None of them copies an old device's shell.
3. A pet that leaves (Bitzee) beats a pet that dies for a broad audience. Our care model already has no death screen; the attention call should feel like a nudge, not an alarm.
4. A light that stays on until you look (Nothing's Essential Notifications) is the modern beep. The H-Lynk's `ScannerLed` already does this inside the app; the Lock Screen widget should do it outside.

## 3. Visual language: nostalgic plus futuristic

Each technique lists how to build it on our stack, its cost on A12X, and an accessibility note. "Glass" means the canvas-2D texture on the device's screen mesh in `device-scene.ts`; it is drawn at `HUD_SIZE` (see `packages/ui/three/hlynk/hud.ts`), well below panel resolution, so per-fragment work on the glass is cheap compared with anything full-screen.

### 3.1 Dot-matrix LCD on the glass

- **What:** the screen reads as an LCD: a visible pixel grid (black matrix between cells), a light "paper" ground in daylight, slightly soft pixels, and dark cells that do not quite reach black.
- **How:** a TSL node on the glass material. Quantise `uv()` to a grid (for example 96 × 128 cells for the 3:4 glass), sample the glass texture at the cell centre, then darken the cell border with `smoothstep` on `fract(uv * grid)`. The Mon model in front of the glass gets the same grid only if it is rendered into a render target first; otherwise keep the model full-colour 3D and pixelate only the glass (cheaper, and it keeps the Mon as the hero).
- **Where not:** not in Skia, not as an RN `View` overlay of grid lines (thousands of views, and Decision #28 rules out non-TypeGPU shader duplicates).
- **Cost on A12X:** a handful of ALU ops per glass fragment, no extra pass. The cheapest effect in this document.
- **Accessibility:** text on the glass must still clear 4.5:1 measured cell ink against cell ground, not against the grid lines. Draw glass text at a cell size where a stroke is at least two cells thick, or bypass the grid for text runs. The `a11y` children of `GlassStage` already mirror every glass line as real `Text` for VoiceOver; keep that. Dynamic Type cannot scale a texture, so the `CompanionPane` (real text) stays the readable copy on tablets.

### 3.2 LCD response blur and ghosting

- **What:** when the sprite moves, it leaves a faint trail, as an old passive-matrix LCD did. libretro's Game Boy shader fakes this by blending previous frames with exponentially decreasing weights (`response_time` 0.0–0.777); sinedied's `lcd-perfect` shows a single-pass grid is fast enough for cheap Linux handhelds. (libretro, https://deepwiki.com/libretro/glsl-shaders/5-handheld-console-emulation ; https://github.com/sinedied/perfect-retroshaders)
- **How:** one ping-pong render target at glass resolution. Each frame: `out = mix(current, previous, persistence)`. Only the glass, never the 3D Mon or the device body.
- **Cost on A12X:** two small render targets and one blit per frame while the glass is animating. The glass redraws only on state change, so the pass can idle when nothing moves (`loop-policy.ts` already gates frames).
- **Accessibility:** ghosting is motion smear. With Reduce Motion on, persistence goes to 0. Keep persistence low by default (a forum consensus is that most LCD shaders "split the difference" between none and a real Game Boy, https://www.resetera.com/threads/looking-for-a-gameboy-lcd-shader-that-smears-the-outpout-like-an-accumulation-motion-blur-post-process.1422490/); text must never smear.

### 3.3 Segment displays

- **What:** seven-segment numerals for the Dex number, age in days and timers, with the unlit segments faintly visible, as on a Pocket Operator or a 90s clock.
- **How:** drawn into the glass canvas as paths (two passes: all segments at a dim token, then lit segments at full). No shader. On the flat fallback, `SignagePlate` stays the Dex number; segments are glass-only.
- **Cost:** none beyond a canvas redraw.
- **Accessibility:** segment numerals are hard to read for some people; the same value is always in the `a11y` text and the `CompanionPane`. Unlit segments are decorative and exempt; lit segments meet 3:1 as UI graphics at minimum.

### 3.4 Clear plastic, glow and bloom

- **What:** the Game Boy Color clear shell; LEDs and the screen bleeding light at night.
- **How (glow):** three's `BloomNode` (TSL post-processing) on the WebGPU renderer, selective to emissive surfaces: the LED lens, the trackpad ring, the lit glass at night. Per `threejs-bloom`, set emissive luminance first, threshold in HDR before tone mapping, and never let bloom be the only sign of a state.
- **How (clear plastic):** fake it. `MeshPhysicalMaterial` transmission renders the opaque scene to an extra texture every frame, which is the most expensive option here. A fresnel rim plus partial opacity plus a baked "internals" texture behind the shell gets the look for a fraction of the cost.
- **Cost on A12X:** bloom at native 1668 × 2388 is about 4 million pixels per blur level; run it at half resolution (about 1 million) and only at night (Decision #4 already says glow belongs to night). Real transmission is the one effect here likely to drop frames on A12X; avoid it.
- **Accessibility:** bloom lowers edge contrast around text. Never bloom glass text; keep glass text out of the emissive layer. Turn bloom off when iOS Reduce Transparency is on and on the lowest `game-perf` tier.

### 3.5 Holographic and lenticular

- **What:** the Dex card or the evolved form shifts hue as the iPad tilts, like a holo trading card or a lenticular sticker. This is where "futuristic" lives without neon everywhere.
- **How:** a TSL node mapping view angle (or device attitude from `expo-sensors`, already a dependency) to a hue ramp built from existing tokens (`royal`, `carolina`, `leaf`, `orange` steps) masked by a grain or line texture. Lenticular = two or three textures switched by `step` on the same angle.
- **Cost:** per-fragment on one small mesh. Cheap. The sensor subscription costs battery; pause it when the screen is not visible (`use-on-screen`).
- **Accessibility:** tilt-driven motion is a vestibular trigger. With Reduce Motion on, freeze the angle at a fixed, pleasant value. Never hide information in a lenticular state.

### 3.6 Y2K and Frutiger Aero revival vs cyber-minimal

| | Y2K / Frutiger Aero | Cyber-minimal |
|---|---|---|
| Look | Glossy bubbles, translucent candy plastic, sky gradients, water droplets | Black, hairlines, monospace, single accent |
| Fits our canon | Partly: the clear-shell idea fits; the sky-blue gradient world fights the daylit concrete palette | Partly: the NeonBlade vocabulary already is this, at night |
| Risk | Reads as "kids' toy", which `PREMIUM_SITE_AUDIT.md` H4 tests against | Reads as the generic "near-black with one acid accent" template the frontend-design skill warns about |
| Verdict | Take the material (clear plastic, gloss) only | Take the discipline (one accent, hard keylines) only |

The NYC-MON answer is neither: matte red Core plastic and MTA-signage type by day, LED and LCD glow by night. Nostalgia comes from the LCD and the beep, futurism from the 3D Mon standing in front of the glass and the holographic layer.

### 3.7 Haptics as the modern beep

- **What:** the Tamagotchi beep was the product's voice. On an iPad (most iPads have no Taptic Engine) and on a silent iPhone, the beep has to become light plus sound plus, where available, a tap.
- **How:** the `haptics` vocabulary in `packages/ui/haptics.native.ts` already has `tap`, `selection`, `success`, `warning`, `warm`, `hatchLatch`, `hatchCrack`, `hatchBloom`, `hatchEmerge`, `firstLook` (react-native-pulsar presets). Add semantic entries only for new moments (`attention`, `evolve`, `dialDetent` mapped to existing Pulsar presets), never raw calls. Sound: short chiptune cues through expo-audio, gated by `soundEnabled()` from `device-preferences.ts`, and silent when the ring/silent switch is on.
- **Cost:** none on GPU.
- **Accessibility:** every cue has three channels: LED rhythm (with the reduced-motion tick row `ScannerLed` already draws), a VoiceOver announcement via `Announcer`, and haptic or sound. No state is carried by sound alone. LED blink rhythms already stay at or under three flashes per second (`maxFlashesPerSecond` in `led-rhythm.ts`, WCAG 2.3.1); any new attention rhythm reuses those tokens, and no full-screen red flash is ever used.

## 4. Interaction model

### 4.1 The A/B/C loop on touch

The classic loop: A cycles the icon bar, B selects, C cancels. The H-Lynk already has the gestures (`DIRECTION.md` "Trackpad"): tap = primary action, flick left/right = move focus between peers, hold 600 ms = commit. Mapping:

| Classic | H-Lynk on iPhone and iPad | Haptic | Hardware keyboard (iPad) |
|---|---|---|---|
| A (cycle) | Flick on the trackpad, or turn the ring (4.2) | `selection` per step | Left/right arrows |
| B (select) | Tap the trackpad | `tap`, then `success` when the action lands | Return or Space |
| C (cancel) | Back key (`HLynkKey` role `back`) | `tap` | Escape |
| A+C (Tamagotchi's sound toggle) | Long-press the menu key opens a sheet with Sound and Haptics switches (writes `setKitPreferences`) | `selection` | none |

Everything stays reachable without the trackpad: the glass actions are hit targets, the controls list in `GlassStage` makes each key a real button for VoiceOver and Switch Control, and pointer hover works on iPad.

### 4.2 A dial without new hardware

Paradise's zoom dial and Playdate's crank both point at radial input. The H-Lynk trackpad has a red ring; a circular drag on the ring (angle from the pad's centre) becomes the dial. Detents every 30° fire `selection`. Uses:

- On `/mon/[id]`: zoom levels, Paradise-style: the block in the 3D city → the Mon full body → the Mon's face (care state) → "inside" (Dex facts, lifecycle). Each detent is a camera bookmark, so it costs nothing new to render.
- In menus: scroll with the ability to go back, the fix Engadget praised.

Reduced Motion: the dial steps between bookmarks with a cross-fade instead of a camera move (`motion-step` reduced). A dial is a hidden gesture, so the flick and the keys must reach every level too (H6, recognition over recall).

### 4.3 "It's beeping in your pocket"

| Surface | When | Notes |
|---|---|---|
| Local notification (expo-notifications, already wired for hatch-ready in `features/mon/ready-notification.ts`) | A care need crosses its low line | One per need, collapsed by thread. Copy is the Mon speaking one sentence, Finch-style. Tapping deep-links to `/mon/[id]` with the trackpad focused on that need. |
| Live Activity | Only for waits with a start and an end: incubation, a rest timer | Apple's HIG treats a Live Activity as a task in progress with an end, not a standing alert (https://developer.apple.com/design/human-interface-guidelines/live-activities). A continuous "your Mon is hungry" Live Activity would misuse it. The 8-hour active limit is from ActivityKit; check it against the current docs before building. BitePal (Mobbin #6) and Forest (#7) are the references. |
| Dynamic Island | iPhone only, during those same timed waits | Compact: the Mon's 1-bit sprite left, countdown right. Minimal: the LED dot. |
| iPad | No Dynamic Island. Whether iPadOS 26 shows Live Activities on the iPad Lock Screen was not verified in this pass. Check on a device; until then iPad gets notifications and the widget only. |

Native cost: Live Activities and widgets need an Apple extension target. `apps/mobile` has no widget or activity target today (no `targets/` folder, no `@bacons/apple-targets` in `package.json`), so this is new native work with its own prebuild and signing lane.

### 4.4 The Lock Screen widget as the keychain

The keychain was the point: the pet was always on you and you could glance at it. The modern equivalent is a Lock Screen accessory widget plus a small Home Screen widget:

- Accessory circular: the Mon as a 1-bit sprite (Lock Screen widgets render monochrome in vibrant mode, which suits the dot-matrix look), the LED state as a ring.
- Accessory rectangular: sprite plus one line ("Squeaklet is hungry") plus age in segment numerals.
- Small Home Screen widget: the glass as a still frame, LED dot in the corner, the same `GlassView` content rendered as an image by the app.
- Interactive widget buttons (App Intents) for one care action are tempting; keep them for later, because a care action from a widget skips the moment the app exists to deliver.

## 5. Three directions

iPad portrait reference: 11-inch, 834 × 1194 pt. All three keep the existing tablet arrangement (device stage plus `CompanionPane`; `AGENTS.md` says tablets keep a physical right rail for navigation, so the rail sits at the right edge in every mockup).

### Direction A: Memory LCD

**Concept.** The H-Lynk's glass becomes a reflective memory-LCD, Playdate-style: newsprint-grey ground, dark dot-matrix pixels, no backlight in daylight, a visible black matrix, slight ghosting when the sprite moves. The 3D Mon stands in front of the glass in full colour and steps "into" the LCD when it is idle, where it is drawn as a dithered sprite. Day is paper, night switches the LCD backlight on. Numbers are seven-segment. The nostalgia is the screen; the futurism is the 3D Mon crossing the glass plane. It follows Decision #4 directly: daylight needs no glow at all.

```
┌─────────────────────────────────────────────────────────────┬──┐
│ ‹ back                                        Squeaklet      │R │
│  ┌──────────────── H-Lynk Core (matte red) ─────────────┐   │A │
│  │ ▌██ scanner head ████████████████████████ (●) LED ██ │   │I │
│  │ ┌──────────────────────────────────────────────────┐ │   │L │
│  │ │ ░░░░░░░░░░ LCD paper, dot grid ░░░░░░░░░░░░░░░░░ │ │   │  │
│  │ │  No. ▯▯2   segment numerals          ♥ ▮▮▮▯      │ │   │  │
│  │ │                 ▄▀▀▄                              │ │   │  │
│  │ │        [ 3D Mon stands in front of glass ]        │ │   │  │
│  │ │                 ▀▄▄▀  (dithered when idle)        │ │   │  │
│  │ │  ─ Egg ✓ ─ Baby ● ─ ○ ─ ○ ─ ○ ─                   │ │   │  │
│  │ │  [ Feed ]  [ Rest ]  [ Talk ]   ← glass actions   │ │   │  │
│  │ └──────────────────────────────────────────────────┘ │   │  │
│  │  [⌂] [≡]      ┏━━━━━━━━━━━┓ ← ring = dial  [‹] [›]   │   │  │
│  │               ┃ trackpad  ┃                          │   │  │
│  │               ┗━━━━━━━━━━━┛                          │   │  │
│  └──────────────────────────────────────────────────────┘   │  │
│ ┌ CompanionPane: Dex facts (real text, Dynamic Type) ─────┐ │  │
│ │ Name  Squeaklet     Hatched  12 Oct 2026   Caller  Mike  │ │  │
│ └──────────────────────────────────────────────────────────┘ │  │
└─────────────────────────────────────────────────────────────┴──┘
```

Motion moments:

- **Hatch:** the egg sits on the LCD as a dithered sprite. Stir and pressure (Decision #29) are pixel wobbles with ghost trails. At the burst the LCD backlight flares orange (`hlynk.core.hatchRim`, the hatch accent) and the 3D Baby steps out of the glass toward the camera. Reduced: the sprite swaps to the Baby with a cross-fade; no flare.
- **Feed:** a `FoodTile` item drops onto the LCD as pixels, the 3D Mon leans back into the glass to eat, segment heart pips fill one at a time. Reduced: pips fill with no lean.
- **Evolve:** the LCD inverts (dark ground, light pixels) for one beat while the 3D model swaps; the new form name prints on a `SignagePlate` band. Duolingo-style stat tiles below. Reduced: no invert; the name plate fades in.
- **Attention:** the LED blinks `motion-led-blink-needs-you`; on the LCD, a single 8 × 8 pixel "!" icon appears in the need's corner and stays until handled (Nothing's Essential Notifications idea). Reduced: steady LED plus the tick row.

Sound and haptics: one-voice square-wave chirps (`side-key-chirp` already exists for the side keys) for select and cancel; `selection` per dial detent; `success` on a care action; `warning` only for the needs-you call. Silent switch respected.

Reuses: `GlassStage`, `HLynkShell`, `HLynkKey`, `Trackpad`, `ScannerLed`, `LifecycleTrack`, `SignagePlate`, `FoodTile`, `RoundDots`, `CompanionPane`, `Announcer`, `haptics`, `side-key-chirp`. New: one TSL LCD node on the glass material, one ghosting render target, segment-numeral drawing in `hud-draw.ts`, a dial gesture on `Trackpad` (needs a story), and LCD paper/ink tokens with `contrast.ts` rows.

Cost on A12X: lowest of the three. One cheap per-fragment node on a small mesh, one small extra target while animating, no bloom by day.

### Direction B: Lit Matrix

**Concept.** Night first. The glass is black and the Mon is drawn as a grid of round LEDs, part Bitzee floating pixels, part Nothing Glyph Matrix. The 3D Mon is present but lit only by its own matrix, so it reads as a hologram projected forward from the H-Lynk. The scanner head's red LED gets company: a row of small status dots, one per care need, each lit while that need is open. Bloom does the work, selective and half-resolution. In daylight (Decision #4) the matrix turns into hard black dots on concrete, with no glow, and loses most of its charm. That is the weakness.

```
┌─────────────────────────────────────────────────────────────┬──┐
│ ‹ back                                                       │R │
│  ┌──────────────────────────────────────────────────────┐   │A │
│  │ ▌██ head ███ ● ● ○ ○  care dots ██████████ (●) LED ██│   │I │
│  │ ┌──────────────────────────────────────────────────┐ │   │L │
│  │ │ · · · · · · · · · · · · · · · · · · · · · · · · ·│ │   │  │
│  │ │ · · · · · · · ●●●●● · · · · · · · · · · · · · · ·│ │   │  │
│  │ │ · · · · · · ●●●●●●●●● · ·  LED-matrix Mon,      ·│ │   │  │
│  │ │ · · · · · · ●● ●●● ●● · ·  bloomed at night,    ·│ │   │  │
│  │ │ · · · · · · · ●●●●●●● · ·  3D silhouette        ·│ │   │  │
│  │ │ · · · · · · · · ●●● · · ·  projected forward    ·│ │   │  │
│  │ │  0 0 2    S Q U E A K L E T    (dot-matrix type)  │ │   │  │
│  │ └──────────────────────────────────────────────────┘ │   │  │
│  │  [⌂] [≡]      ┏━━━━━━━━━━━┓                [‹] [›]   │   │  │
│  │               ┃ trackpad  ┃ ← ring glows red at night│   │  │
│  │               ┗━━━━━━━━━━━┛                          │   │  │
│  └──────────────────────────────────────────────────────┘   │  │
│ ┌ CompanionPane: Dex facts ───────────────────────────────┐ │  │
│ └──────────────────────────────────────────────────────────┘ │  │
└─────────────────────────────────────────────────────────────┴──┘
```

Motion moments:

- **Hatch:** the matrix shows the egg as a dim oval; pressure brightens the dots from the centre out, then the burst scatters dots that regroup as the Baby. Reduced: dim egg cross-fades to the Baby.
- **Feed:** dots stream from the food icon into the Mon's mouth region; the matching care dot in the head goes out.
- **Evolve:** every dot goes dark for a beat, then the new form draws row by row, top to bottom, like a scanning LED sign. Reduced: instant swap plus a name plate.
- **Attention:** the care dot for that need blinks in the head; the Mon's matrix dims to half brightness until handled.

Sound and haptics: softer, synth-pad cues; a `heartbeat`-style Pulsar pattern (the `firstLook` preset) for attention.

Reuses: `GlassStage`, `ScannerLed` (extended to a dot row; needs a story), `NightScope`, `hud` and `neon` tokens, `HatchBurst`. New: an instanced-dot TSL material for the matrix, selective `BloomNode`, a care-dot row in the head.

Cost on A12X: highest of the three. A full-screen half-resolution bloom chain every frame at night, plus an instanced dot field. Needs a measured frame time before it can ship as the default.

Accessibility: dot-matrix type is the hardest of the three to read, so the glass carries no facts at all in this direction; everything readable lives in the pane. Bloom off under Reduce Transparency.

### Direction C: Specimen Case

**Concept.** The H-Lynk Core goes translucent: still red, but smoked red plastic you can see into, Atomic-Purple style, with the board, the battery and the scanner emitters visible inside, Pocket Operator honesty. The screen is a modern full-colour display, and the futurism sits on the Dex card: a holographic, tilt-reactive card for this Mon, a collectible you can turn. Nostalgia comes from the shell, not the screen. It needs a canon call: Decision #16 makes the Core matte red, and a clear red body could only arrive as a new tier or a special edition, which is Mike's decision. The red LED stays in the black head, so the "never on bare red plastic" rule holds as long as the head stays opaque black.

```
┌─────────────────────────────────────────────────────────────┬──┐
│ ‹ back                                                       │R │
│  ┌─ smoked translucent red shell, board visible inside ──┐  │A │
│  │ ▌██ opaque black head ████████████████████ (●) LED ██ │  │I │
│  │ ┊ ╔═══ PCB traces ═══╗┌───────────────────────────┐ ┊ │  │L │
│  │ ┊ ║ battery  ▭▭▭    ║│   full-colour glass:      │ ┊ │  │  │
│  │ ┊ ║                  ║│   3D Mon in its block     │ ┊ │  │  │
│  │ ┊ ╚══════════════════╝│   CareMeterRings below    │ ┊ │  │  │
│  │ ┊                     └───────────────────────────┘ ┊ │  │  │
│  │  [⌂] [≡]      ┏━━━━━━━━━━━┓                [‹] [›]    │  │  │
│  │               ┗━━━━━━━━━━━┛                           │  │  │
│  └───────────────────────────────────────────────────────┘  │  │
│ ┌ Holo Dex card (tilt shifts hue) ─────────────────────────┐ │  │
│ │ ███ No. 002 ████  Squeaklet   Hood Ratti Bloodline        │ │  │
│ │ ░▒▓ lenticular band: Egg ↔ Baby when tilted ▓▒░           │ │  │
│ └──────────────────────────────────────────────────────────┘ │  │
└─────────────────────────────────────────────────────────────┴──┘
```

Motion moments:

- **Hatch:** the egg's light shows through the shell from inside before the screen shows anything; the shell glows warm, then the screen cuts to the Baby. Reduced: the shell stays still and the screen cross-fades.
- **Feed:** a small internal LED on the board pulses once per bite, visible through the plastic.
- **Evolve:** the Dex card flips (a 3D card turn) to a new holo foil pattern for the new form. Reduced: the card fades between faces.
- **Attention:** the inside of the shell takes on a faint red wash from the head's LED. Reduced: steady LED.

Reuses: `HLynkShell` geometry, `CareMeterRingGroup`, `SignagePlate`, `LifecycleTrack`, `DaysCalendar`. New: a translucent shell material and a modelled interior (asset work), a holo card component (needs a story), sensor-driven tilt.

Cost on A12X: medium if the shell is faked (fresnel + alpha + baked interior), high if it uses real transmission. Alpha-blended shells need sorting and lose depth writes; keep the shell as the only transparent object.

## 6. Comparison

| | A Memory LCD | B Lit Matrix | C Specimen Case |
|---|---|---|---|
| Nostalgia carried by | The screen and the beep | The LED pet | The shell |
| Futurism carried by | 3D Mon crossing the glass | Hologram projection | Holo Dex card |
| Daylit (Decision #4) | Native: paper LCD | Weak: glow is its point | Fine |
| Canon change needed | No | No | Yes (translucent Core) |
| A12X cost | Low | High (bloom every night frame) | Medium to high |
| Readability of facts on the glass | Good at two-cell strokes | Poor; facts move to the pane | Good |
| Risk of "Tamagotchi re-theme" | Low: Playdate and Game & Watch, not Bandai | Low | Medium: a clear egg-adjacent toy look |

## 7. Recommendation

Build **Direction A, Memory LCD**, and borrow B's night state: when the device clock says night, the LCD backlight comes on, ink and ground invert to lit pixels on a dark ground, and only the LED, the ring and the lit pixels bloom, at half resolution. That is one direction across Decision #4's two schemes instead of two directions. Hold C as a later H-Lynk tier proposal for Mike, since it needs a canon decision on Decision #16.

Reasons, in order:

1. A works by day, which is the default scheme, and B does not.
2. A is the cheapest on the A12X floor and lives on the glass texture the screen already draws, so it changes one material and the canvas drawing, not the scene.
3. A's references (Playdate, Game & Watch, Pocket Operator) are not Bandai's, which keeps clear of the brief's "never a Tamagotchi re-theme" line while still delivering the LCD-and-beep feeling Mike asked for.
4. The ring-as-dial and the Lock Screen keychain work in all three directions, so they can start now.

Order of work if A is approved:

1. Update M17's direction file and the "Where the chrome appears" table in `docs/design/hlynk/DIRECTION.md` so they match the code (the Mon screen has the device).
2. LCD paper and ink tokens plus `contrast.ts` rows; the TSL LCD node on the glass, with a story.
3. Segment numerals in `hud-draw.ts`.
4. Ring-dial gesture on `Trackpad` with `selection` detents, keyboard arrows as the equivalent, and a story.
5. Ghosting target, gated by Reduce Motion.
6. Night backlight and selective half-resolution bloom; measure frame time on an A12X iPad before turning it on by default.
7. Separately, the native lane: widget target first (keychain), then a Live Activity for incubation only; check iPad Live Activity support on a device first.

## 8. UX heuristics check on the recommendation

Verdict: solid foundation, three things to watch.

**H1 Visibility of system status**
- The LCD "!" icon and the LED both show an open need; the pane states it in words. Keep all three in step.

**H6 Recognition rather than recall**
- The ring dial is invisible until learned. Show a one-time ring hint (the ring arcs once) on first visit, and keep flick and keys as full equivalents.

**H8 Aesthetic and minimalist design**
- Two to four meters at most on the glass, matching every Mobbin reference. The rest goes in the pane.

**H4 Consistency and standards**
- Sound and haptic toggles live in Settings already (`setKitPreferences`); the long-press-menu shortcut must write the same preference, not a second one.

Priority actions:
1. Fix the M17 and DIRECTION.md drift before building.
2. Measure A12X frame time for the night bloom before it ships by default.
3. Give every dial-only action a key or flick equivalent, and test with VoiceOver and a hardware keyboard on iPad.

## 9. What was not verified

- No Mobbin results exist for Pou, Tamagotchi apps, Pokémon Sleep, Neko Atsume, Bitzee or watch faces; those apps are cited from press only, or not at all.
- iPadOS Live Activity display and the exact ActivityKit duration limits were not read from Apple's current page (the HIG page did not render through the fetch tool). Check both before the native lane starts.
- watchOS third-party face policy was not re-checked for watchOS 26.
- No A12X frame-time measurement exists for any effect here; all costs are relative estimates from pass and pixel counts.
- The Rabbit R1 Fast Company article returned 403; the R1 description rests on Dezeen.
