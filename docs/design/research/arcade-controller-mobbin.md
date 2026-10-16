# Arcade controller: Mobbin reference audit

Owner: Lane A (Research and Design Director), Master Directive v2 §12. Written 2026-10-15 for G01 (in-game controller overlay) and G03 (game-control settings). Companion audit: `game-lobby-mobbin.md`. Physical arcade geometry is in `arcade-ergonomics.md`.

Method: Mobbin MCP searches on iOS, 2026-10-15, for the §12 topics (controller configuration and customization, gamepad companion interfaces, in-game action control layouts, responsive control placement, haptic settings, handedness and accessibility customization, control state feedback). Every screenshot below was downloaded at full resolution (`scratchpad/mobbin/*.webp`, 1179 × 2676) and viewed before a word was written. Nothing is described from search metadata. References inform hierarchy, states and settings shape, never pixels: the NYC-Tron kit draws the pixels.

What Mobbin does not hold: a real-time action game with a virtual stick and a right-hand button cluster. Its library is product UI, so the closest matches are TV and console remotes, companion apps and settings screens. That gap is why `arcade-ergonomics.md` goes to cabinet sources for the cluster itself.

## Audit

### 1. SmartThings: D-pad ring in a remote sheet

- URL: https://mobbin.com/screens/6b67cece-f35e-460b-a6d9-dfef313f46db · App: SmartThings (Samsung)
- Shows: a dark half-sheet over a dimmed device page. One large recessed ring, four arrow caps on the rim, the up cap lit white (pressed), a darker inset disc in the centre. Three round keys below (back, home, play/pause), each a shaded disc with a glyph.
- Pattern: the pressed direction changes value (dark to white), not only size; the ring reads as a physical part through two tones and an inset.
- Strength: the lit cap is unambiguous at a glance and from the corner of the eye; round controls on a dark field with no outline noise.
- Weakness: the ring is 230 pt wide and centred, which is a two-handed, look-at-it remote; a game stick lives under one thumb and is used without looking.
- Application: the stick housing takes the recessed-ring idea (dark well, lighter rim, inset pad) and the "pressed = value change" rule for the cardinal indicators. Size and position come from the thumb zone, not from the centre of the screen.

### 2. Google TV: swipe versus D-pad mode

- URL: https://mobbin.com/screens/7088a28e-ebad-46ed-9caa-ef55e6054924 · App: Google TV
- Shows: the remote's big dark ring with four chevrons, and an open overflow menu with two options, "Swipe control" and "D-pad control", the second ticked. The same control surface renders both modes.
- Pattern: the input mode is a two-option switch, named by behaviour, chosen once, and the control redraws to match.
- Strength: one control, two readings; the tick says which is live.
- Weakness: the choice hides in an overflow menu, so a Caller who hates the default may never find it.
- Application: `stickMode` analog | dpad (contract.ts) is a visible `SegmentedControl` on G03, and the stick artboard carries a mode variant (eight indicators in D-pad mode, a free pad in analog) so the mode is visible on the controller itself.

### 3. Xbox companion: labelled edges, no drawn buttons

- URL: https://mobbin.com/screens/f29dc23d-69a0-4f4f-8914-fc4f6e2a4806 · App: Xbox
- Shows: a black field with four thin colour bars on the edges (yellow Y top-left, blue X left, red B right) and letters beside them, "A" in the centre with "Swipe to navigate. Tap to select." Media keys along the bottom.
- Pattern: the whole surface is the control; the four face buttons are edges with colour and a letter; the one explanatory line sits in the empty centre.
- Strength: it ships no fake gamepad art, which is exactly what directive §4 rejects; letters and colour do the identification.
- Weakness: edge targets have no visible size, there is no pressed state in this frame, and colour-plus-letter is the only cue, which fails users who cannot see the bars.
- Application: labels painted on the caps (`ActionBinding.label`) with a distinct pressed state per cap, never colour alone (CONTRAST.md rule, D3). The empty-centre line is the model for the "Hold to stop" hint text under the pill.

### 4. Roku remote: a full remote with one tooltip

- URL: https://mobbin.com/screens/a770c85a-4929-4906-92d5-a79390d3c182 · App: Roku
- Shows: a purple cross D-pad with "OK" in the centre, rows of rectangular keys above and below, and one white tooltip pointing at the highlighted "GUIDE" key: "See what's on the Live TV Guide, such as news, shows, and movies."
- Pattern: a first-run tooltip anchored to one control, the rest of the surface dimmed.
- Strength: the tooltip explains one key in one sentence and leaves the layout alone.
- Weakness: fourteen keys of the same shape and size; the D-pad and OK read as more of the same; nothing says which keys matter during play.
- Application: six buttons, one stick, one pill, nothing else on the overlay (directive §2). If a first-run hint is ever needed it anchors to one control, dims the rest, and reads once; it is not in Phase 1 scope (G01 `03-direction.md` no-list).

### 5. Google Arts & Culture: a round D-pad in a game

- URL: https://mobbin.com/screens/b5b37ed7-9bfd-4f8a-a2ac-a12084d7491a · App: Google Arts & Culture
- Shows: a cream play field with a drawn figure, a red score chip at the top ("3.66"), a sound toggle and a close button, and a single round red D-pad (four chevrons) bottom-centre, overlapping a white shape and a photo. The only game screen the library returned with an on-screen control.
- Pattern: one round control anchored to the bottom edge; the HUD is three small things at the top.
- Strength: the control is the one bright object on the field and sits where a thumb rests; the top HUD stays out of the play area.
- Weakness: bottom-centre is a two-thumb dead zone on a phone held in landscape, the pad overlaps content behind it with no scrim, and a red control on a cream field steals from the drawing it should serve.
- Application: the stick anchors lower-left and the cluster lower-right (§10 compact portrait), never bottom-centre; the camera's key region stays clear; the overlay's opacity is a setting (`ControllerProfile.opacity`) so the world shows through.

### 6. Runna: "Hold to Finish" under Resume

- URL: https://mobbin.com/screens/db8ce392-a5fa-4b82-a894-30b637f4a11e · App: Runna
- Shows: a workout screen with a yellow "PAUSED" band, the content dimmed, and two full-width buttons at the bottom: black "Resume" with a play glyph, coral "Hold to Finish" with a stop square.
- Pattern: resume is one tap; the terminal action is a hold, named as a hold in its own label.
- Strength: the label teaches the gesture; the two actions differ in colour, glyph and gesture, so a mis-tap on Finish does nothing.
- Weakness: the paused band is a flat yellow block with white caps text (not measured here; likely under 4.5:1), and the hold has no visible progress in this frame.
- Application: the pill's STOP is a hold with a visible progress ring and the label "Hold to stop" (G01 `05-copy.md`). The paused state is a band on the pill, not a full-screen block.

### 7. Google Health (Fitbit): vibration on/off and an intensity stepper

- URL: https://mobbin.com/screens/8258685c-2a4e-43e4-bdc5-4bcf3ab43fe6 · App: Google Health (Fitbit)
- Shows: a white card with two rows, "Vibration" with a toggle and "Vibration intensity: Low" with a stepper chevron, and one caption under the card, "Your Fitbit Air will vibrate for notifications."
- Pattern: a master toggle, one strength picker, one sentence saying what the setting does.
- Strength: two rows cover the whole need; the caption states the effect in plain words.
- Weakness: "Low" hides the other levels until tapped; a stepper gives no feel of the difference.
- Application: `haptics` off | light | medium | strong is a four-segment `SegmentedControl` on G03 with a sample pulse on change, and a caption that names where haptics fire (button press, stick edge, hold confirm). No separate master toggle: `off` is a segment.

### 8. Garmin Connect: preview above the fields

- URL: https://mobbin.com/screens/cd12a286-a788-436b-a23d-d1877c6715ad · App: Garmin Connect
- Shows: a black page titled "Edit Screen" with a line-drawn watch face at the top showing numbered zones 1, 2, 3, then a "LAYOUT" row ("3 Fields (No Labels)") and a "DATA FIELDS" list (Field 1 Timer, Field 2 Heart Rate Gauge, Field 3 Pace).
- Pattern: a live diagram of the thing being configured sits above its controls and updates with them.
- Strength: the numbers on the diagram match the list, so a Caller never guesses which field is which.
- Weakness: the diagram is a thin outline and small; at this size a preview of a controller would not show opacity or press depth.
- Application: G03 opens with a `ControllerPreview` at a real scale (the controller at the chosen `scale`, `opacity` and `handedness`) and the fields below; the preview is `accessibilityRole="image"` with a label that states the current values.

## Settings-shape references (G03)

Viewed and used in `screens/G03-game-control-settings/02-references.md`: Breathwrk vibration tiles (https://mobbin.com/screens/9ca8e991-56ec-415c-a983-2f96c0f035a4), Craft "Sound & Haptics" (https://mobbin.com/screens/d6bbaa0e-ee11-4fde-9a9b-f820307a6372), ElevenReader remap rows with Reset / Save (https://mobbin.com/screens/97ed73e2-6acf-4d87-8ae3-e551d44b76bb), Mercedes-Benz drag-only customisation (https://mobbin.com/screens/4ee4b023-2406-4ab1-a2d7-aa7c5ecedb37, rejected: no keyboard path), Tide Guide accessibility group (https://mobbin.com/screens/42ee74ba-d425-47c6-8006-7ea733ab68a2), Canva in-app reduce-motion dropdown (https://mobbin.com/screens/0e0b8aed-7212-44d1-a85c-be08f628e2b6, rejected: duplicates the OS setting).

## Patterns carried into G01

| Pattern | From | Where it lands |
|---|---|---|
| Pressed = value change on a dark well | SmartThings | `buttons/<id>/state` pressed and held, `07-a11y.md` contrast rows |
| Input mode visible on the control | Google TV | stick artboard variants per `stick/mode` |
| Letters on caps, never colour alone | Xbox | `ActionBinding.label`; D3 |
| Terminal action is a hold, labelled as a hold | Runna | pill `stopConfirm`, "Hold to stop" |
| One control per thumb, HUD at the top | Arts & Culture | §10 placement table in `08-handoff.md` |
| Preview above fields | Garmin | G03 `ControllerPreview` |
| Strength picker plus one sentence | Fitbit | G03 haptics segment and caption |

## What no reference answers

- Two simultaneous right-hand buttons with a moving stick (directive §9 "must support"). No Mobbin screen shows multitouch state. The Verification lane proves it with agent-device scripts, not with a reference.
- A six-button arch. Mobbin has none; `arcade-ergonomics.md` derives it from Sega Astro City and Vewlix measurements.
- Foldable postures for a controller. No Mobbin screen shows a hinge. `08-handoff.md` follows the mikevocalz-foldable-layouts skill and `packages/app/features/game/hud-layout.ts`.
