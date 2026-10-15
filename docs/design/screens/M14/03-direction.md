# M14 Feed: direction

Route `/(home)/feed`, presented as a sheet over M13 inside the H-Lynk screen. The Mon stays visible and reacts the whole time.

## The one move

The Mon watches the food. As a tile lifts from the tray the Mon's head tracks it; on release over the Mon it plays its own bloodline's eat clip for that food class, then a reaction. Feeding is a performance between two characters, not a meter refill.

## Layout (compact)

```
 │┌────────────────────────────┐│
 ││ Squeaklet     ◔ Fullness   ││ one ring (Fullness) stays visible
 ││        [ the Mon ]         ││ Mon in the upper 55% of the screen
 ││ ─────────── tray ───────── ││ SheetSurface in-screen, 45% height
 ││  [food] [food] [food]      ││ 3–4 tiles, 88 pt, picture + name
 ││  Favourite ★ (if canon)    ││ only when Q24 makes a favourite canon
 ││  [ Close ]                 ││
 │└────────────────────────────┘│
 │ [⌂] [≡]  ┏━trackpad━┓  [‹] [›] │ flick = move tile focus; tap = feed focused tile
```

The tray is an in-screen sheet (not the OS `BottomSheet`) so the shell stays put. Trackpad: `onStep` moves focus across tiles, `onActivate` feeds the focused tile. That is the non-drag route.

| Breakpoint | Change |
|---|---|
| Compact phone | as drawn; tiles wrap to two rows when Dynamic Type grows the names |
| Compact short | tray becomes a horizontal strip over the bar, 96 pt high |
| Medium / expanded / Quest 1280×800 | tray moves to the trailing side pane (`content-form` width) beside the 440 dp shell; drag from the pane onto the Mon in the shell works with ray drag; tap-select remains |

## States

| State | What the Caller sees | Mon |
|---|---|---|
| tray | tiles from `content/food` filtered by species; focus on the first tile | looks at the tray; ask vignette continues if a request is pending |
| dragging | the tile follows the finger at 1.1 scale; a drop ring appears on the ground disc under the Mon | head tracks the tile; leans in near the drop ring |
| eating | tray dims and is inert; Fullness ring fills after the clip's first bite | `eat_{food_class}` then `eat_react_good` (or `eat_react_bad` for a disliked food once likes exist) |
| full | Fullness ≥ overfeed line before the meal: a plain line explains what another meal does; tiles still work | the Mon turns its head from the tray (`refuse` body cue, softened) |
| declined | sim returns `declined` (`asleep` or `sluggish`): tray closes to a message with a route | `refuse` clip: step back and turn away, no speech (Q31) |

An overfeed (sim outcome `overfed`) plays the eat clip, then a slow, heavy-lidded settle, and returns to M13 with the chip "Full and slow". Never a sick or hurt pose.

## Type and colour

Tile name `type-label`; full/declined line `type-body`. Tile face `surface-raised`, edge `border`; focused tile edge `focus` 2 pt. No orange (no CTA here; feeding is the tile itself). Close is `Button variant="ghost"`.

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Tray open | `motion-enter` rise 8 pt, 300 ms | fade 200 ms |
| Tile lift | scale 1.1, `motion-tap` | colour flash, no scale |
| Drop | tile shrinks into the Mon's mouth position, 200 ms | tile fades out |
| Eat | per-bloodline clip; TypeGPU feed sparkle (§3.3) | reduced clip sibling; no particles |
| Ring fill | `motion-enter` | instant |

## No-list

- No invented foods, names, or nutrition numbers. No placeholder tiles.
- No calories, macros, prices, or "buy more".
- No sick, vomiting, or pained animation; no "too much!" scolding text.
- No timer on the tray.
