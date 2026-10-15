# M16 Social (play): direction

Route `/(home)/social`. Shell stays; the trackpad is the game controller (its flick and tap already exist).

## The one move: Peek

The Mon hides and the Caller finds it. Three hiding spots in the room (left, centre, right: set dressing the room already has). The Mon ducks behind one; the Caller flicks the trackpad to look at a spot and taps to peek. Found: the Mon pops out with a happy bounce and hides again. Wrong spot: the Mon peeks out from where it really is, as if it couldn't wait to be found, and that round still counts as found. Nobody loses. Six rounds take 20–40 s at a relaxed pace.

The mechanic uses only the trackpad's existing verbs (flick = step, tap = activate), so it works with VoiceOver adjust actions, arrow keys, the on-screen `TrackpadActions` twin, and Quest ray/pinch with no new input model.

Per-bloodline flavour (how a Squeaklet, a Kittee Cee or a Yotito hides: low, high, behind, under) is `TODO(canon)` (Q44). Phase 1 ships one shared hide/peek performance per bloodline once Mike's models exist; the mechanic does not change.

## Layout (compact)

```
 │┌────────────────────────────┐│
 ││ Squeaklet        ◔ Social  ││ Social ring only
 ││   [spot]  [spot]  [spot]   ││ three spots; focused spot gets a ground marker
 ││        (Mon hides)         ││
 ││ Round dots ○ ○ ● ○ ○ ○     ││ progress, not score; no timer
 ││ [‹ Look left][Peek][Look ›]││ TrackpadActions twin
 │└────────────────────────────┘│
 │ [⌂] [≡]  ┏━flick / tap━┓  [‹] [›] │
```

| Breakpoint | Change |
|---|---|
| Compact short | twin buttons collapse into the bar; round dots move to the head strip area of the screen |
| Medium / expanded / Quest 1280×800 | intro and result cards move to the trailing pane; the game stays in the shell screen; ray-hover over a spot focuses it, pinch peeks |

## States

| State | What happens |
|---|---|
| intro | Mon bounces toward the camera (`play` clip start); one line explains; Start button and trackpad tap both start. If too tired or asleep, intro shows the reason and a route instead of Start |
| playing | six rounds; no timer; focused spot marked; a wrong peek reveals the Mon at its real spot |
| result | Mon plays a content idle near the camera; Social ring fills to its new value; one line in words; "Play again" and "Done" |

## Type and colour

Round dots: filled `structure`, empty `concrete-300` outline (dots are progress; the line under them states "Round 3 of 6" for AT). Focus marker on the floor: `focus` ring. Start/Play again: `Button variant="cta"` (the one orange button on the screen); Done: `variant="ghost"`.

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Hide | Mon ducks behind a spot, 400 ms | Mon fades out at its spot, 200 ms |
| Peek found | pop-out bounce | Mon fades in, static happy pose |
| Peek wrong | Mon peeks out from its real spot with a head tilt | Mon fades in at its real spot |
| Result ring | `motion-enter` | instant |

## No-list

- No timer, no score, no stars, no "perfect", no currency, no confetti.
- No sad or disappointed reaction to a wrong peek.
- No bond number (Q26).
- No multiplayer UI. The seam is a type, not a screen (see `08-handoff.md`).
