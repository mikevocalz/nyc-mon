# W01 Home: direction

Skill: `frontend-design:frontend-design`. Spec: `prompts/BUILD_PROMPT_v3.md` §5 W01 row and the "Web hero canvas" paragraph, treated as requirements.

## Mike's direction (2026-10-04) and how it fits the spec

> "I love the logo on the right for home but it needs work. Leave the Mega City (district) options."

- **Keep:** the NYC-MON seal on the right of the hero, unedited and never recoloured; the district selector (Downtown, Midtown, Harlem, Mega City), which keeps driving the city behind the hero.
- **Conflict:** §5 puts the 3D H-Lynk on the right of the hero. Mike's call wins there. The seal stays on the right, and `DeviceStage` gets its own section directly below the hero, before the starters. It renders the **H-Lynk Core** (Decision #16): red body, black scanner head, red fan. Recorded as D12 in `docs/design/DECISIONS.md`.

## Page order

```
NavBar (kit, shared)                                        [daylit page]
┌ Hero: SceneSection, CityBlocks for the picked district ───────────────┐
│ ┌ daylit plate ─────────────────────┐            ┌──────────────┐    │
│ │ h1 EVERY BLOCK HAS A LEGEND.      │            │  NYC-MON     │    │
│ │ support line (canon)              │            │  seal        │    │
│ │ [Join the waitlist]  (cta)        │            │  (BrandLogo) │    │
│ │ Squeaklet  Kittee Cee  Yotito (ul)│            └──────────────┘    │
│ │ District: [Downtown|Midtown|...]  │                                │
│ └───────────────────────────────────┘                                │
└───────────────────────────────────────────────────────────────────────┘
SkylineDivider (picked district)
H-Lynk Core: h2 + two lines left, DeviceStage figure right
Starters: h2 + line, three cards (egg name, Baby name, Bloodline)
SkylineDivider (another seed)
How care works: three meters, three verbs
Hatch band: the one dark band (scheme-dark)
SiteFooter (kit, shared; Harlem RiverTide)
```

At 390 everything stacks: plate, then the seal at 208 px. At 768 and the 884 fold the hero goes two-column. 1280 and 1440 cap the content at `max-w-screen-xl`.

## Type

Archivo Black (`font-display`) for the h1 and the h2s; Space Grotesk for everything else. Two families, as `docs/DESIGN_SYSTEM.md` sets. The h1 is the only uppercase line on the page: §5 writes the slogan in capitals and the seal prints it that way. The DOM text stays sentence case ("Every block has a legend.") and CSS uppercases it, so screen readers don't spell it out.

## Colour

Daylit by default (Decision #4). The hero's text sits on a page-coloured plate over the city, so the first screen reads daylit even though the city map is a night render. Orange is spent on the CTA only (Decision #7). Red belongs to the H-Lynk. The hatch band is night, with the hatch orange as its single accent.

## The one move

The seal and the H-Lynk Core both carry the brand, so the page gives each a frame of its own: the seal over the live city, then the red handheld turning slowly in a quiet band. Everything else is plain type on the page colour.

## Motion

- City: the kit's CityBlocks traffic, paused offscreen, stopped under reduced motion.
- DeviceStage: slow idle yaw, pointer tilt of 8° or less, paused offscreen, mounted after LCP. Reduced motion shows the static capture.
- No entrance animations on sections.

## No-list

- No runtime/backend cards, no district cards repeating the selector.
- No numbering on the care meters (they are not a sequence).
- No Small, Mid or Max forms anywhere.
- No store badges until a listing exists.
- No orange text on blue, no white on orange.
