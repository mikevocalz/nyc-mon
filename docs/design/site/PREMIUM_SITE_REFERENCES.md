# Premium site references

Phase 1 research lane, 2026-10-07. Branch `feat/premium-home-redesign`.

## Method

Every card below cites a URL returned by a tool call in this session. Mobbin
cards come from the Mobbin MCP (`search_sections`, `search_screens`,
`search_flows`); the preview image for each was looked at before the card was
written. Non-Mobbin cards come from pages fetched with WebFetch, and each says
what the fetch actually returned. Nothing here is copied into app code; cards
record a pattern, what we reject, and how it turns into NYC-MON.

Binding constraints applied to every "How it becomes NYC-MON" line: daylit
concrete and signage black by default; glow only as a physical night or hatch
light; Archivo Black + Space Grotesk only; no glass, no gradients, no SaaS
cards; bento in at most three places (WORLD, H-LYNK proof, optionally CARE)
and never in hero, starters, hatch or the final CTA; canon terms exact
(H-Lynk, H-Lynk Core, Caller, Mon, Bloodline, Dex ID); baby forms only.

### Queries run

`search_sections`:
- game launch hero with large key art character illustration and single call to action
- cinematic full-bleed photo hero with oversized headline set over the image
- editorial key art hero with illustrated world and large title, Lightship
- scrolling marquee band of large uppercase text across the page
- horizontal ticker strip of labels separated by symbols between two sections
- transit wayfinding signage style section with route numbers in circles and station names
- bold typographic banner with giant repeating words filling the width on solid color
- black information strip with white bold sans labels and colored circle bullets like subway signage
- asymmetric editorial image collage with one large photo and smaller offset photos and captions
- bento grid mosaic with one large image tile and smaller feature tiles
- KOBU agency asymmetric editorial section with staggered images and text
- hardware product section with physical device photographed large and short feature labels around it
- Daylight computer tablet hardware feature section with device image and specs
- Apple product page section with device close-up and large headline about a hardware feature
- device feature grid with callout lines pointing to parts of a handheld gadget
- dark cinematic section with a single lit object in a black field and one line of text
- waitlist signup section with a single email field and one button under a large headline
- early access signup on dark background with product image and email input
- footer with a large illustrated scene or giant brand wordmark closing the page

`search_screens` (iOS):
- Tolan companion character introduction screen with alien character large in center
- character select screen with three creatures side by side to choose one starter
- virtual pet care screen showing creature with hunger, energy and happiness status
- gentle check-in screen where a pet character asks how you are, no streak counter
- egg hatching reveal moment with creature emerging and celebration text

`search_flows` (iOS):
- Tolan meeting your alien companion for the first time
- Tolan onboarding introducing how the companion relationship works

WebFetch: `https://standardsmanual.com/`, `https://www.nintendo.com/us/`,
`https://www.playstation.com/en-us/`, `https://www.apple.com/iphone-17-pro/`.

### Seeded URLs from contract §3

Returned by a query and carded: KOBU `f5959421…`, Tolan "Meeting your Tolan"
flow `f1595b35…`.

Not returned by any query, so not opened and not carded: Lightship
`a5fa6838…`, Webflow `6c536320…`, Square `394464f3…`, Daylight `b9729ea8…`,
Apple `1821ad0f…`, Tolan screen `3b15b9df…`, Tolan finding flow `3257e852…`,
Tolan onboarding flow `1b7a3a3b…`. Other sections from the same products
(Lightship, Square, Daylight, Apple, Tolan) were returned and are carded
instead. Phase 3–6 integrators can open the seeded links in a browser and add
cards; this file does not claim to have seen them.

The prior v2 audit (`PREMIUM_SITE_AUDIT.md`, "References studied") cites nine
Mobbin screens (Tolan, ZARA, H&M, Revolut, Luma, Curater, Visual Electric).
They were not re-opened in this pass and are not repeated here.

---

## HERO

### HERO — Lightship — type set across the photograph
Source: https://mobbin.com/sites/sections/82617eb6-17e0-48de-9482-e73470a08d1f
Problem it solves: A first screen that reads as a campaign, not a product UI. The aerial photo of a truck and trailer on a dirt road fills the frame; "Go Further" runs edge to edge across the lower third at poster scale. Nav is four tiny labels.
What we borrow: Headline as a physical layer of the image, set wider than the viewport's comfort zone. Chrome reduced to small corner labels. One photograph, no supporting cards.
What we explicitly reject: The thin grotesque, the floating "Ask me anything" chat pill, and the outdoors-brand calm.
How it becomes NYC-MON (not a clone): The hero headline sets in Archivo Black across a daylit street-level NYC photograph (the art map already slots `midtown-chrysler-spire`), seal at the right, one `Join the waitlist` button. Corner labels become signage annotations (district name, cross street) in Space Grotesk. The current `SolidPanel` slab goes away.
Used in phase: 3

### HERO — Navigate — character as key art
Source: https://mobbin.com/sites/sections/996480f8-e2d7-4933-afd9-b957ac3b7feb
Problem it solves: Shows a character at a scale that crops out of the frame, so the first read is "who is this" before "what is this". Headline stacks left at display size, body copy is four short lines.
What we borrow: Character cropped by the viewport edge, headline-left / art-right split, body copy kept far smaller than the headline.
What we explicitly reject: Purple flat-colour field, sticker props floating around the figure, gamified "data quest" framing, pill-shaped nav.
How it becomes NYC-MON (not a clone): When baby-form Mon renders exist, one Mon crops out of the hero frame against concrete and a real street, never against a flat colour field. Until then the seal plus the photograph carry the frame; no stand-in illustration.
Used in phase: 3

### HERO — Legora — real New York skyline at hero scale
Source: https://mobbin.com/sites/sections/df151bfe-2ce2-4ef5-b3bd-b5f8fc1d24a5
Problem it solves: Proves place in one image. Lower Manhattan at golden hour with One World Trade Center lit; nav is a thin strip, nothing else competes.
What we borrow: Letting the NYC photograph be the hero surface, with chrome kept outside the subject.
What we explicitly reject: The aerial "corporate skyline" view, dusk colour grade used as mood, and the green pill demo button. An aerial skyline says "finance firm", not "your block".
How it becomes NYC-MON (not a clone): Our photography stays street-level and daylit (stoops, signage, bodega awnings, the Apollo marquee). Skyline shots only appear in WORLD as one district among four, never as the hero.
Used in phase: 3

### HERO — The New Yorker — editorial kicker, headline, dek over a photograph
Source: https://mobbin.com/sites/sections/7b8ee3c6-6b9d-4058-a654-295734f0233a
Problem it solves: A clean three-tier hierarchy on top of an image: tiny all-caps kicker ("Annals of a Warming Planet"), one headline, one sentence of dek, byline.
What we borrow: The hero copy formula from contract §9 matches this exactly: quiet label, one headline, one proof sentence. The tiers are separated by size, not by boxes.
What we explicitly reject: Serif display and serif body (contract bans a serif "for luxury"), centred magazine layout.
How it becomes NYC-MON (not a clone): Eyebrow in Space Grotesk caps as a signage label, headline in Archivo Black, one proof sentence, then the button. No panel behind the text; contrast comes from the photo's crop and a solid concrete band if needed, never a gradient scrim.
Used in phase: 3

## SIGNAGE

### SIGNAGE — Nike After Dark Tour — city list as a route board
Source: https://mobbin.com/sites/sections/2c3707de-6813-45f0-8bb1-25fc3f270222
Problem it solves: Lists places so they read as a destination board. Seven city names stack in heavy red caps, each with a small superscript distance (21.1K, 10K). The list is the graphic.
What we borrow: Stacked place names at display weight with a small factual annotation beside each. Hierarchy from size and weight only.
What we explicitly reject: All-red-on-black night palette for a daylit band, and the sport-brand shouting.
How it becomes NYC-MON (not a clone): The signage band lists districts (Harlem, Midtown, Downtown, Mega City edge) in Archivo Black on signage black or concrete, each with a small Space Grotesk annotation that is a physical fact (a cross street or line), styled after transit destination signs. No numbers that read like stats.
Used in phase: 3

### SIGNAGE — Cassette — full-width colour strips with one line each
Source: https://mobbin.com/sites/sections/611cce3b-5230-4cff-88e5-8f1c081b09ed
Problem it solves: Turns a list into stacked horizontal bands, each a solid colour with an icon at the left edge, a title and a tiny caps sub-line. Reads like a printed timetable.
What we borrow: Solid full-bleed strips, hard edges, left-edge marker, one line of title per strip. This is the closest Mobbin result to transit band signage.
What we explicitly reject: Pastel/neon rainbow colour order and the jokey service copy.
How it becomes NYC-MON (not a clone): Each strip gets a district colour as context only (contract: district colours never carry a CTA). Left-edge marker is a route-style disc. Used as the SIGNAGE band or as the district picker's static fallback, one strip per district, keyboard-focusable if interactive.
Used in phase: 3

### SIGNAGE — Ditto — labelled blocks with arrows
Source: https://mobbin.com/sites/sections/d7d6419e-1e6f-490f-a59b-56dfc94a6d0c
Problem it solves: Directional choices presented as signs: each audience name sits on a solid colour block with a heavy arrow underneath, like a wayfinding panel.
What we borrow: Block-plus-arrow as a wayfinding unit; text set tight to the block edge.
What we explicitly reject: Scattered four-corner layout and the soft pastel set; it reads like a marketing menu.
How it becomes NYC-MON (not a clone): In-page section jumps (WORLD, H-LYNK, STARTERS) can use a black block with a white arrow and the section name, aligned to a strict grid like a station exit sign. Arrow glyphs are drawn shapes, not emoji.
Used in phase: 3

### SIGNAGE — Slush — repeating wordmark band
Source: https://mobbin.com/sites/sections/bef161b2-213e-47d0-98e1-7769e041eb86
Problem it solves: A loud brand band built from one phrase repeated in coloured slabs across two rows.
What we borrow: Only the idea that a single repeated phrase can be a band, and that slabs can bleed off both edges.
What we explicitly reject: Most of it. Rounded slabs, italic display face, stickers (rocket, coin, wallet), and the crypto energy. The roster names "signage that reads as a crypto ticker" as a rejection.
How it becomes NYC-MON (not a clone): If the existing `MarqueeBand` keeps a repeated line, it is one canon phrase in Archivo Black on square-cornered strips, no props, slow or static under reduced motion. This card exists mainly as the boundary of what the band must not become.
Used in phase: 3

## WORLD

### WORLD — KOBU — staggered two-image editorial
Source: https://mobbin.com/sites/sections/f5959421-5ded-4adb-98db-49143db77839
Problem it solves: Gives a place room to breathe. Three architecture photos sit in a row, each with a small caps category label ("In conversation with", "Culture", "For the eye") and a short headline, set on warm off-white. One card is about a New York City interior.
What we borrow: Photographs as places with a small category label above a one-line title. Wide gutters and a quiet ground.
What we explicitly reject: Hospitality warmth, the humanist sans, the even three-up row (reads as a blog index), and arrow-link headlines.
How it becomes NYC-MON (not a clone): WORLD captions use the same two-tier pairing: district as a caps label, a street-level place line as the title ("Harlem / Lenox Avenue rowhouses"). Ground is cool concrete, not cream. Row is broken into one dominant frame plus offset companions (see next card).
Used in phase: 3

### WORLD — KOBU — offset images with text in the gaps
Source: https://mobbin.com/sites/sections/cc63048b-341e-420d-a687-5d5c17aacf3c
Problem it solves: An asymmetric layout without a grid of equal tiles. One photo sits upper left, a second steps down to the lower right, and short paragraphs fill the opposite corners.
What we borrow: Diagonal stepping of two frames with copy occupying the negative space. Source order stays image, text, image, text, which is also the mobile reading order.
What we explicitly reject: Long body paragraphs and the gentle grey second headline line.
How it becomes NYC-MON (not a clone): The WORLD section (art map `TEMP_WORLD_ART`: Midtown, Harlem Apollo, Downtown One WTC, Lenox rowhouses) uses one dominant frame and stepped companions in CSS Grid. Copy in the gaps is one sentence per district. This is one of the three permitted bento clusters: one dominant module, at most four modules, all of them photographs.
Used in phase: 3

### WORLD — Epidemic Sound — photo mosaic of real places and people
Source: https://mobbin.com/sites/sections/600ccc40-fda1-41ae-b6f7-408369b9113f
Problem it solves: A hard-edged photo grid with mixed cell sizes and no gutters: street portrait, office window, a person on a car roof at night, studio desks.
What we borrow: Square corners, zero-gutter or hairline-gutter cells, a mix of day and night frames, real people in real places.
What we explicitly reject: Office/corporate culture subject matter and the chalkboard strip at the bottom.
How it becomes NYC-MON (not a clone): A tighter version of this grid is the fallback if the stepped layout fails at 768–1024px. Cells are borough photographs only; night frames are allowed here because they are photographs of the city at night, not glow effects.
Used in phase: 3

### WORLD — Readymag — poster tiles with type over image
Source: https://mobbin.com/sites/sections/18bf1b78-4281-4c65-b79c-443af2b345ec
Problem it solves: Each tile reads as a printed poster: "Mars science laboratory" over a crater photo, a giant "2020" filling a blue field, "MIRACLE" across an orange plate with two specimen photos.
What we borrow: Type that is part of the image rather than a caption beneath it; solid colour plates with a photo inset.
What we explicitly reject: Rounded tile corners, the serif "Carte Blanche" tile, and mixing four unrelated art directions in one grid.
How it becomes NYC-MON (not a clone): The dominant WORLD frame can carry its district name in Archivo Black at poster scale over the photo, like a wheat-pasted bill. One poster per section at most, so it stays a moment.
Used in phase: 3

## H-LYNK

### H-LYNK — Apple — iPhone 17 Pro hardware hero
Source: https://mobbin.com/sites/sections/59514a44-5eff-4d00-bef5-4ebc45f88af0
Problem it solves: Makes hardware feel like a launch. Black stage, product name in large orange display type, a short spec paragraph, then the camera plateau of an orange phone filling the lower half, cropped hard.
What we borrow: Name first at display scale, then the object cropped close enough that you see material and parts. One dark stage, one object, one colour that belongs to the object.
What we explicitly reject: The gradient-filled wordmark and the four-feature run-on sentence.
How it becomes NYC-MON (not a clone): H-Lynk Core gets its own stage: "H-Lynk Core" in Archivo Black, then `DeviceStage` (or its static capture) cropped to the black scanner head on the red body. Red stays reserved for H-Lynk hardware per contract §8. The stage is a solid ink surface; no gradient type. Eyebrow changes from "The device" to canon wording.
Used in phase: 4

### H-LYNK — Daylight — device in the real world plus three physical facts
Source: https://mobbin.com/sites/sections/3ffb34f4-4713-4a4d-a05e-d18961771f0b
Problem it solves: Proves the object exists outside a render. A tablet lies in tall grass in hard sunlight; below it, three short labelled facts ("No eye-strain", "Extended battery", "Backlight optional"), each two lines.
What we borrow: Photographing the object in daylight in a real place, and three feature labels written as physical facts, not benefits.
What we explicitly reject: Peach background, the hairline icons, the floating glassy nav with orange order button.
How it becomes NYC-MON (not a clone): Once a physical or photographic H-Lynk capture exists, it sits on a stoop rail or subway bench in daylight. The three existing `W01_COPY.hlynk.features` (scanner head, HUD, push-to-talk) become the three labels, rewritten as short physical facts. No icons; a numbered callout line to the part instead.
Used in phase: 4

### H-LYNK — Square — hardware on white with name, line and two actions
Source: https://mobbin.com/sites/sections/15dd1e4f-b78a-462e-b314-ba3a9fd949a6
Problem it solves: Shows each device as an isolated object on a quiet ground with a product name, a one-line claim and price. A thumbnail rail of every device sits at the top.
What we borrow: Isolated product shot on a flat field with generous margin; name above claim; the device rail idea for showing tiers later (H-Lynk Core is the entry tier per current copy).
What we explicitly reject: Two-button commerce rows, pricing, and the white SaaS catalogue tone.
How it becomes NYC-MON (not a clone): A single isolated H-Lynk Core capture on concrete, name and one line beside it, `Join the waitlist` as the only action. A tier rail is out of scope until canon defines other tiers.
Used in phase: 4

### H-LYNK — Oryzo — split panels with a cropped object
Source: https://mobbin.com/sites/sections/02dd8a32-d483-44a5-81a5-4f402689df5e
Problem it solves: Two panels side by side: a large one with a two-line claim over a close crop of the object on a shelf, and a narrower one cropping the same object from another angle. Reads as supporting proof without cards.
What we borrow: One dominant panel plus one narrow companion showing a second angle. Short caps label in the corner ("On-device.").
What we explicitly reject: The joke product, sticker art, and the burnt-orange gradient light.
How it becomes NYC-MON (not a clone): This is the shape for the H-LYNK supporting proof cluster (permitted bento place 2): one dominant `DeviceStage` panel, one narrow panel showing the push-to-talk edge or the HUD close up, at most four modules total, at least one interactive or visual proof. Surfaces are solid, edges hard.
Used in phase: 4

Phase 4 added the four cards below from two fresh `search_sections` queries: "hardware product launch section with a single device large on a dark background and its product name in a big headline" and "product feature grid with close-up detail photos of hardware parts, each tile a cropped photo with a short headline". The Square seed `394464f3…` came back from the first query; its product image had not loaded in the preview, so it is not carded.

### H-LYNK — Oryzo — one lit object in a dark field
Source: https://mobbin.com/sites/sections/9d67f8ac-8069-4a4b-999a-8ae18e7debf0
Problem it solves: The object is the only lit thing on a near-black page. One raking light from the upper left gives the cork its texture and a hard shadow side; a two-line claim sits left, one sentence right, both small next to the object.
What we borrow: A single key light that shows material, the object at the centre of the composition, copy that steps back.
What we explicitly reject: The warm brown field, the joke claim, the footnote asterisk.
How it becomes NYC-MON (not a clone): The H-Lynk Core stands on an ink plate with a white key from the upper left and red as the only coloured light, from its own scanner head. The name sits beside the plate, not over it.
Used in phase: 4

### H-LYNK — Mews — name and one line over the device on a dark plate
Source: https://mobbin.com/sites/sections/2e285ad6-ea7e-404a-9849-61c2bc6654e2
Problem it solves: A dark inset plate holds the product name, one line about what it does, and the terminal itself, upright and centred.
What we borrow: The plate as a stage with its own edge inside the page, and the object upright and whole.
What we explicitly reject: The rounded plate, the pill button and the second, half-hidden screen beside the device.
How it becomes NYC-MON (not a clone): The ink stage is a square-cornered plate inside the daylit section; the H-Lynk Core stands upright in it, whole, at 4:5.
Used in phase: 4

### H-LYNK — bella — detail crops with one-line physical labels
Source: https://mobbin.com/sites/sections/ee1c7e61-ecd3-4865-95fa-f0641c6d5f2c
Problem it solves: Each tile is the same toaster cropped to a different part (the slot, the dial), captioned with one physical fact ("6-setting browning shade control").
What we borrow: Proof that is a crop of the real object plus one plain line naming the part.
What we explicitly reject: The kitchen lifestyle set dressing and the horizontal carousel (WCAG 2.5.7 concerns, and the audit's "no slider" rule).
How it becomes NYC-MON (not a clone): The two proof modules are crops of the H-Lynk Core render: the scanner head, and the control row with the red-ringed trackpad. Each gets a short headline and one sentence from Decision #16.
Used in phase: 4

### H-LYNK — Square — image and headline as stacked rows
Source: https://mobbin.com/sites/sections/f30c6ed8-3388-4e8a-8273-bc4b900c018d
Problem it solves: Features as a vertical list: image left, headline and two lines right, hairline between rows. Reads top to bottom on any width.
What we borrow: The phone layout for proof: a vertical list of image-plus-line rows, not a two-column mini grid.
What we explicitly reject: Lifestyle stock photography, "Learn more +" links, the four-row length.
How it becomes NYC-MON (not a clone): Below `lg` the scanner and controls modules stack as full-width rows under the stage and the name, each with its crop on top and its line below.
Used in phase: 4

## STARTERS

### STARTERS — Tolan — "Introducing" naming beat
Source: https://mobbin.com/screens/54ba5165-a724-43ff-b235-112cdf63c5f0
Problem it solves: Introduces a character as a person. Tiny caps "INTRODUCING", the name "Sam" large beneath it, the character sitting in an armchair in its world, and a single subtitle line of its first words.
What we borrow: Label, name, character, one line in the character's voice. The name and the image carry the screen; nothing is a spec.
What we explicitly reject: Serif name, pastel 3D world, the lowercase-friendly chat tone.
How it becomes NYC-MON (not a clone): Each starter gets this beat at section scale: Space Grotesk caps label, baby-form name in Archivo Black (names from `packages/content`, never typed into JSX), the egg or baby Mon in its district (art map: Harlem stoops, Times Square, Mega City bridge deck), then Dex ID and Bloodline as quiet annotations. Three of these in sequence, not a bento and not three equal cards.
Used in phase: 5

### STARTERS — Tolan — "Meeting your Tolan" flow
Source: https://mobbin.com/flows/f1595b35-4bcf-4abe-aeaf-ed5ff33f399b
Problem it solves: Pacing of a first meeting across 11 screens: the character arrives in a full-screen world, chrome shrinks to three glyph buttons at the bottom edge, and the character fills more of the frame as the bond starts.
What we borrow: Presence before features, and a sequence that gets closer to the character as you go.
What we explicitly reject: Chat bubbles and onboarding questions; a marketing page does not simulate the app's setup.
How it becomes NYC-MON (not a clone): Scroll order inside STARTERS moves from egg (wide, in its district) to baby Mon (close crop) for each Bloodline. Motion purpose is "reveal"; under reduced motion all three states show statically. Never reveals forms past baby.
Used in phase: 5

### STARTERS — Finch — choose your egg
Source: https://mobbin.com/screens/db6655c3-2b11-4042-9e4f-5d5d131da104
Problem it solves: Picking an egg before you know who is inside. Six coloured eggs ring a small bird; a short line describes the species; one "Hatch egg" button.
What we borrow: Eggs as the unit of choice, and copy that describes temperament rather than stats. Matches our existing line "Three eggs. One of them hatches for you."
What we explicitly reject: Six options in a ring, candy colours, green game button, and the implication that the player decides the outcome. In canon the Mon makes its choice.
How it becomes NYC-MON (not a clone): Three eggs only, shown as objects with real material (shell texture, district light), each labelled with its Bloodline and egg source (`W01_COPY.starters.hatchesFrom`). No select state on the marketing page; the eggs are introductions.
Used in phase: 5

### STARTERS — (Not Boring) Weather — collectible with a catalogue number
Source: https://mobbin.com/screens/c0885290-f1b7-4a08-83a6-861e62c7d632
Problem it solves: Makes a character feel collectable. A big character, a code "SKN.006" in small mono above the name "MONSTERS", a "SECRET" tag and a one-line description in caps.
What we borrow: A catalogue number set small above a big name gives instant "this is one of a set" without explaining a collection mechanic.
What we explicitly reject: Pixel/mono novelty type (we have two families only), the "wear it" button, the 3D dice carousel.
How it becomes NYC-MON (not a clone): Dex ID uses the existing `W01_COPY.starters.dex` format ("No. 001") in Space Grotesk at annotation size above each starter name. The number is canon, so it is the only "collectible" signal we need.
Used in phase: 5

### STARTERS — Tolan — the companion alone in its world (Phase 5 search)
Source: https://mobbin.com/screens/ffe464e5-482f-45a2-aa76-a231b802c4cd
Problem it solves: The home screen is the character standing full height in its landscape, with three small glyph buttons along the bottom edge and nothing else.
What we borrow: The character owns the frame. Chrome is pushed to the edges and kept small.
What we explicitly reject: The pastel sky, the rounded 3D mascot style, app chrome.
How it becomes NYC-MON (not a clone): Each starter poster is mostly art plate. When the Baby renders land in `starter.<slot>`, the Mon stands in its street at full poster height and the identity plate stays below the frame, not over the Mon.
Used in phase: 5

### STARTERS — Tolan — name the companion after you meet (Phase 5 search)
Source: https://mobbin.com/screens/ea87eba0-3204-4373-b063-ad9e1d01c0dc
Problem it solves: "Name your Tolan" over a glowing orb with the companion's silhouette half hidden behind it, and one name field.
What we borrow: Naming comes after the meeting, and the companion is partly withheld until then.
What we explicitly reject: The eclipse glow and the night backdrop in a daylight section.
How it becomes NYC-MON (not a clone): Matches Decision #5 (naming after the hatch). The page names the species (Baby name from `@acme/content`), never a personal name, and shows nothing past Baby.
Used in phase: 5

### STARTERS — Duolingo ABC — three cards with one hidden (Phase 5 search)
Source: https://mobbin.com/screens/6368e06d-5524-4353-b2f7-07d7e0e38fb1
Problem it solves: Three character cards under the scene, the middle one a "?" tile, so the set reads as exactly three before any is chosen.
What we borrow: Three as the visible count of the set, side by side at equal weight.
What we explicitly reject: Star ratings, rounded candy tiles, the mystery-box framing (it implies a gacha draw).
How it becomes NYC-MON (not a clone): Three posters in one row from `lg`, the egg names listed in the body copy, and a semantic list of three items. No ratings and nothing hidden behind a "?".
Used in phase: 5

## CARE

### CARE — Abode — pet with two meters and three actions
Source: https://mobbin.com/screens/d450f05c-bebb-4852-a443-c8f62468ff03
Problem it solves: The whole care loop on one screen: creature in its environment, two status bars at the top (heart, smile), three action buttons (food, broom, toy) under it.
What we borrow: Creature and needs in one frame; actions as verbs right under the creature. Maps to our Feed / Rest / Play and Fullness / Energy / Social.
What we explicitly reject: Rounded candy buttons, cartoon blob, bars as the main visual. The current `CareSection` already leans toward meters-as-dashboard; this reference shows how quickly that becomes a toy UI.
How it becomes NYC-MON (not a clone): CARE leads with the Mon (or its H-Lynk readout photographed on the device), and the three verbs as large Archivo Black words with one line each. Meter values, if shown at all, appear as the H-Lynk HUD inside the device capture, never as standalone bars on the page. Optional bento place 3: one dominant Mon frame plus the three verbs, ≤ 4 modules.
Used in phase: 5

### CARE — Tolan — messages from the companion (account setup flow)
Source: https://mobbin.com/flows/3734e10b-c681-4d05-90c9-5a2dad369e02
Problem it solves: Frames notifications as the companion reaching out: "You'll get messages from your Tolan, like that new song they found for you, or an update from their world", with the character peeking over the card.
What we borrow: Need-signalling framed as the creature communicating, not as the app nagging. Fits our line "Your Mon tells you what it needs with a look, a sound or a reach."
What we explicitly reject: Permission-dialog styling, gradient card border, the nightclub particle backdrop.
How it becomes NYC-MON (not a clone): One care beat shows the Mon's signal through the H-Lynk (the push-to-talk chirp, a scanner light) with a single line of copy. No streak, no count, no "don't forget". Closing line stays "A relationship, not a streak."
Used in phase: 5

### CARE — BitePal — hearts and calorie rings (counter-example)
Source: https://mobbin.com/screens/c76cbee1-e8f2-443c-b542-4920622b6ed3
Problem it solves: Keeps a pet on screen while tracking food: raccoon on top, four hearts and a flame streak count, calorie card and macro bars below.
What we borrow: Only that the pet stays above the data.
What we explicitly reject: Hearts-as-health, the flame streak counter, calorie numerics. Streak mechanics are the guilt tone the copy laws and the existing closing line rule out.
How it becomes NYC-MON (not a clone): Recorded as the boundary. If a CARE draft grows a counter, a flame, or a "days in a row" number, this card is the reason to cut it.
Used in phase: 5

### CARE — Tolan — the companion in its place, no meters on screen (Phase 5 search)
Source: https://mobbin.com/screens/672c31d4-76ef-48cc-b55f-110f54475a91
Problem it solves: The companion sits in a desert landscape with a notification badge on one button. Need is signalled by the companion and one badge, with no bars on screen.
What we borrow: The creature's state shown by the creature, not a gauge.
What we explicitly reject: The notification count badge (a count-as-pressure mechanic).
How it becomes NYC-MON (not a clone): CARE leads each row with what your Mon does ("Asks for food.", "Comes closer.") before the meter, and the meter is small and labelled as an example. When the `care` reaction art lands, it becomes the dominant module.
Used in phase: 5

### CARE — MacroFactor — nutrition tiles with bars (counter-example, Phase 5 search)
Source: https://mobbin.com/screens/33f12878-93d5-40bf-8c3c-52672ddc5eaa
Problem it solves: Four equal tiles (Calories, Protein, Fat, Carbs), each a value and a thin bar, under a numeric header.
What we borrow: Nothing visual. It shows what three equal meter tiles turn into.
What we explicitly reject: Equal tiles with numbers as the main content. This is the dashboard the audit (W10) found in the old CARE readout.
How it becomes NYC-MON (not a clone): Recorded as the boundary. No on-screen percentages; the verb, not the bar, carries each row.
Used in phase: 5

## HATCH

### HATCH — Abode — "incubating…" waiting state
Source: https://mobbin.com/screens/32967fba-5950-4b50-a68d-fdd6183d8d8c
Problem it solves: A waiting state with no countdown. One egg, the word "incubating…", and one line: "You'll get a notification when your pet is ready to hatch."
What we borrow: Waiting expressed as a still object and one sentence of consequence. This is the same promise as our canon line about a single notification.
What we explicitly reject: Pastel hills, cartoon egg, the in-app chat bar.
How it becomes NYC-MON (not a clone): The hatch band shows the egg in the district at night, still, with "Pick a time. The egg waits." and the 15 / 30 / 60 minute choice stated as plain text. No timer UI, no ticking digits.
Used in phase: 6

### HATCH — Nike After Dark Tour — light from below on black
Source: https://mobbin.com/sites/sections/a7d81051-1ae6-44b0-8069-adebc2aff07f
Problem it solves: A night section with one light source. Heavy red caps headline on black; a red light pools up from the bottom edge as if from a street lamp or stage.
What we borrow: Glow as a physical light with a direction and a source, used once, on an ink ground.
What we explicitly reject: All-caps red shouting, the copyright mark as decoration, the floating pill nav.
How it becomes NYC-MON (not a clone): The hatch is the one place restrained orange/red light is allowed. The light comes from the egg, low in the frame, and falls off on the ink surface. Headline in Archivo Black, white or concrete-light, not orange. Under reduced motion the light is static.
Used in phase: 6

### HATCH — Shopify Editions — one lit object, two words
Source: https://mobbin.com/sites/sections/47c5f830-b25e-4912-8484-47377cd8a238
Problem it solves: A climax frame: the rear of a car in near-black, tail lights the only colour, "LET'S GO" small and condensed above it, one small button.
What we borrow: The object is mostly shadow; its own lights carry the colour. Copy is tiny next to the object. Restraint reads as tension.
What we explicitly reject: Condensed display face, the purple ambient wash.
How it becomes NYC-MON (not a clone): The egg sits mostly in shadow, its crack line lit orange. Copy is one line ("Be there when it opens.") plus the repeated `Join the waitlist`. No bento, no cards, nothing else in the section.
Used in phase: 6

### HATCH — Finch — hatch result screen (counter-example)
Source: https://mobbin.com/screens/35490f66-6e9a-47fc-a182-45334aeea3a9
Problem it solves: Celebrates the moment a pet hatches: sunburst rays behind the bird, "You hatched a birb!"
What we borrow: Nothing visual. It confirms the hatch is the emotional payoff of the genre.
What we explicitly reject: Sunburst rays, the cute misspelling, and the framing that the player hatched it. In canon the Mon chooses ("Its first look at you is how it says yes.").
How it becomes NYC-MON (not a clone): The marketing page stops before the reveal. We show the waiting egg and the promise, not the result, and never a form beyond baby.
Used in phase: 6

### HATCH — Daylight — single warm light on a near-black brand hero (Phase 6 search)
Source: https://mobbin.com/sites/sections/e37787eb-35fe-4981-a18b-14a559a6e270
Problem it solves: Opens Daylight's brand kit page. A dark photo of a hand lit orange from one light source fills the frame. "This is Daylight" sits in a large serif at upper left, a numbered index (00 Welcome through 07 Components) and two small outlined buttons ("Download kit", "Open in Figma") sit below it, and "A new kind of energy company" sits lower right.
What we borrow: One warm light in an otherwise dark frame, with the type sitting in the dark areas so the light stays the subject. Secondary controls stay small so they don't compete with the headline.
What we explicitly reject: The numbered index menu inside the hero. The thin serif display face. The hand used as a stand-in for the product.
How it becomes NYC-MON (not a clone): The light comes from inside the Brooklyn Bridge night photo, shown as a wide window, and nothing else in the band is lit. "Pick a time. The egg waits." is set in Archivo Black on the ink above it. The band has no control at all; the waitlist below carries the action.
Used in phase: 6

### HATCH — Daylight — dusk photo with a headline split across the frame (Phase 6 search)
Source: https://mobbin.com/sites/sections/4db3eb21-9348-4652-9e4e-e286971f8091
Problem it solves: A thesis section on Daylight's site. A full-bleed photo of transmission towers against an orange-to-teal dusk sky carries a large serif headline split in two: "The grid has" at upper left and "no master" at lower right. A short paragraph sits in the dark lower-left corner.
What we borrow: One sentence broken in two so the second half lands as the payoff.
What we explicitly reject: Type over the photo (it would need a scrim), full bleed edge to edge, the manifesto tone.
How it becomes NYC-MON (not a clone): The headline breaks into "Pick a time." and "The egg waits.", the second line in the hatch orange, set above the photo window instead of on it.
Used in phase: 6

## WAITLIST

### WAITLIST — Grail — email field as the headline
Source: https://mobbin.com/sites/sections/54ed2f4c-f8b7-4863-acc6-82aa7335da04
Problem it solves: A single-field signup where the input is the biggest thing on screen. "YOUR EMAIL" sits as huge placeholder text on a full-width underline; above it, a short paragraph about letting the first group in; below, "Early access · No card, no spam".
What we borrow: One field, set large, full width, with a one-line reassurance underneath. No form chrome.
What we explicitly reject: Serif placeholder, the app-icon glow, the low-contrast grey placeholder (fails contrast, and placeholder-as-label fails WCAG 3.3.2 without a real label).
How it becomes NYC-MON (not a clone): The final CTA is a single email field with a visible Space Grotesk label, input text in Archivo Black at large size, a hard black underline, and the `Join the waitlist` button in orange. One reassurance line about what we send. Form states via `useActionState`.
Used in phase: 6

### WAITLIST — Base — waitlist beside an object in hand
Source: https://mobbin.com/sites/sections/75fb9e38-9f05-494f-92ab-86ff2a2e5efd
Problem it solves: Puts the product in a hand next to the signup so the user knows what they are waiting for. Headline "Get on the waitlist", one sentence, email field, black button, privacy line.
What we borrow: Object-in-hand next to the field; four-part stack (headline, sentence, field, button) with nothing else.
What we explicitly reject: Generic phone mock-up and the "Get early access" button label (our CTA string is fixed).
How it becomes NYC-MON (not a clone): An H-Lynk Core held in a hand, photographed on a street, beside the field. If no such photo exists by Phase 6, use the H-Lynk static capture; do not use a generic device.
Used in phase: 6

### WAITLIST — Rains — early access over a full-bleed photo (counter-example on countdowns)
Source: https://mobbin.com/sites/sections/6efdded0-c82c-47c3-b304-4cba52056fb6
Problem it solves: Seasonal early access over a dark full-bleed product photo, with a days/hours/minutes/seconds countdown, email, country select, consent text and a pill button.
What we borrow: Full-bleed real photograph behind the conversion moment.
What we explicitly reject: The countdown (contract asks for a countdown-free waiting state and we have no launch date), the extra country field, white pill inputs.
How it becomes NYC-MON (not a clone): If the waitlist sits on a photograph, it is a night NYC street that carries on from the hatch band, and the form stays a single field.
Used in phase: 6

### WAITLIST — Sketch — "Sketch 102 is coming" email field with a required consent checkbox (Phase 6 search)
Source: https://mobbin.com/sites/sections/a1261905-a6ea-49f0-975e-1c72f23d5ace
Problem it solves: A notify-me block above Sketch's footer: a small clock icon, "Sketch 102 is coming", one line about early access, one email field ("Your email address") with a "Notify me" button, and under them a checkbox labelled "I agree to receive educational emails from Sketch." on a light background.
What we borrow: One field, one button and one checkbox with its own full-sentence label, on a light surface.
What we explicitly reject: The decorative scatter icons, the placeholder as the only label, and using the checkbox for marketing consent.
How it becomes NYC-MON (not a clone): The checkbox is the required "I'm 13 or older" under a legend "Age", with the parent-or-guardian line as its description. The button reads "Join the waitlist". Results are announced in one live line under the button.
Used in phase: 6

### WAITLIST — Hotjar — confirmation that repeats the submitted email (Phase 6 search)
Source: https://mobbin.com/screens/5da1b53c-e17b-4153-9beb-0859bb07cd69
Problem it solves: A post-submit card: a small night-sky illustration, "Thanks for applying to our research!", body text naming the address it will write to in bold ("preview@email.com"), and a "Send to another email" link.
What we borrow: The confirmation replaces the form in place and says exactly what happens next.
What we explicitly reject: The exclamation-mark heading, the evaluation language, the illustration. Repeating the address: the action drops the email from page state once the server confirms (ADR 0001 posture), so the joined state doesn't echo it.
How it becomes NYC-MON (not a clone): "You're on the list." takes focus and says one email comes when the app is out. The retryable states (invalid, rate limited, error) keep what the person typed.
Used in phase: 6

## FOOTER

### FOOTER — BAGGU — giant wordmark close
Source: https://mobbin.com/sites/sections/ddfad441-10db-4949-9baa-299e7e0edeee
Problem it solves: Ends the page with the brand name set edge to edge in heavy black sans under a compact link block and a strip of street photos.
What we borrow: Wordmark at full width as the last thing on the page; links kept small above it.
What we explicitly reject: The repeated "Follow" photo strip and the newsletter duplicate of our main CTA.
How it becomes NYC-MON (not a clone): `SiteFooter` closes with the NYC-MON wordmark (existing logo, never recoloured) at full width over concrete, with nav links in Space Grotesk above. One waitlist entry point on the page, not two forms.
Used in phase: 6

### FOOTER — IKEA — skyline-silhouette scene
Source: https://mobbin.com/sites/sections/f2ea86b3-6d24-44f5-bac5-20f1f0e56912
Problem it solves: A footer that is a scene: room furniture drawn as a single-colour silhouette band sitting on the footer's solid colour.
What we borrow: A single-colour silhouette band as the transition into the footer.
What we explicitly reject: Furniture subject, blue/yellow brand colours.
How it becomes NYC-MON (not a clone): The existing `SkylineBand` / `SkylineDivider` port plays this role: block-level building silhouettes (water towers, fire escapes, a bodega awning) in signage black on concrete, sitting on the footer.
Used in phase: 6

### FOOTER — General Intelligence Company — pixel-art New York scene as the footer band (Phase 6 search)
Source: https://mobbin.com/sites/sections/0222c241-b0da-45eb-a95e-7ba703270a5d
Problem it solves: A footer with a thin top row of text links, a "Get updates in your inbox" field and social icons, then a wide pixel-art band of a park path with lamp posts, joggers and a dog, Manhattan towers at the vanishing point, and the legal line in small text on the band.
What we borrow: A static, wide city scene as the last band of the page.
What we explicitly reject: The second email field (the waitlist already has one), the pastel palette, people and animals in the scene.
How it becomes NYC-MON (not a clone): The kit SiteFooter on ink with the static Harlem `SkylineBand` and no animated canvas (PS-025).
Used in phase: 6

## Non-Mobbin

### SIGNAGE — Standards Manual — NYCTA Graphics Standards Manual (Vignelli, Noorda / Unimark)
Source: https://standardsmanual.com/
Problem it solves: The reference for New York transit sign logic.
What we borrow: What the fetched page confirmed: the 1970 NYCTA Graphics Standards Manual, "Designed by Massimo Vignelli and Bob Noorda, Unimark", and a quoted essay about Helvetica. The page itself did not describe route discs, black band signs or sign modules, so this card does not claim those details from it.
What we explicitly reject: Helvetica as a third family. The contract fixes Archivo Black + Space Grotesk.
How it becomes NYC-MON (not a clone): Borrow the system logic (one sign, one message; place name large, metadata small; a fixed set of colours tied to routes) and apply it with our two families and district colours. Anyone citing specific sign dimensions or band specs from the manual must check the manual itself first.
Used in phase: 3

### HERO — Nintendo — campaign carousel led by a cast image
Source: https://www.nintendo.com/us/
Problem it solves: Leads with a game's cast as key art. Fetched 2026-10-07: the hero is a four-slide carousel; slide 1 is Fire Emblem: Fortune's Weave, alt text "Cai, Dietrich, Theodora, and Leda" around two cloaked figures. Slides carry no overlay headline in the captured text.
What we borrow: Cast-as-hero for a character game; characters introduced by name.
What we explicitly reject: The rotating carousel (hides three of four messages, motion without a purpose) and the store-grid sections below it.
How it becomes NYC-MON (not a clone): One static hero composition; starters introduced by name later in STARTERS, not rotated in the hero.
Used in phase: 3

### HERO — PlayStation — one headline, one CTA per campaign
Source: https://www.playstation.com/en-us/
Problem it solves: Fetched 2026-10-07: seven-slide hero carousel, each slide with one headline and one CTA, e.g. "Return to Ezo" / "Buy now" (Ghost of Yōtei), "Discover the Everywhen" / "Pre-order now".
What we borrow: Short place-led campaign headlines ("Return to Ezo") that name a world instead of describing features. Exactly one action per message.
What we explicitly reject: The carousel and the "Tap repeatedly" interactive gimmick.
How it becomes NYC-MON (not a clone): Hero headline directions in the audit's copy ladder should test against this bar: a short line that names New York as the world, plus `Join the waitlist`.
Used in phase: 3

### H-LYNK — Apple — iPhone campaign page (fetched URL resolved to the iPhone lineup content)
Source: https://www.apple.com/iphone-17-pro/
Problem it solves: Fetched 2026-10-07. The returned content was the iPhone lineup page: hero cards "iPhone Duo" / "Hello, hello." and "iPhone 18 Pro" / "Pro further.", with the 18 Pro image described as a side view that "slides over a giant text saying PRO".
What we borrow: Product name plus two or three words; hardware shown in a physical pose over giant type.
What we explicitly reject: The upgrade-leasing strip, the lineup card grid, multiple CTAs per card.
How it becomes NYC-MON (not a clone): The H-Lynk Core capture can sit over "H-LYNK" set huge in Archivo Black behind it, with one short line. Verify the live page before quoting it further; the fetched URL did not return a page specific to iPhone 17 Pro.
Used in phase: 4
