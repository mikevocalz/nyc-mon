# M07 Caller name: direction

Inputs: `01-research.md`, `docs/design/DECISIONS.md` (P4), Law 9, `V11 ¶19`, `¶58`. Route `/(onboarding)/caller`. Shell: none. States: empty / typing / invalid / confirmed.

## Position

M03 (or M05 for under-13s) → **M07** → M08 Meet.

## The one move

As the Caller types, the name appears below the field on a Caller nameplate: a short white-on-black signage band, like a subway station sign, reading the name in `type-station`. That plate is how the name will look in the app. It is UI, not a character speaking (P4).

## Layout

```
 │ ‹                            │
 │ What should your Mon call    │  type-title (ux-writer owns words)
 │ you?                         │
 │ [ Caller name             ×] │  TextField, label visible, clear button
 │ hint: nickname is fine       │  type-caption; under-13 copy recommends a nickname
 │                              │
 │ ██████████████████████████   │  nameplate: signage-black band
 │ █  DANI                    █ │  type-station, signage-white, sentence case as typed
 │ ██████████████████████████   │
 │ [■■■■ Continue ■■■■■■■■■■■■] │  orange CTA, above keyboard
```

The plate uses the name exactly as typed (no forced caps). Long names shrink to `type-title` size, then truncate with the full name in the accessible label.

## States

| State | Treatment |
|---|---|
| empty | plate shows nothing (not a placeholder name; §0A.2 bans "Name Here"); Continue disabled |
| typing | plate updates per keystroke; no animation per character |
| invalid | `ErrorMessage` under the field says which rule failed (length, characters, filtered word) and how to fix it; the plate keeps the text |
| confirmed | Continue → M08; the name is stored locally; under-13 pending consent: stays on the phone until approval (`01-research.md`) |

Profanity filter false positives on real names are a known risk (`01-research.md`); the invalid message must never call a name offensive. Final rules: `ux-writer` and platform.

## Type and colour

`type-title` question, `type-station` plate, `type-caption` hint. Plate: `signage-white` on `signage-black`, 21:1. Field: white face, `concrete-600` edge.

## Motion

Plate appears with `motion-enter` on first character; reduced: instant.

## No-list

- No Mon, no Santoro, no character voice, no "Callah" (P4, Law 9).
- No placeholder name on the plate.
- No real-name request; nickname is fine.
