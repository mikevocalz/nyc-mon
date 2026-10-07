# Premium site handoff: W01 home

One section per page section, filled by the phase that builds it. Each spec is what a designer or engineer needs to rebuild or re-art the section without the prompt pack. Tokens are `packages/theme` names, never values.

Template per section:

- **Layout:** per breakpoint (390, 768, 1024, 1440), grid columns, order.
- **Tokens:** type steps, colours, space, content widths, motion tokens.
- **Components and props:** kit components used, with the props that matter.
- **States:** default, hover/focus, reduced motion, loading (canvas), empty or error where they exist.
- **Motion:** purpose, trigger, tokens, reduced-motion equivalent.
- **Art slots:** slot id, aspect, minimum pixel size, focal point, transparency, alt owner, final asset needed.

## HERO

Files: `apps/web/components/home/HomeHero.tsx` (server), `HeroDistrictIsland.tsx` (client: `HeroCity`, `HeroDistrictPicker`), `PlaceCaption.tsx`, `copy.ts` (`W01_COPY.hero`), `art.ts` (`hero`).

- **Layout.**
  - 390–767: one column in DOM order. The headline is four signage plates ("Every", "block", "has a", "legend."), then the support line on a concrete plate, the CTA, the district control, and the photograph (4:3) with the seal over its lower-left corner. The H1, support line and CTA end at about 608px on a 390×844 view.
  - 768–1023: one column. Two headline plates, the second indented `ml-16`; the photograph is 16:9.
  - ≥1024: 12-column grid. Copy is 8 columns, the photograph 4 columns (4:5, capped at `content-hero-art`), and the seal overhangs the poster's left edge into the gutter. Section min height is `min-h-hero-wide`.
  - Landscape phone (`short:` = landscape and max-height 30rem): 7/5 grid, a 40px wordmark, headline at `display-hero-short`, the photo capped at `max-w-56`, and the caption hidden. The H1, support line and CTA all fit in the 844×390 first view.
- **Tokens.** Headline: `font-display`, `text-display-hero` (2.75rem) → `md:text-display-2xl` → `lg:text-display-xl` → `xl:text-display-2xl`, with `leading-display` pinned at every step. Plates use `bg-signage-black` and `text-signage-white`. Support line: `bg-surface-raised`, `text-text`, `border-ink-950` left rule, `max-w-content-measure`. District control: `bg-ink-950` plate with a `text-silver-100` legend. Section placeholder: `brand.night`.
- **Components and props.** `HeroCity` (`id="trg-hero"`, className) wraps `SceneSection` → `CityBlocks` (`district` from `useDistrictStore`, `overlay`, `paused`). `LinkButton variant="cta" size="lg"`, from `WAITLIST_CTA`. `Image fill priority loading="eager" fetchPriority="high" contentPosition={artPosition(...)}`. `BrandLogo size={240}`, scaled with CSS (50% / 75% / 100% / 40% short). `SegmentedControl` in a `Fieldset` + `Legend`.
- **States.** Default: server HTML, canvas placeholder colour. Canvas loading: placeholder only, no layout change. District change: the canvas redraws and the radio group moves its checked state; the copy is unchanged. Focus: the kit's focus ring on the CTA and radios. Reduced motion: final composition and no entrance; the canvas draws its still frame.
- **Motion.** `w01.hero.enter` (see PREMIUM_SITE_MOTION §3). Transform-only. Skipped when hydration binds after 1.8s.
- **Art slot `hero`.** Today: `midtown-chrysler-spire` (1200×800 WebP), focal point (0.5, 0.3). Final asset: NYC-MON key art, 4:5 master at least 1260×1575 for the desktop poster, plus a 4:3 phone crop at least 1170×878 and a 16:9 tablet crop; no text in the image; leave the lower-left 30% clear for the seal. `sizes`: `(min-width: 64rem) 26.25rem, 100vw`. Alt is owned by the art map.

## SIGNAGE

File: `apps/web/components/home/SignageBoard.tsx` (server). Data: `DISTRICT_COPY[d].name` and `.streets` (`packages/spatial/homeCopy.ts`), `DISTRICT_TONE`/`TONE_CLASSES` for the discs.

- **Layout.** Full-bleed `bg-signage-black` band, content capped at `max-w-screen-xl`. Below `lg`: a vertical stop list, with the route line running down the left through the disc centres. From `lg`: four equal columns, with the route line across the top. Order is Harlem, Midtown, Downtown, Mega City (route order, not store order).
- **Tokens.** `h2` uses `text-base font-semibold text-silver-200`. Name: `font-display text-display-board uppercase text-signage-white`. Annotation: `text-sm text-silver-200`. Disc: `h-6 w-6 rounded-full`, the district tone's `face`, with a 2px `border-signage-black` ring. Route line: `bg-silver-500`, 4px.
- **Components.** `Section`, `Heading level={2}`, `List`, `ListItem`, `Text` from `@acme/ui/html`. Not `SignagePlate`/`SignageBand` (PS-014).
- **States.** Static. There's no hover or focus because nothing on the board is interactive.
- **Motion.** None, in both modes.
- **Art.** None.

## WORLD

Files: `apps/web/components/home/WorldSection.tsx`, `PlaceCaption.tsx` (server). Copy: `W01_COPY.world`. Art: `WORLD_SLOTS` = `world.primary`, `world.secondary`.

- **Layout.**
  - <768: one column in DOM order: primary photo (4:5), story, secondary photo (3:2).
  - ≥768: 12 columns, `gap-x-8 gap-y-8`. The primary spans columns 1–7 and rows 1–2, and its height follows the right column. The story sits in columns 8–12 of row 1, aligned to the bottom. The secondary sits in columns 8–12 of row 2.
  - The section is capped at `max-w-screen-xl`, with `py-16` / `md:py-24`.
- **Tokens.** `h2`: `text-display-md` → `lg:text-display-lg` → `xl:text-display-xl` with `leading-heading`. Body: `text-base`/`md:text-lg`, `text-text-secondary`, `max-w-content-measure`. The second line is `font-semibold text-text` with a 4px `border-ink-950` rule. Frames: `border-2 border-ink-950 bg-ink-900`. Captions are `PlaceCaption`: `bg-signage-black`, `text-sm font-semibold text-signage-white`, and a 14px district disc.
- **Components.** `Figure` > drift layer (`mpx-world-a|b`, absolutely positioned with `top`/`bottom` = `-parallax.max%`) > `Image framed={false} fill loading="lazy" contentPosition`.
- **States.** Images lazy-load with blur placeholders inside fixed boxes. Reduced motion: no drift, and the story is visible from the start.
- **Motion.** `w01.world.enter` (the story resolves once) and `w01.world.drift` (desktop only, two rates). Mobile uses native scroll only.
- **Art slots.**
  - `world.primary`: today `harlem-lenox-rowhouses`, focal point (0.45, 0.55). Final: a street-level district photo with a Mon placed in it, 4:5 master at least 1100×1375, safe area in the centre 60%.
  - `world.secondary`: today `downtown-nyse`. Final: 3:2, at least 1100×733.
  - `world.detail`: reserved for a Mon-in-district tile (PS-015).
  - `sizes` come from `gridSizes(cols)`: `(min-width: 80rem) 47rem|33rem, (min-width: 48rem) 58vw|42vw, 100vw`.

## H-LYNK

_Filled in its phase._

## STARTERS

_Filled in its phase._

## CARE

_Filled in its phase._

## HATCH

_Filled in its phase._

## WAITLIST

_Filled in its phase._

## FOOTER

_Filled in its phase._
