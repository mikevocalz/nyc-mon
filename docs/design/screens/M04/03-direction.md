# M04 Birth year gate: direction

Inputs: `01-research.md`, `docs/design/DECISIONS.md` (P1), ADR 0001, FTC COPPA FAQ D.7 and H.3 (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). Route `/(auth)/age`. Shell: none. States: adult / 13–17 / under-13.

## Position (P1)

M02 "Get started" → **M04** → under-13: M05, otherwise M03 (create). Returning sign-in never sees M04.

## The one move

The year is picked from a grid of plain tiles, decade first, then year. Nothing is preselected, no year is highlighted, nothing hints that one answer opens more. It looks like a departures board, not a form.

## Layout

```
 ┌──────────────────────────────┐
 │ ‹                            │
 │ What year were you born?     │  type-title (final words: ux-writer)
 │ One line on why we ask       │  type-body, concrete-600
 │                              │
 │ [1950s][1960s][1970s]        │  step 1: decade tiles, 3 columns, 56 pt high
 │ [1980s][1990s][2000s]        │  most recent decade last, current decade included
 │ [2010s][2020s]               │
 │                              │
 │ Type it instead              │  ghost link → numeric field, 4 digits
 └──────────────────────────────┘
```

Step 2 replaces the tiles with the ten years of that decade (future years removed) and a "Change decade" link. Tapping a year confirms it; one Continue button appears only after a year is chosen, bottom of screen, orange CTA (the only orange).

Two taps, not the prompt's "one tap": a single list of ~80 years is slow and a wheel always opens on a value, which is a default (FAQ D.7). Recorded as a deviation for `06-critique.md`.

## States

| State | After Continue |
|---|---|
| adult (18+) | M03 create |
| 13–17 | M03 create; the account is flagged teen (ADR 0001) |
| under-13 (`currentYear − birthYear ≤ 13`, ADR 0001) | M05 |

The answer is stored locally on Continue; Back from M03 or M05 does not reopen the gate with a fresh choice (FAQ D.7 "cookie" guidance, `01-research.md`). Under-13 copy on the next screen must work for a 13-year-old caught by year resolution.

## Type and colour

`type-title`, `type-body`, tiles in `type-label` with tabular figures. Tiles: white face, `concrete-600` edge (5.87:1 text on white; edge 5.33:1 on page). Selected tile: royal edge 2 pt plus a check glyph, never colour alone.

## Motion

Step 1 → 2: `motion-step`; reduced: cross-fade. No Mon, no reaction to the answer (ICO standard 13, `01-research.md`).

## No-list

- No preselected decade or year; no wheel; no "I am over 13" checkbox.
- No age bands.
- No lock icon, no "you must be", nothing punitive (§1.5).
- No character on screen (`voice: "ui"` only).
