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

Files: `apps/web/components/home/HLynkSection.tsx` (server), `apps/web/components/DeviceStage.tsx` (client island), `apps/web/components/home/device-scene.ts` (three.js scene, loaded on demand). Copy: `W01_COPY.hlynk`. Art: `hlynk.static`, `hlynk.scanner`, `hlynk.controls`. Decisions: PS-002, PS-004, PS-017, PS-018, PS-019.

- **Layout.**
  - Below `lg`: one column in DOM order, which is the reading order: the ink stage, then the name block, then the two proof rows as a vertical list. No two-column mini grid on phones.
  - From `lg`: 12 columns, `gap-x-12 gap-y-10`. The stage spans columns 1–7 and rows 1–2. The name block sits in columns 8–12 of row 1, aligned to the bottom; the proof list sits in columns 8–12 of row 2, aligned to the top.
  - Section: `max-w-screen-xl`, `py-16` / `md:py-24`, `short:py-8` on a landscape phone.
- **Stage sizing.** The ink plate (`bg-ink-950`, `scheme-dark`) fills its cell; the 4:5 stage box is centred in it and capped:

  | Width | Stage box max width | Plate padding |
  |---|---|---|
  | < 768 | `max-w-sm` (24rem), else the column (326px at 390, 366px at 430) | `px-4 py-8`, `sm:px-8` |
  | 768–1023 | `max-w-sm` (24rem) | `md:py-12` |
  | landscape phone (`short:`, ≤ 30rem tall) | `max-w-44` (11rem, 220px tall box) | `short:py-4` |
  | 1024–1279 | 28rem | `md:py-12` |
  | ≥ 1280 | 32rem | `md:py-12` |

  The canvas fills the box; its drawing buffer is capped at DPR 1.5. The caption sits under the box on ink.
- **Proof rows.** Each row: a 2px `border-ink-950` top rule, `pt-4`, then a 4:3 crop of the render (`w-36`, `lg:w-48`, on `bg-ink-950`) beside an `h3` (`text-lg font-bold`) and one sentence (`text-sm` / `md:text-base`, `text-text-secondary`). Two rows: scanner head, control row. Facts trace to canon Decision #16 only.
- **Tokens.**
  - `h2`: `font-display text-display-lg uppercase leading-heading`, `xl:text-display-xl`. Lede: `text-xl font-semibold text-text`. Body: `text-base`/`md:text-lg`, `text-text-secondary`, `max-w-content-measure`. The bond line: `font-semibold text-text` with a 4px `border-ink-950` rule, the same treatment as World's second line.
  - Scene (`@acme/theme`, no literals): body `hlynk.core.body` (apple-600); head, bezel, keys and trackpad face `hlynk.core.black`; trackpad ring `hlynk.core.ring`; key glyphs `hlynk.core.glyph`, the home glyph and side-key marks `palette.apple[400]`; emitters, lens ring and fan `led.on`, the fan's core `palette.apple[100]`; seams `palette.apple[900]`; lens glass `palette.ink[900]`; screen `hud.*`; lights `signage.white`, `concrete[900]` (ground), `silver[300]` (rim); floor pool `concrete[500]`; contact shadow `signage.black`; studio dome `ink[950]`→`signage.white`.
- **States.**

  | State | What shows |
  |---|---|
  | Server HTML, no JS, before the stage is within 600px | the capture |
  | Canvas mounting and compiling | the capture, on top of the hidden canvas |
  | First full frame drawn | the capture fades out over 400ms (CSS transition) |
  | Intro (≈2.4s of scene time from the first frame) | settle, slow turn, scanner flare, screen on |
  | At rest | still frame, loop paused |
  | Pointer over the stage | loop runs; tilt follows the pointer, at most 8° |
  | Offscreen | loop paused |
  | Reduced motion | the capture only; no canvas is created |
  | No WebGPU or WebGL2 backend | the capture stays; the canvas never reports ready |

- **Motion.** The scene owns the object; the page timeline never transforms the stage (PS-018).

  | Element | Trigger | Animation | Timing | Easing |
  |---|---|---|---|---|
  | H-Lynk (scene) | first frame after compile | drops 0.14 units into place | 0–1.0s | cubic out |
  | H-Lynk (scene) | same | turns 0.42 rad to its three-quarter rest | 0–1.8s | cubic out |
  | Fan and emitters (scene) | same | one flare: fan 0.3→1→0.3, emitter 1.4→3.2→1.4 | 1.0–1.9s | sine |
  | Screen (scene) | same | emissive 0→0.62 | 1.5–2.4s | cubic out |
  | Name block `mfx-hlynk-head` | ScrollTrigger `top 70%`, once | opacity 0→1, y `distance.reveal`→0 | 200ms, `duration.sm` | `ease.out` |
  | Proof rows `mfx-hlynk-proof-0/1` | same timeline | opacity 0→1, y `distance.step`→0 | 1100ms / 1400ms, `duration.xs` | `ease.out` |
  | Pointer tilt (scene) | pointer over the stage | rotation toward pointer, cap `pageMotion.tilt.stage` | exponential, rate 6/s | — |

- **Static capture (asset spec).**
  - `hlynk.static` = `/home/h-lynk-core-v2.png`, 896×1120 (4:5), opaque, background exactly `ink-950` (#00041C) edge to edge so it sits flush in the plate. It is a render of `device-scene.ts` at its rest pose: yaw −0.38 rad, no tilt, fan at 0.3, screen on.
  - `hlynk.scanner` = `/home/h-lynk-scanner.png` and `hlynk.controls` = `/home/h-lynk-controls.png`, 640×480 (4:3) crops of the same render: the scanner head with the antenna and fan, and the control row with the trackpad.
  - All three are decorative (`alt=""` with a reason in `art.ts`): the figure is named "H-Lynk Core" and captioned, and each proof row's text names its part.
  - Regenerating: build and serve the site, open `/` in system Chrome (WebGPU) at 1440×1100 with `deviceScaleFactor: 1.5`, scroll the stage into view, wait for the capture to fade and 4s more for the rest pose, keep the pointer off the stage, hide `#mfx-hlynk-head` and the proof list, set the stage figure to `width: 896px !important; max-width: none !important`, and screenshot the 4:5 box at device scale (1344×1680). Trim 3px each side, resize to 896×1120 with Lanczos, and cut the crops from the 1344-wide render at (290, 20)–(1090, 620) and (290, 1080)–(1090, 1680), resized to 640×480. The Phase 4 script is `tooling/site-qa/out/phase4-after/capture.mjs` (ignored by git; the steps above are complete without it).
  - Give every new render a new file name and update `art.ts`. Image optimisers cache by URL: overwriting `h-lynk-core.png` in place served the old blue capture from `.next/cache/images` during Phase 4.
- **Final-render replacement list.** When the real H-Lynk Core model (`model: 'h-lynk-entry'`) or product photography lands:
  1. `device-scene.ts` `buildDevice`: swap the procedural group for the GLB; keep camera, lights, intro and rest logic.
  2. `hlynk.static`: re-render at the same 4:5, 896×1120 minimum, ink-950 ground, under a new file name.
  3. `hlynk.scanner`, `hlynk.controls`: re-crop from the new render, 4:3, 640×480 minimum.
  4. The backplate tier name, rear camera and rear status light (Decision #16) need a back view; out of scope until a rear angle is wanted.
  5. EngineX: nothing is printed on the front until Q40 is answered.
- **Edge cases.** A long Baby name on the screen: the name is drawn at 96px on a 768px-wide canvas, so about 12 characters fit; past that it needs a smaller size. A slow GPU: the capture stays until the first full frame, however long the compile takes. A WebGPU device loss: `ThreeCanvas` rebuilds on WebGL2; the capture does not reappear during the rebuild.

## STARTERS

Files: `apps/web/components/home/StartersSection.tsx` (server), `PlaceCaption.tsx`, `copy.ts` (`W01_COPY.starters`), `art.ts` (`starter.1|2|3`). Data: `starterCards()` reads `starterBloodlines` and `eggs` from `@acme/content` (Baby node only). Decisions: PS-020, PS-022.

- **Layout.**
  - <768: one column. Head (eyebrow, h2, body naming the three eggs, ruled personhood line), then three posters in slot order. Each poster: art plate 1:1, then the identity plate.
  - 768–1023 (and 844×390): posters lie on their side, stacked. Art plate is half the poster width, `min-h-80`; the identity plate is bottom-aligned on the right with a 2px left rule.
  - ≥1024: three posters side by side (`lg:flex-row`, `flex-1`, `gap-6`), art 4:5, identity plate under it. Section capped at `max-w-screen-xl`, `py-16`/`md:py-24`.
- **Tokens.** h2: `text-display-md` → `lg:text-display-lg` → `xl:text-display-xl`, `leading-heading`. Baby name (h3): `text-display-md` → `xl:text-display-lg`, `break-words`. Dex plate: `bg-ink-950 font-display text-sm text-signage-white`. Egg line: `text-sm font-semibold text-text-secondary`. Bloodline: `font-semibold text-text` with `border-l-4 border-ink-950`. Poster: `border-2 border-ink-950 bg-surface-raised`, square corners.
- **Components.** `List`/`ListItem` (three items), `Article aria-labelledby` the h3, `Figure` > `Image framed={false} fill loading="lazy" contentPosition={artPosition(...)}`. No `PlaceCaption`: the art is a Mon, not a place (PS-028).
- **States.** Static. No hover or focus state, because nothing in the posters is interactive. Images lazy-load with blur placeholders inside fixed boxes. Reduced motion: final composition.
- **Motion.** `w01.starters.enter`: head, then posters 0/1/2 at 160/300/440 ms (unchanged targets `mfx-starters-head`, `mfx-starter-0..2`). Transform and opacity only.
- **Canon.** Every string on a poster is from `@acme/content` or the `copy.dex`/`copy.hatchesFrom` formatters: Squeaklet No. 002 / Hood Ratti Bloodline / Metro Egg; Kittee Cee No. 009 / Bodega Baddiee Cee Bloodline / Corner Egg; Yotito No. 062 / Yote Bloodline / Prism Egg. No Small, Mid or Max name is read.
- **Art slots (filled 2026-10-07, PS-028).** Generated concept art from `@acme/assets/creatures`, made with Figma `generate_image` (model `gpt-image-2.5-sunburst`) on 2026-10-07. Each Baby stands on its Bloodline's home turf. Alt names the Baby form and describes it without a pronoun (PS-005). No caption.

| Slot | Today | File | Size | Focal point | Final asset still wanted |
|---|---|---|---|---|---|
| `starter.1` | Squeaklet on a Harlem brownstone stoop | `creatures/squeaklet.webp` | 960×1200, 164,962 B | (0.5, 0.3), the face | Final render, 4:5 master ≥ 1040×1300 |
| `starter.2` | Kittee Cee on a 125th St bodega step | `creatures/kittee-cee.webp` | 960×1200, 137,220 B | (0.5, 0.28) | same |
| `starter.3` | Yotito on a Times Square sidewalk | `creatures/yotito.webp` | 960×1200, 125,432 B | (0.55, 0.33) | same |

The masters are below the 1040×1300 minimum because the model returns 960×1280 at most; they were cropped to 4:5. Each reads at 1:1 (phone), side-on at `md` and 4:5 at `lg`, with the Mon in the centre 60%. To replace one, save the new file under a new name and point the `@acme/assets/creatures` entry at it; optimisers cache by URL. If renders arrive as transparent cut-outs, composite them on street plates first; the frame has no background of its own.

The three egg images (`metro-egg.webp`, `corner-egg.webp`, `prism-egg.webp`, 960×1200 each) are bundled but not rendered on `/`: the poster already names the egg, and a second picture per poster competes with the Mon at the phone crop (PS-028).

## CARE

Files: `apps/web/components/home/CareSection.tsx` (server, no client code), `copy.ts` (`W01_COPY.care`). Decision: PS-021.

- **Layout.**
  - <768: head, then three rows, each stacked: verb, "Your Mon:" cue, "You:" answer, meter name, meter full width. Then the closing line and the example note.
  - ≥768: each row is a 12-column grid aligned to the bottom: verb 4 columns, cue and answer 5, meter 3 (from `lg`: 5 / 4 / 3). Rows are separated by 2px ink rules, with a closing rule under the last row. The closing line and example note share one row (`justify-between`).
- **Tokens.** h2 as STARTERS. Verb (h3): `text-display-lg` → `lg:text-display-2xl`, `leading-display`. Cue: `text-base text-text`; answer: `text-text-secondary` with a `font-semibold text-text` "You:" label. Meter name: `text-sm font-semibold text-text`. Closing: `font-display text-lg md:text-xl uppercase text-orange-700` (large text on concrete). Example note: `text-sm text-text-muted`.
- **Components.** `CareMeter` (local): a `View role="meter"` with `aria-label={copy.meterLabel(meter)}`, `aria-valuemin/max/now` and `aria-valuetext`, and ten `h-5` lots. Lots up to the level are solid at the 700 step (orange / royal / leaf); lots above are hollow 2px `border-ink-950`, so filled versus empty reads without colour. No on-screen percentage. The kit `ProgressBar` is not used here: it imports Reanimated, and CARE was the only Reanimated path on `/` (64 KiB).
- **States.** Static values (70 / 45 / 85), labelled as examples. No low-level warning colour exists; the page never reads a user's Mon. Reduced motion: final values from first paint (the meter is static server markup; there is no count-up).
- **Motion.** `w01.care.enter`: head, then the stage at 160 ms (`mfx-care-head`, `mfx-care-readout`, unchanged). Meters don't animate separately and never pulse.
- **Art slot `care`.** Reserved, not rendered. Final: one Mon reaction image (a Baby leaning in), 4:5 master ≥ 1100×1375, opaque, face at (0.5, 0.4). When it lands, CARE becomes the audit §11 bento: the image dominant over two rows, the three verb rows beside it (≤ 4 modules), DOM order image → rows.

## HATCH

Files: `apps/web/components/home/HatchBand.tsx` (server, no client code), `copy.ts` (`W01_COPY.hatch`), `art.ts` (`hatch` slot). Decision: PS-024.

- **Layout** (one column at every width, max 80rem): eyebrow and headline; a wide window onto the city at night; then the story and the closing line. From `md` the closing line sits left (5 of 11 parts) and the two story paragraphs right (6 parts); DOM order is story then closing line, so phones read the story first.
- **Headline.** Two lines from `copy.hatch.title`: "Pick a time." in `ink-50`, "The egg waits." in `orange-500`. `font-display uppercase`, `text-display-lg` → `md:text-display-xl` → `lg:text-display-2xl`, `leading-display`. The largest section headline on the page (the hero H1 is the only larger type).
- **Window.** `Figure`, no border, `bg-ink-900` while loading. Aspect 4:5 (<640), 3:2 (640–767), 21:9 (≥768). `Image fill framed={false}`, lazy, blur placeholder, `contentPosition` from the slot's focal point (0.7, 0.56: the egg). `PlaceCaption` renders nothing, because the art has no caption (PS-028).
- **Story.** `text-lg leading-8`, `ink-50` then `silver-300`, `max-w-content-measure`. Closing line `font-display uppercase text-2xl → md:text-3xl → lg:text-4xl`, `ink-50`.
- **Surface.** `bg-ink-950` in both schemes, 4px `orange-500` rule along the top. No gradient, glow, border or pulse is added: the crack light in the egg is the band's one warm light.
- **No button.** The waitlist directly below carries the one action (PS-023).
- **Motion.** `w01.hatch.reveal` (unchanged): window opacity + scale from `S.enter` over `D.xl`, headline at 320 ms, closing line at 640 ms. That is the band's one moment. Reduced motion: everything at rest from first paint (`mfx-hatch-*` at opacity 1, checked in the shot run).
- **Art slot `hatch` (filled 2026-10-07, PS-028).** `creatures/hatch-night.webp`, 1536×1024 (3:2), 91,464 B, generated with Figma `generate_image` (`gpt-image-2.5-sunburst`): one egg in an open single-egg case on the bottom step of a Harlem stoop at night, lit only by the orange crack in its shell, the bridge and skyline out of focus on the dark left half. One file serves every aspect; the 4:5 and 21:9 crops come from the focal point. It is below the final size below, and there is no `mobileSrc` yet.
- **Art slot `hatch` (final art spec).** The egg at night: one egg in its case on a stoop or sill at street level, mostly in shadow, lit low from one warm source (the egg's own crack light or a street lamp), the city out of focus behind. 21:9 master ≥ 2560×1097 plus a 4:5 phone crop ≥ 1080×1350 (`mobileSrc`), opaque WebP, egg at (0.62, 0.6), headroom dark enough for nothing to sit on it. No Mon visible and no hatch result: the page stops before the reveal. A later swap may be a short hatch loop (muted, `playsInline`, poster = the still, paused under reduced motion and offscreen); the slot's box and aspect stay, so no layout change.

## WAITLIST

Files: `apps/web/components/home/WaitlistSection.tsx` (server), `apps/web/components/waitlist/WaitlistForm.tsx` (client island), `apps/web/components/waitlist/copy.ts` (every string + `waitlistMessage`), `apps/web/components/get/GetPage.tsx` (`/get`, source `get`). Backend: `app/(site)/get/actions.ts` `joinWaitlistAction`, `lib/waitlist.ts`. Decisions: PS-001, PS-023.

- **Layout, home.** Daylight `bg-bg`. <768: head (eyebrow, h2, one sentence) then the form, full width. ≥768: head 5 parts left, form 6 parts right, top-aligned. h2 `text-display-md` → `lg:text-display-lg`, `leading-heading`, uppercase.
- **Form** (`max-w-xl`, `gap-6`): Email label (visible, `font-display uppercase`), input `h-14` (56px) full width, `border-2 border-text`, `bg-surface-raised`, `text-lg font-semibold`; Age fieldset with legend "Age", a 24px native checkbox (`accent-orange-600`) labelled "I'm 13 or older" and the hint "Younger than 13? A parent or guardian can join with their own email and follow along."; the submit button; the live result line; the privacy line with a link to `/legal/privacy`.
- **Button.** Real `<button type="submit">` around `CornerCutFrame` (orange face, 4px depth, `min-h-14`). Full width below 640px, intrinsic from `sm`. Label `Join the waitlist`; pending `Joining…`.
- **Fields sent:** `email` (type email, `autocomplete=email`, `inputmode=email`, no autocapitalize/autocorrect/spellcheck, `maxlength=254`, required), `ageConfirmed` (checkbox, required), `district` (hidden, from `useDistrictStore`; the hero picker's value, `midtown` when untouched), `source` (`home` | `get`), `website` (honeypot: off-screen, `aria-hidden`, `tabindex=-1`, `autocomplete=off`).

| State | Trigger | What shows | Focus | Announced by |
|---|---|---|---|---|
| idle | first load | the form | none | — |
| pending | submit | button "Joining…", disabled; `aria-busy` on the form | (button disabled) | button text |
| joined | 200 `joined` (new or repeat email, or a bot) | form replaced: green 4px rule, h3 "You're on the list.", "We'll send one email when NYC-MON is out. Signed up before? Nothing changes, and you'll still get just the one." | the h3 (`tabindex=-1`), body via `aria-describedby` | focus |
| under13 | 422 | "Nothing was saved. You need to be 13 or older to join. A parent or guardian can sign up with their own email and follow along with you." Email cleared, box unticked | submit button | `<output>` |
| invalid | 400 | field border `danger`, error under the field: "Check the email address. It should look like name@example.com." Email and box kept | email field (`aria-invalid`, `aria-describedby` → error) | focus + description |
| rate_limited | 429 | "Too many tries from this connection. Try again in an hour. Your email is still in the box." (semibold `danger`) | submit button | `<output>` |
| error | 5xx, timeout, network, `ADMIN_API_URL` unset | "We couldn't reach the waitlist just now. Nothing you typed is lost, so try again in a moment." Retry is the same button | submit button | `<output>` |

- **Without JavaScript** the same form posts to the server action and the page renders the result state (checked: joined and invalid with JS off).
- **Env (Phase 7 deploy checklist):** `ADMIN_API_URL` (server only, admin-vite base URL), `WAITLIST_FORWARD_SECRET` (server only, shared with admin-vite so it rate-limits per visitor). Emails are stored in the Payload `waitlist` collection behind `POST /v1/waitlist` in admin-vite. Without `ADMIN_API_URL` every submit shows the error state; nothing pretends to succeed.
- **Never:** counts, countdowns, "spots left", social proof, a second email field in the footer.

## FOOTER

Files: `apps/web/components/site/SiteChrome.tsx` (`SiteFooterBar`), `packages/ui/nav/SiteFooter.tsx`. Decision: PS-025.

- `variant="columns"`, `mark="badge"`, `district="harlem"`, `scene="skyline"`: the Harlem `SkylineBand` (plain views, `h-12 md:h-16`), the district keyline, then the badge, tagline, description and the two link columns.
- Link targets: `min-h-11` (44px) below `md`, `min-h-6` (24px) from `md` (was `md:min-h-0`, 20px; A11Y F10).
- `RiverTide` is now `React.lazy` inside `SiteFooter`, so a footer with `scene="skyline"` or `"none"` ships none of the canvas code. Other callers that keep `river-tide` get it after `LazyScene` mounts, as before.
