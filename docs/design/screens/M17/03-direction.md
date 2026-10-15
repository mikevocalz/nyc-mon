# M17 Dex entry / Mon profile: direction

Route `/(home)/mon/[id]`. Shell: none (§4.3; `DIRECTION.md` "Where the chrome appears"). Scheme: OS appearance (D8). Back returns to the companion screen it came from.

## The one move

A Dex record and a person, on one page. The top half is the species card in the H-Lynk's signage language: Dex number, Baby form name and "<family> Bloodline" on a `SignagePlate` band (D10). The bottom half is this individual, written as plain facts: name, hatched on, Caller. The species card is what every Squeaklet shares; the sheet is the one who knows your name.

## Layout (compact)

```
 │ ‹                       [Photo] │ back; photo mode (only when available)
 │ ┌───────────────────────────┐   │
 │ │   [Mon portrait / pose]   │   │ 4:5 portrait, live 3D when models exist
 │ └───────────────────────────┘   │
 │ ███ No. 002 ████████████████    │ SignagePlate: Dex number
 │ ███ Squeaklet ██████████████    │ SignagePlate: form name (type-station)
 │ Hood Ratti Bloodline            │ type-label
 │ Egg ✓ ── Baby ● ── ○ ── ○ ── ○  │ LifecycleTrack; later slots unnamed
 │                                  │
 │ Name        {name}               │ KeyValueList: the individual
 │ Hatched     {hatchedDate}        │
 │ Caller      {callerName}         │
 └──────────────────────────────────┘
```

Rows the brief lists but canon has not filled (bond, likes, culture note) are not rendered at all, and the record lives in `06-critique.md`. When their canon lands they slot into the `KeyValueList` with no layout change.

| Breakpoint | Change |
|---|---|
| Compact | single column, 16 pt gutter |
| Medium | single column, `content-detail` (48rem) centred |
| Expanded / Quest 2D 1280×800 | two columns: portrait + photo mode left (5/12), card and sheet right (7/12), both top-aligned inside `content-screen` (56rem). Pointer hover on rows and buttons |

## Photo mode (state)

Full-bleed portrait on a checkerboard that shows transparency, pose strip of the Mon's idle vignettes (from `MonSpeciesDef.idleVignettes`, empty until authored → strip hidden), one shutter at bottom centre, Cancel top-left. Export writes a transparent PNG of the Mon only: no background, no text, no Caller name, no date, no location metadata.

## Type and colour

Signage band `signage-white` on `signage-black` (21:1). Facts: labels `type-caption` `text-muted`, values `type-body` `text`. Lifecycle: filled dot `structure`, check glyph on `structure`, empty slots `concrete-600` outline. Photo button `Button variant="outline"`; shutter a 72 pt circle, `surface-raised` with a `text` ring.

## Motion

Entry: `motion-enter` on the card and sheet. Photo mode: portrait expands with `motion-step`; reduced: fade. Shutter: a 120 ms white flash over the portrait only (reduced: none; the "Saved" message carries the feedback).

## No-list

- No Small, Mid or Max form names, and no later stage words on the track.
- No pronoun, no gender row.
- No bond bar, no XP, no "next evolution in".
- No placeholder rows ("Culture: coming soon").
- No Caller name, date or location inside an exported image.
