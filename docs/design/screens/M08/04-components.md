# M08 Meeting: components

Inventory checked against `packages/ui` on 2026-10-08 (`ls packages/ui`, `packages/ui/hlynk/index.ts`). No `IncubationRing`, `CareMeterRing`, egg-case or choice-triptych component exists in the kit.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Chrome | `HLynkShell` | `tier="core"`, `scheme` from `schemeForTime`, `status={{ led: 'off' }}`, `reducedMotion`, `trackpad`, `keys`, `testIDPrefix="m08"` | exists |
| Screen | `HLynkScreen` `aspect="3:4"` | `statusRow` | exists |
| Consent pending | `StatusRow` | `items` with the M05 pending item | exists |
| Heading | `Heading level={1}` | | exists |
| Santoro caption | `Text` `type-body` muted | | exists |
| Egg stills | `Image` | `src` and `alt` from `CREATURE_ART` (`@acme/assets/creatures`), `fill`, cover-cropped on the egg (platform confirms the crop prop on Solito `Image`) | exists |
| Three blocks | `ChoiceTriptych` | see below | **missing primitive** |
| Egg card | `Card variant="notch" surface="page"` | `title`, `titleLevel={2}` | exists |
| Dex number | `Text` `type-body-strong`, tabular | | exists |
| Step / back to all / choose | `TrackpadActions` | `onStepBack`, `onActivate`, `onStepForward`, `onCommit` with labels from `05-copy.md` | exists |
| Choose (CTA) | `Button variant="cta" size="lg"` | inside the card | exists (`cta` variant from the M01–M07 kit fixes) |
| Confirm pair | `Button variant="cta"` + `Button variant="outline"` | equal height | exists |
| Announcements | `announcePolitely` (`packages/app/features/onboarding/announce`) | | exists |
| Haptics | `haptics.selection` (flick), `haptics.tap` (activate), `haptics.success` (commit) | | exists |

## Missing primitive: `ChoiceTriptych`

Named, not built. A row of 2–4 equal tiles with no default selection, where focusing a tile grows it to fill its container and the others step aside. M08 is the first user; M16's species mini-game picker and the web /mons page are likely later ones.

| Need | Why no existing component fits |
|---|---|
| Radio-group semantics with no checked item | `SegmentedControl` always has a value; `CardSlider` is a carousel with one card always centred |
| Tile → fill transition anchored to the tile's frame | no kit component measures a child frame and animates to its container |
| Roving focus driven from outside (the trackpad steps it) | `radio-group.ts` has the keyboard model (`nextRadioIndex`, `rovingTabIndex`) but no component |

Proposed contract is in `08-handoff.md`. It reuses `nextRadioIndex` and `rovingTabIndex` from `packages/ui/radio-group.ts`, so arrow keys, Home and End behave as the APG radio group.

## Variants

None new. `Card variant="notch" surface="page"` is used as it ships.

## Token diffs

None. Every pair is already measured in `docs/DESIGN_SYSTEM.md` or `07-a11y.md`.
