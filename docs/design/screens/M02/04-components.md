# M02 Welcome: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Carousel | `CardSlider` | `label="Welcome"`, `visibleCount={1}`, `showButtons`, `buttonPosition` bottom, `progressStyle="dots"`, `autoPlay={false}`, `loop={false}` | exists |
| Panel image | `Image` inside `NotchFrame` (corner cut) | `fill`; `alt` describes the block / the three eggs | exist |
| Caption band | `Text` `variant="title"`, `Text` `variant="body"` | `tone="default"` | exist |
| Bloodline captions | `Text` `variant="caption"` `tone="muted"` | | exist |
| Skip | `Button` `variant="ghost"` `size="sm"` | `tone="royal"` | exists |
| Next | `Button` `variant="ghost"` `size="md"` | `tone="royal"` | exists |
| Get started | `Button` `variant="primary"` `size="lg"` | `tone="orange"`: orange face, night label (7.76:1, `CONTRAST.md` "night on orange face") | exists |
| Sign in | `Button` `variant="ghost"` `size="md"` | `tone="royal"` | exists |
| Landmarks | `@acme/ui/primitives` `Main`, `Section` per panel, `Heading level={1}` on panel 1 only | | exist |

## New variants or components

- `CardSlider` needs a `progressPosition="below-content"` (or `progressSlot`) option so the dots sit between the caption and the actions; today the bar sits with the buttons. Variant, with a story `OnboardingPanels`.
- Egg captures (#001, #008, #061) do not exist. `3d-lookdev` owns them; placeholder content is banned in `main` (§0A.2).

## Token diffs

None beyond `docs/DESIGN_SYSTEM.md` (page `concrete-50`, `text` signage black).
