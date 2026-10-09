# M09 Naming ceremony: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, `screens/M07/08-handoff.md` (`SignagePlate`, `TextField clearButton`), canon #1, #4, #5, #14; design D8, D10. Route `/(onboarding)/name`. Shell: H-Lynk Core. States: empty / typing / invalid / confirmed, plus saving error, already-named and offline.

## Position

M12 Hatch (`hatched`, after the `attention` phase: the Baby's first look, Decision #14) → **M09** → M13 Home. The brief's "M12 → M13 via a continuity transition" now runs M12 → M09 → M13; the continuity transition belongs to M12 → M09 (`06-critique.md` C1).

## The one move

The Baby fills the H-Lynk screen in the same pose the hatch ended on. As the Caller types, the name appears under the Baby on a black signage band in station type (D10, the same plate that showed the Caller's own name at M07), so the Mon and the name are on screen together like a station and its sign. When the Caller stops typing for a moment, the Baby tilts its head toward the sign: noticing, never judging.

## Scheme

The ceremony is part of the hatch. Decision #4 gives the hatch the dark scheme, so M09 opens in `night` whatever the clock says and hands M13 back to the clock with `motion-scheme` (proposed D18, `06-critique.md`).

## Layout (phone)

Keyboard down (arrival):

```
 ┌ scanner head: LED off (hatched; no egg, no need) ┐
 │ ┌───────────────────────────────────────────────┐│
 │ │  Baby still, full-bleed in the 3:4 screen      ││ squeaklet / kittee-cee / yotito webp
 │ │                                               ││
 │ │  #002 Squeaklet, Hood Ratti Bloodline          ││ type-caption on a night scrim strip
 │ │  Name this Squeaklet                           ││ type-title, h1
 │ │  [ Name                                     ×] ││ TextField, label visible
 │ │  No renaming yet, so take your time.           ││ hint
 │ │  (reserved space: plate appears on 1st letter) ││ SignagePlate, 1 pt silver keyline on night
 │ └───────────────────────────────────────────────┘│
 │  [⌂] [≡]   ┏ trackpad ┓   [‹] [›]                │ trackpad tap = focus field; hold = use name
```

Keyboard up (typing): the shell switches to `layout="compact"` (24 pt head, screen full-bleed). The Baby crops to its upper body at the top of the screen (focal point on the face), then title, field, plate, and "Use this name" pinned above the keyboard, as M07 does. The trackpad row sits under the keyboard; the on-screen button is the confirm.

## States

| State | Treatment |
|---|---|
| empty | no plate (`SignagePlate` renders nothing for `''`; no placeholder name, §0A.2); its space is reserved so the layout doesn't jump on the first letter; Use this name disabled |
| typing | plate updates per keystroke, no per-character animation; head tilt after ≥ 800 ms with no keystroke, at most once per pause |
| invalid | `ErrorMessage` under the field after ≥ 1 s pause or on submit; plate keeps the text; the Baby does not react to the error |
| confirmed | name saved to the `MonInstance`; the plate holds; the Baby gives one `attention` look; `motion-step` → M13 with `motion-scheme` back to the clock |
| saving error | the save write threw; the name stays in the field; retry |
| already-named | `selectActiveMon(...).nickname !== null` on mount: `router.replace` M13 |
| no Mon | `selectActiveMon` undefined: `router.replace` to the boot route (M11 or M08) |
| offline | works; the name syncs with the next server write (`08-handoff.md` B3) |

No skip. A Phase 1 Mon always has a name before Home, because nothing later can add one (proposed D19).

## Type and colour

Night scheme: title #F8F8F8, hint and caption `silver`, field `surface-raised` #0A1230 with `silver` edge. Text that sits over the Baby still sits on a `night` scrim strip at 88% (text never on bare art). Plate: `signage-white` on `signage-black` with the 1 pt `silver` keyline (M07 finding 4). CTA `cta` / `on-cta` (7.76 on night).

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Arrival from M12 | continuity: no cut; the Baby keeps its last hatch pose, the scrim and field rise `motion-enter` | 200 ms fade of the scrim and field; Baby static |
| Head tilt on typing pause | 2D still: 6° rotation about the neck pivot + 4 pt lift, 320 ms in, 400 ms hold, 320 ms out; model: `attention` clip | none |
| Plate first character | `motion-enter` | instant |
| Keyboard up / down | shell compact transition with the keyboard (`KeyboardAwareScroll`) | instant layout swap |
| Confirmed | one `attention` look (2D: a 300 ms tilt toward the plate), then `motion-step` to M13 with `motion-scheme` | cut to M13, scheme cross-fade 200 ms |

The tilt pivot is authored per still (`TODO(lookdev)`); until then it rotates about the image's lower-centre.

## Sound

Slot only: `m09.sound.attention` per bloodline, off until Q32 closes and assets exist. When it ships, it obeys the OS silent switch and never plays per keystroke.

## No-list

- No suggested names, no shuffle (Q17, Law 1).
- No "Ratti" default (Decision #1); no prefill of any kind.
- No pronoun for the Mon (PS-005, Q14).
- No reaction that reads as liking or disliking a name (#14).
- No "You can change this later" until a rename exists.
- No celebration burst on confirm: the hatch was the moment; naming is quiet.
