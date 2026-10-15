# Mobbin addendum, 2026-10

This file extends `docs/design/site/PREMIUM_SITE_REFERENCES.md` (the 36-card
Phase 1 study). It does not repeat any card from that file: every `mobbin_url`
below was checked against the IDs already cited there and none overlap. The
same binding constraints apply: daylit concrete and signage black by default,
blue/orange accents, Archivo Black + Space Grotesk only, no glass, no
gradients, no SaaS cards, glow only as a physical light, canon terms exact
(H-Lynk, H-Lynk Core, Caller, Mon, Dex ID).

## Method

All references came from `mcp__Mobbin__search_sections` calls made in this
session (`output_destination: code`, task intent "Research premium
game-franchise website sections for the NYC-MON site redesign"). Each preview
image was looked at before its card was written. The high-res `image_url`
for each pick was downloaded into `docs/design/site/research/mobbin-2026-10/`
(1920 px wide WebP). Two downloads were opened again to confirm they match
the preview.

Queries (limit 8 unless noted):

1. game launch hero with key art character illustration and waitlist email signup
2. character roster section with cards for each creature to choose a starter companion
3. hardware device showcase section with product photo and feature callouts labelling its parts
4. behind the scenes development process section showing sketches, prototypes and craft of the team
5. waitlist email signup section with short privacy note under the email field
6. city map section where you pick a district or location to see what is there
7. editorial story section with very large typography beside full-bleed documentary photography
8. Lightship hero section with illustrated world and large title
9. basement.studio section with bold typography and 3D game-like visuals
10. Lightship electric travel trailer product section (limit 10, pages 1 and 2)

### Candidate sections

- **basement.studio `28a88d90-f813-478b-bb89-336dbe1e48a0`**: found (query 9,
  first result) and carded below as #14. Verdict: **partial**. Use it as a
  night or hatch mood reference only, not as a home-page section.
- **Lightship `a5fa6838-ff45-42cc-8e90-b513fd69a5e7`**: **not found**. Three
  Lightship-targeted queries (8, and 10 across two pages) returned 17 distinct
  Lightship sections, but not this ID. It has still not been seen, as the
  Phase 1 file also recorded, so there is no verdict on it. Three other Lightship
  sections from those results are carded instead (#4, #6, #13). A browser
  pass on the URL is still needed.

Image sizes: all files are under 400 KB except `oatly-story-index.webp`, which
is 402,900 bytes (about 3 KB over). It was kept as is.

---

## Cards

### 1. Grail — totem chapter with a named-option row
- **Site:** Grail
- **mobbin_url:** https://mobbin.com/sites/sections/9e7a7979-7e17-44e9-8d28-eb515b45450b
- **Local image:** `docs/design/site/research/mobbin-2026-10/grail-totem-chapter.webp`
- **What I saw:** A near-black field with a bronze 3D duck in a knight's helmet and armour at the centre. "DUCK THE KNIGHT" is set in huge white high-contrast serif capitals, and the figure overlaps the letters so the type sits partly behind it. "Chapter 05" and a large "(1)" sit top right. "About Totems" has a three-line wry bio top left. Bottom left reads "SIX TOTEMS. ONE'S YOURS." Bottom right has a short paragraph ("You pick one when you start. It levels up as you do…") above a row of pill chips (Duck, active in pink; Cat, Bear, Rat, Frog, Penguin) and a "Join Waitlist" pill.
- **Transferable pattern:** One character at a time fills the frame, and a compact row of named chips swaps which one is shown. The selector is small and the creature is huge, with the waitlist CTA placed next to the chips.
- **Fit for NYC-MON:** **yes**. It is the closest thing in Mobbin to a "choose your starter" moment on a marketing page, and it keeps the starters out of a card grid.
- **NYC-Tron translation:** Use daylit concrete in place of the black void. The Mon name is set in Archivo Black and passes behind the baby-form Mon, like a station name painted on a wall behind a figure. The chips become MTA route-bullet circles (one letter or Dex ID number each), with the active one filled in signage black. "Chapter 05" becomes a platform-style index ("01 / 03"). There is one `Join the waitlist` button and no pink.
- **Target section:** starters (secondary: hero)

### 2. Berd — agent trading cards with a numbered spec strip
- **Site:** Berd
- **mobbin_url:** https://mobbin.com/sites/sections/46db817d-12e1-4e7f-afd0-e802294027f3
- **Local image:** `docs/design/site/research/mobbin-2026-10/berd-agent-cards.webp`
- **What I saw:** A light grey dotted field. On the left, a small mono eyebrow "INTRODUCING BERD AGENTS" sits above "Give them a role and watch them work" and a short paragraph. On the right, three tall cards are fanned, with the centre card forward. That card has a "BERD AGENT" label and "0001" in the header, a photographed black vinyl toy figure, the name "Berdy", one line of description, and a two-column footer: "Good for:" and "Vibes:". Behind it are "Wildcard" (blue jelly figure) and a stone figure.
- **Transferable pattern:** A fanned stack of collectible cards where the front card is fully legible and the others peek out. Each card has a catalogue number, a physical-object photo, a name, and exactly two labelled traits.
- **Fit for NYC-MON:** **yes**. The "Good for / Vibes" pair maps directly to a Mon's temperament and role, and the catalogue number maps to a Dex ID.
- **NYC-Tron translation:** Each card is a matte paper "transit notice". The Dex ID sits top right in Space Grotesk tabular figures, and a route-bullet badge sits top left. The Mon is shown on concrete grey. Two labelled facts sit under a black rule ("Home turf:", "Temperament:"). The cards are fanned with real paper shadows, with no glass or gradient. The stack never becomes a 3×N grid.
- **Target section:** starters

### 3. Telepathic Instruments — one part lit, one label, waitlist pinned
- **Site:** Telepathic Instruments
- **mobbin_url:** https://mobbin.com/sites/sections/e19b1448-2e4b-4614-b64d-9f2cda0540c5
- **Local image:** `docs/design/site/research/mobbin-2026-10/telepathic-instruments-part-spotlight.webp`
- **What I saw:** A black field. An orange top ticker repeats "ORCHIDS ARE SOLD OUT. HOLIDAY RESTOCK COMING NOVEMBER." in mono caps. A gold-and-grey synth keyboard is shown at a three-quarter angle, and only its keys are lit bright white. To the right is a single label, "Keyboard", with one sentence: "A single-octave, velocity-sensitive keyboard, used to determine the root note of chords." Bottom right has a lime "WAITLIST →" button with "CURRENTLY OUT OF STOCK" under it.
- **Transferable pattern:** A scroll-driven part spotlight. The device stays put while one region at a time is lit and gets a single title and sentence. The waitlist control stays pinned in a corner the whole time.
- **Fit for NYC-MON:** **yes**. It is the most direct model for walking through the H-Lynk part by part without a spec table.
- **NYC-Tron translation:** Show the H-Lynk on daylit concrete. The "lit" region is a physical highlight, a hard sunlight patch rather than a glow, on the H-Lynk Core, the strap and the screen in turn. The label is set in Space Grotesk with a thin black leader line, like a station diagram callout. The ticker becomes a black signage strip ("H-LYNK · CALLER DEVICE · WAITLIST OPEN") with one orange accent. The pinned control is our standard black `Join the waitlist` button.
- **Target section:** H-Lynk

### 4. Lightship — hotspot configurator with view tabs
- **Site:** Lightship
- **mobbin_url:** https://mobbin.com/sites/sections/2c2af3e7-b4ea-4f46-bc5e-deb7195e6760
- **Local image:** `docs/design/site/research/mobbin-2026-10/lightship-hotspot-configurator.webp`
- **What I saw:** A full-bleed render of a white-and-black travel trailer in front of sunlit boulders and dry grass. A segmented control at top centre reads "Exterior / Interior / Floor Plan". Four soft red dots sit on the trailer body as tappable hotspots. A bottom bar has "360 view", a "Camp Mode / Road Mode" toggle, and three colour swatches (ShadeMoss, GraniteBraun, SnowLine).
- **Transferable pattern:** Hotspots placed on the object open detail in place. A top tab set changes the viewpoint and a bottom bar changes the object's state (mode and finish), so the object is explored rather than read about.
- **Fit for NYC-MON:** **partial**. The hotspot and state-toggle mechanic fits H-Lynk well. The colour picker and the "build your own" commerce framing do not, because we sell nothing yet.
- **NYC-Tron translation:** The H-Lynk is photographed on a real sidewalk. Hotspots are small black circles with an orange centre, styled as signage numbers (1, 2, 3) rather than red glows. The view tabs read "Device / In hand / On the street". The state toggle becomes "Day / Night" and shows the H-Lynk screen in both lights. There are no swatches.
- **Target section:** H-Lynk

### 5. Rains — garment with four short callouts
- **Site:** Rains
- **mobbin_url:** https://mobbin.com/sites/sections/0c9ca7d4-3523-44f2-93cf-ee3137acc9d7
- **Local image:** `docs/design/site/research/mobbin-2026-10/rains-jacket-callouts.webp`
- **What I saw:** A brown hooded rain jacket, cut out and shown in profile on pure white, with water droplets on the fabric and a white play-triangle overlay in the middle. Four callouts sit directly on or beside the garment, each with a tiny grey category word above a two-line bold label: "Hood with builtin cap and drawstring", "Vents for underarms and back", "Two side pockets with snaps", and "Welded seams for reliable protection".
- **Transferable pattern:** Callouts are set right on the object with no leader lines or boxes. Each is two levels only: a tiny category word and a two-line plain-language benefit.
- **Fit for NYC-MON:** **yes**. It is cheap to build, works at phone width if the callouts stack below, and keeps the device as the hero.
- **NYC-Tron translation:** The H-Lynk is shown large on light concrete. Four Space Grotesk callouts each carry a tiny uppercase category in signage-blue ("BOND", "SIGNAL", "BUILD", "POWER") and a two-line bold benefit in black. On mobile the callouts drop into a numbered list under the image.
- **Target section:** H-Lynk

### 6. Lightship — "Quiet Comes Standard" system flow
- **Site:** Lightship
- **mobbin_url:** https://mobbin.com/sites/sections/c92cdd16-60d4-43f7-a711-3eb878c100f4
- **Local image:** `docs/design/site/research/mobbin-2026-10/lightship-system-flow.webp`
- **What I saw:** A warm off-white field with a faint plus-sign grid and a blurred sunburst behind. A small "CampQuiet" eyebrow sits above "Quiet Comes Standard" in large black sans. Below, a dotted vertical line winds downward, linking circular icon nodes: a green sun node, then a black lightning node. Cards alternate left and right off the line. "Topped off by the Sun" has one sentence and a photo of rooftop solar. "Stored for Later" has one sentence and a photo of the battery bay.
- **Transferable pattern:** A vertical "how it works" route. One dotted line, one icon node per stage, and cards that alternate sides, each with a title, a single sentence and a real photo.
- **Fit for NYC-MON:** **yes**. A route line with stops is already subway grammar. It explains the Caller → H-Lynk → Mon bond without a diagram.
- **NYC-Tron translation:** The dotted line becomes a solid route line in signage blue, and the nodes become station dots (filled black for the current stop, outlined for the others). The stops are "Caller", "H-Lynk", "H-Lynk Core", and "Mon". Each card is a station-name plate (Archivo Black name, one Space Grotesk sentence, one daylit photo). Drop the sunburst and the plus grid, and use plain concrete.
- **Target section:** H-Lynk (secondary: story)

### 7. Seasats — one product, named variant switcher
- **Site:** Seasats
- **mobbin_url:** https://mobbin.com/sites/sections/abc41262-70e1-4283-ae05-042da35931cc
- **Local image:** `docs/design/site/research/mobbin-2026-10/seasats-model-switcher.webp`
- **What I saw:** A pale mint-to-cream field. "Lightfish" is set in large thin serif top left, with a four-line description top right. An autonomous boat, with an antenna mast and a dome sensor, is shown in side profile and fills the centre. A small three-tab switcher at bottom centre shows a tiny silhouette for each tab: LIGHTFISH (active), QUICKFISH, HEAVYFISH.
- **Transferable pattern:** A variant switcher that uses each variant's silhouette as its tab icon. The large object and the title swap in place, and the layout does not move.
- **Fit for NYC-MON:** **partial**. The silhouette tabs suit three starters. The pastel field and the thin serif are off-brand.
- **NYC-Tron translation:** Three starter Mons, each with a black silhouette tab set on a route-bullet-sized chip. Selecting one swaps the full-size Mon render and the Archivo Black name. The field is concrete. The description sits top right like a platform sign's "service notes". This can be the mobile fallback for card #1.
- **Target section:** starters

### 8. KÖPPEN — dated prototype filmstrip
- **Site:** KÖPPEN
- **mobbin_url:** https://mobbin.com/sites/sections/a50e0b6f-4565-45ae-a5f0-64b2b5ea09e6
- **Local image:** `docs/design/site/research/mobbin-2026-10/koppen-prototype-filmstrip.webp`
- **What I saw:** A cream page. A large left photo shows a hand bending strips of wood veneer on a workbench, captioned "Early prototypes of our first product". To the right, a bottom-aligned filmstrip of seven small thumbnails is each labelled with a year (2023, 2024, 2024, 2025, 2025, 2025, 2026): a sketch, an oil bottle, a cast part, sample cups, gloved hands with a bottle, and a final product shot. "1 / 12" and "NEXT" sit top right.
- **Transferable pattern:** Proof of craft told as a dated timeline of raw process photos. One big current image is backed by a strip of small, year-stamped steps that ends at the finished thing.
- **Fit for NYC-MON:** **yes**. It shows real development progress (sketches, whitebox, renders, H-Lynk mockups) without overclaiming, and the dates make it honest.
- **NYC-Tron translation:** Show real NYC-MON work artifacts: Mon sketches, game whitebox captures, and H-Lynk foam or 3D-print models. The thumbnails sit in a row like timetable cells, with a Space Grotesk tabular date under each ("2025-03", "2026-07"). The big image has a one-line caption, and "03 / 12 NEXT" is styled as a platform counter. Only real artifacts are shown, never mock "concept art" that does not exist.
- **Target section:** proof

### 9. Wild — "Four parts that feed each other", pick a part
- **Site:** Wild
- **mobbin_url:** https://mobbin.com/sites/sections/c9a9f585-785c-43d4-a315-abe35bc64fd6
- **Local image:** `docs/design/site/research/mobbin-2026-10/wild-four-parts.webp`
- **What I saw:** A white page with a fine grid. A black pixel-edged "Back to wild" pill sits top centre, above the headline "Four parts that feed each other." and a three-line dek ending "Pick a part, or let it play through." A large screen recording of a product UI ("lumen … Skills") sits in the centre. Under it is a four-column numbered row, "01 Brand Truth / 02 Skills / 03 Output / 04 Brand Check", where the active one is in black text with a progress rule above it and the others are grey. Pixel-square decorations sit at the bottom corners.
- **Transferable pattern:** An auto-advancing "play-through" of four numbered stages. Each stage swaps the large media above it, a thin progress rule shows the timing, and the visitor can click any stage to jump.
- **Fit for NYC-MON:** **yes**. It turns real gameplay captures into a proof section that runs by itself but can also be controlled.
- **NYC-Tron translation:** Four stages named in canon order: "01 Meet", "02 Bond", "03 Care", "04 Explore", each with a short real in-engine clip. The progress rule is a signage-orange line. Stage numbers sit in black squares, like the MTA's numbered route bullets turned square. Respect `prefers-reduced-motion` by not auto-advancing.
- **Target section:** proof

### 10. Craft Agency — stacked city names as the picker
- **Site:** Craft Agency
- **mobbin_url:** https://mobbin.com/sites/sections/b9f10246-c8f9-47a1-9b5b-777dd981534e
- **Local image:** `docs/design/site/research/mobbin-2026-10/craft-agency-city-stack.webp`
- **What I saw:** A warm grey page with a small "LOCATIONS" eyebrow. Four city names are stacked in huge condensed serif capitals, centred: "LONDON" in black (active) and "NEW YORK", "MANCHESTER", "LEEDS" in pale grey. Two small pink name tags ("PAULA", "FIONN") are stuck onto the active word. Under the stack, a small white card gives the London address, phone and email.
- **Transferable pattern:** The typography is the picker. A vertical stack of place names is shown at display size, the hovered or active name turns full black, and a small detail card under the stack updates for that place.
- **Fit for NYC-MON:** **yes**. A district picker made of giant names reads like a station list on a platform sign and needs no map component.
- **NYC-Tron translation:** Stack five names in Archivo Black: "MIDTOWN", "LOWER EAST SIDE", "HARLEM", "WILLIAMSBURG", "ASTORIA" (or whichever districts canon uses). The active one is black with a route-bullet to its left, and the rest are concrete grey. Small tags stuck on the active word name the Mons found there, in the role of the people tags. A detail plate below shows one daylit district photo and one line. Keyboard focus moves the active state.
- **Target section:** city

### 11. PamPam — neighbourhood map with object pins and a list
- **Site:** PamPam
- **mobbin_url:** https://mobbin.com/sites/sections/e6edb168-a0ca-4662-ba6e-ff8824a51bf2
- **Local image:** `docs/design/site/research/mobbin-2026-10/pampam-neighborhood-map.webp`
- **What I saw:** Two tabs at the top ("Plan trips" with two-person emoji, active; "Share guides" with a pin emoji). Below is a browser-framed map of San Francisco with deep blue water and beige streets. Instead of dots, the pins are small illustrated objects: a coffee cup, a fork and knife, a red car, an apple, a hospital, a beach umbrella. A left panel shows a street photo, "My neighborhood", and grouped lists ("Food & Drinks": Saint Frank Coffee, Marina Pizza and Pasta; "Things to do": Crissy Field).
- **Transferable pattern:** A map where each pin is a small picture of what is there, paired with a side list grouped by type. Hovering a list row lights the matching pin.
- **Fit for NYC-MON:** **partial**. Object-as-pin is great for "Mons live in real places", but a full interactive map is heavy for a marketing page and the illustration style is off-brand.
- **NYC-Tron translation:** Use a static, simplified Manhattan and Brooklyn district map in the subway map's language: flat grey land, white water, black district names. Pins are tiny baby-form Mon silhouettes inside route-bullet circles. The side list is a departures board (Mon name, district, "seen near" cross street). Hovering or focusing a row highlights its pin. There is no tile-map library and no browser frame.
- **Target section:** city

### 12. Oatly — "Things We Do" story index
- **Site:** Oatly
- **mobbin_url:** https://mobbin.com/sites/sections/5c01860d-90fa-40b0-9720-ae0fac9ca0cd
- **Local image:** `docs/design/site/research/mobbin-2026-10/oatly-story-index.webp` (402,900 bytes, slightly over 400 KB)
- **What I saw:** A white page with a hand-drawn, shadowed headline wordmark, "THINGS WE DO". Below it are mono filter tabs (Everything, active and underlined; Initiatives; Stories; Brainwashing). Then a wide documentary photo: a red-haired woman in a denim vest with a yellow-and-pink "POWERED BY OATS" back patch, in front of cyclists in pink helmets and a Harley. Under the photo, "EF PRO BIKERS" is set in heavy condensed caps on the left, with a three-line mono dek on the right.
- **Transferable pattern:** An editorial index where each story is one large documentary photo with a heavy condensed title on the left and a short mono dek on the right, under a strip of plain-text filter tabs.
- **Fit for NYC-MON:** **yes**. The title-left, dek-right split under a real photo is exactly the "story" layout our type pair supports, and it has a voice without decoration.
- **NYC-Tron translation:** Use real street-level NYC photographs (no Mons pasted in until renders exist). The title is in Archivo Black caps, styled like a station name ("THE 4 TRAIN AT 7AM"), with a Space Grotesk dek. The filter tabs become signage-strip labels ("All / Districts / Callers / Build notes"). Drop the hand-drawn wordmark.
- **Target section:** story

### 13. Lightship — newsletter beside a real photograph
- **Site:** Lightship
- **mobbin_url:** https://mobbin.com/sites/sections/6d880a62-1d10-4b91-81ea-f84bbf11381e
- **Local image:** `docs/design/site/research/mobbin-2026-10/lightship-newsletter-photo.webp`
- **What I saw:** A warm grey panel with a faint plus grid. On the left, a small grey "Want the latest info on all things Lightship?" sits above a large black paragraph: "New AE.1 production updates, traveling roadshow locations, stories about our trailers in the wild — find it in our newsletter." Lower left is a pill email field ("name@email.com") joined to a black "Register →" button. On the right is an aerial photo of a truck towing the trailer along a dirt road beside a fence.
- **Transferable pattern:** The signup headline lists what the subscriber will actually get, as concrete items in one sentence, instead of a slogan. The form is pushed to the bottom of the column, and a real-world photo stands beside it.
- **Fit for NYC-MON:** **yes**. Listing the actual emails ("build notes, H-Lynk updates, first Mon reveals") is more honest than "Be the first to know", and it pairs with our privacy-note requirement.
- **NYC-Tron translation:** The left column is a Space Grotesk eyebrow, then an Archivo Black sentence listing three things the Caller will receive, then the email field and black `Join the waitlist` button, then a one-line privacy note ("One email a month. No sharing. Unsubscribe any time."). The right column is a daylit NYC street photo. Use flat concrete with no plus grid and a square-cornered field, not a pill.
- **Target section:** waitlist

### 14. basement.studio — wireframe interior (candidate)
- **Site:** basement.studio
- **mobbin_url:** https://mobbin.com/sites/sections/28a88d90-f813-478b-bb89-336dbe1e48a0
- **Local image:** `docs/design/site/research/mobbin-2026-10/basement-wireframe-interior.webp`
- **What I saw:** A full-screen black frame with a minimal white nav on top (Home, Services, Showcase, People, Blog, Lab, Contact Us). The whole view is a white line-only 3D wireframe of an interior: a staircase rising left to an upper walkway with railings, roof trusses, a doorway and an arcade-cabinet shape. Ribbons of dithered grey pixel particles flow through the space, and the "basement." wordmark is drawn faintly in particles on the right wall.
- **Transferable pattern:** A navigable line-drawn 3D space as the brand's "place". Particles or light move through the architecture to suggest life, and the wordmark is placed in the space rather than over it.
- **Fit for NYC-MON:** **partial**. The idea of a line-drawn real space with something alive moving through it suits a subway-station hatch or night moment. The all-black, studio-showreel mood is the opposite of our daylit default, and a WebGL scene is costly.
- **NYC-Tron translation:** Do not use this for the home hero. If used at all, it becomes a static or lightly animated SVG line drawing of a real subway mezzanine (stairs, turnstiles, tiled columns) in signage black on concrete for daytime. At night or hatch only, the same drawing goes white on black, and a single warm physical light (not particles) moves up the stairs. The wordmark is placed on the tiled wall like a station mosaic.
- **Target section:** proof or story (mood only), and hatch/night variant

---

## Not taken

- **Base "It pays to be here"** (`21207a98…`): a dot-matrix word marquee with tiny floating thumbnails. The marquee is already covered by the Slush card in Phase 1, and the hero type is a soft grey sans with no character.
- **Contra, Opacity, ISO Meet, heyclicky** (waitlist heroes): SaaS framing with floating UI cards, cursor tags, gradient discs and avatar collages. All four break the no-glass, no-gradient, no-SaaS rule.
- **Poly "Coming to a desktop near you"**: a glowing glass prism on a desk. That glow is not a physical light in our sense, and the image reads as a tech product, not a city.
- **Greptile early access**: a dense dark diagram with neon line art. It is too busy and off-palette.
- **Overmind team cards, OpenPhone pets, Kit creator cards, Figma personality types, Portrait, Claude**: returned for the roster query, but they are people or pricing cards, not characters, or are illustrated in a style that clashes. Berd (#2) does the job better.
- **Oryzo** (`02dd8a32…`), **Daylight** (`3ffb34f4…`), **Base waitlist** (`75fb9e38…`), **Sketch** (`a1261905…`), **Rains early access** (`6efdded0…`), **Grail email** (`54ed2f4c…`), **Lightship "Go Further"** (`82617eb6…` / `ff9247ab…`): already carded in the Phase 1 file.
- **Square hardware carousels** (`a8569e5d…`, `eb4fbae1…`): a catalogue of many SKUs. We have one device, and Square is already represented in Phase 1.
- **Sunday "Designed for real use"** (`e8714fa3…`): a good "Features / 360° / Anatomy" tab idea, but the rounded-card carousel is SaaS-like. Its tab mechanic is already captured in Lightship #4.
- **GTE keychain** (`f7c70eda…`): a strong orange-and-black split, but crypto-terminal styling. Our signage strip already covers the idea.
- **Chronicle "Behind the Scenes"**, **Customer.io**, **Craft careers**, **Framer**, **Vizcom**: about pages or tool demos with gradient frames and cartoon team art. None of them show craft artifacts.
- **Faculty Department / Le Labo** (`cf0105a2…`): a beautiful full-bleed process video, but it is a single shot with no structure to borrow beyond "use real footage", which KÖPPEN (#8) already gives with dates.
- **Fresha, Eventbrite, Slack location lists**: SEO link farms and region tabs, functional but with no character.
- **PamPam City Templates / "Map lovers"**: rounded photo cards with a template-gallery feel. The map card (#11) is the useful one.
- **Kinfolk "Studio Visit"** (`1557474b…`): a nice serif title-left, photo-right split, but Oatly (#12) does the same split with heavier type that is closer to Archivo Black.
- **Glide, PayPal, Grammarly, Freshman, Studio Freight, Creative Intelligence Company**: corporate featured-story cards, near-empty captures, or centred-small-photo layouts with weak hierarchy.
- **Lightship manifesto** (`f387455d…`), **"Built for how you travel"** (`1400de43…`), **specs accordion** (`e86b17db…`), **"Engineered Ease"** (`f3e6ceb3…`), **"Where Form Follows Function"** (`da6aa79b…`), **team photo** (`cc7d537f…`): competent, but they repeat patterns already covered by #4, #6 and #13 or by Phase 1. The orange quote card in the manifesto is a SaaS card.
- **Seasats aside: Rivian R1T drag-to-rotate, Rivian Camp Speaker PDP, Joby "Cruise, controlled."**: car-commerce patterns or a hero already covered by the Apple and Lightship cards.
- **basement.studio contact band** (`a2f3898a…`), **Wild pixel marquee / pixel field**, **Shader CRT boot screen**, **COLLINS modal**, **Spline examples**, **KODE Immersive** (blank capture), **Maze pixel field**, **Deel illustration hero**, **Daylight brand page**: either retro-pixel or showreel styling that fights the daylit signage system, captures with nothing visible, or generic SaaS heroes.
