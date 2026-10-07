# Premium site audit — W01 home

Written 2026-10-07 for the homepage redesign PR. Method: the AppLlama
"study before you draw" loop — pull real shipping screens, extract the
skeleton and the hierarchy, reject the pixels — applied to Mobbin results
and MotionSites composition categories, then mapped onto the existing W01
contract (`docs/design/screens/W01/08-handoff.md`), canon
(`docs/canon/DECISIONS.md`) and the daylit system (`docs/DESIGN_SYSTEM.md`).

## What the current page gets wrong

The W01 structure is sound (seal right, live district city, dark hatch
band), but the emotional load is carried by paragraphs inside UI plates:

- The hero reads as a settings card over a tech demo: `SolidPanel` holding
  eyebrow + h1 + body + CTA + starter list + district picker all in one
  daylit slab. Nothing on the first screen is at key-art scale.
- There is zero photography on the page, so "Mons live in New York" is a
  claim, not a feeling. The city render is the only image-like surface.
- The H-Lynk section is a caption next to a viewer, not a launch moment.
- Starter cards are a Badge + three lines of text — no visual identity per
  starter, nothing that reads as a character introduction.
- Care is a dashboard of meters, not a relationship.
- The hatch band ends the page with a paragraph, no closing CTA.

## References studied (Mobbin)

### Tolan — home / companion screens
(<https://mobbin.com/screens/9e064fe9-0cf0-4809-a4d8-cd8c359b4a80> and the
Tolan result set)

- **PATTERN TO TAKE:** The character IS the screen. The Mon-scale alien sits
  in the middle of a full-bleed world with almost no chrome; UI shrinks to
  three glyph buttons at the bottom edge. Presence before features.
- **PATTERN TO REJECT:** Tolan's pastel blob-world aesthetic and its
  daily-affirmation card floats — soft, rounded, weightless. Wrong city.
- **HOW IT MAPS TO NYC-MON:** Our equivalent of "character as screen" is the
  city itself plus the seal: the hero drops the copy slab and lets the live
  district render + the NYC-MON seal carry the frame, with copy set
  directly on the scene at display scale. Starter cards get a dominant art
  region so each Mon is introduced as a character, not a spec row.

### Tolan onboarding ("INTRODUCING / Sam")
(<https://mobbin.com/screens/ad5eb3a4-8f47-4922-901f-e0d8ba1f7036>)

- **PATTERN TO TAKE:** Tiny quiet eyebrow + one enormous name + the
  character filling the frame + a single CTA. A naming beat, not a form.
- **PATTERN TO REJECT:** The serif/display pairing and the lone pill
  arrow — wrong type system and wrong CTA shape for NYC-MON.
- **HOW IT MAPS TO NYC-MON:** Each starter card becomes a character
  introduction: art region first, Baby name in Archivo Black, then Dex ID /
  Bloodline / egg source as quiet annotations — name and image do the
  selling, not paragraphs.

### Companion onboarding set (Replika, Gentler Streak, Alan, Yazio, BitePal)
(<https://mobbin.com/screens/c2f6ff68-5dba-4aa9-97dd-167f7fe04602> et al.)

- **PATTERN TO TAKE:** One character, one line, one button per step —
  emotional pacing with nothing else competing.
- **PATTERN TO REJECT:** Mascot-cute copy, sticker doodles, progress bars
  that gamify onboarding. We do not gamify care and we do not decorate
  around the Mon.
- **HOW IT MAPS TO NYC-MON:** The hatch gets this pacing: quiet night, one
  image, one line of consequence, one CTA. Nothing else in the section.

### ZARA — editorial web homepage
(<https://mobbin.com/screens/50c1c674-21c3-4bf5-938a-7d759bc4b3fb>)

- **PATTERN TO TAKE:** Display type at a size that overlaps the image;
  interface text reduced to marginalia. Hierarchy by scale alone.
- **PATTERN TO REJECT:** The fashion-left whitespace and thin serif voice.
- **HOW IT MAPS TO NYC-MON:** The hero headline and the WORLD section
  headline run at key-art sizes in Archivo Black; location labels drop to
  small uppercase annotation type — the MTA-signage pairing of huge
  destination + tiny metadata.

### H&M — campaign strip
(<https://mobbin.com/screens/6dcf8042-82a6-4397-9358-aa80eb242a6f>)

- **PATTERN TO TAKE:** Full-bleed photography with a two-word caption row
  and nothing else. The image does the work.
- **PATTERN TO REJECT:** Commerce framing (shop-the-look arrows).
- **HOW IT MAPS TO NYC-MON:** WORLD images carry only a district name and a
  street-level place line — "Harlem / Brownstone row," not feature copy.

### Revolut Business — hardware-adjacent hero
(<https://mobbin.com/screens/d50e648a-f8c0-465b-becf-2260bf571b15>)

- **PATTERN TO TAKE:** A physical card on a geometric plinth in a dark,
  lit stage — the object reads expensive because the stage is quiet.
- **PATTERN TO REJECT:** The SaaS headline + description + pill CTA stack.
- **HOW IT MAPS TO NYC-MON:** The H-Lynk section stages `DeviceStage` like a
  hardware reveal: the unit settles into frame on scroll, the scanner-head
  moment lands, and feature lines appear beside it — not a paragraph with a
  demo attached.

### Luma — "Introducing Ray2" full-bleed still
(<https://mobbin.com/screens/d59cde38-a64d-441e-b467-f3ed30d6f7e9>)

- **PATTERN TO TAKE:** One cinematic frame edge-to-edge; product text
  confined to a strip below. Image confidence.
- **PATTERN TO REJECT:** The AI-video content itself.
- **HOW IT MAPS TO NYC-MON:** WORLD's lead image and the hatch photograph
  get true full-bleed or near-full-bleed treatment inside the section, with
  copy kept out of the frame.

### Curater — dark spotlight reveal
(<https://mobbin.com/screens/79720071-7be0-4cb7-8413-9e387aa97788>)

- **PATTERN TO TAKE:** A single lit object in a black field, one small
  status chip. Restraint as drama.
- **PATTERN TO REJECT:** The abstract dot-object and "SOON" SaaS waitlist
  framing.
- **HOW IT MAPS TO NYC-MON:** The hatch: night plate, one image, one orange
  accent, large quiet type, the repeated waitlist CTA.

### Visual Electric — collage hero
(<https://mobbin.com/screens/7227285b-1e87-4628-b822-ca1adca474e3>)

- **PATTERN TO TAKE:** Asymmetric image collage around a centred headline —
  the layout itself is the energy.
- **PATTERN TO REJECT:** The scatter density and floating UI chips — visual
  noise.
- **HOW IT MAPS TO NYC-MON:** WORLD uses asymmetric offset composition (one
  dominant frame, smaller frames stepping off-axis), not a bento grid and
  not an even card row.

## MotionSites.ai — motion composition only

MotionSites' library (reveal heroes, pinned 3D scroll scenes, image
carousel choreography) was used strictly for **choreography grammar**:

- **PATTERN TO TAKE:** Authored hero entrances (elements arrive in a
  deliberate order: environment, then headline, then mark, then action);
  scroll-scrubbed image parallax at differing depths; a short pinned or
  scrubbed product moment; sections that *settle* rather than pop.
- **PATTERN TO REJECT:** The house style — gradient meshes, glass cards,
  floating 3D blobs, text-scramble reveals, marquee-everything, and pinning
  that runs for screens. None of it ships here.
- **HOW IT MAPS TO NYC-MON:** The motion vocabulary is four moves: the hero
  settles (city → headline → seal → CTA), world images drift at different
  parallax rates on transform only, the H-Lynk settles once as its copy
  steps in, and the hatch stays almost still so the dark reads louder.

## Anti-slop check applied

Per `docs/design/screens/W01/03-direction.md` and the brief: no purple/blue
AI gradients, no glass-card soup, no bento, no sparkles, no stat counters,
no fake terminals, no per-paragraph fade-ups, no tilt-card template moves.
The visual system stays: concrete daylit neutrals, signage black, NYC-MON
orange as CTA/hatch accent only, H-Lynk red, night for city + hatch,
Archivo Black display + Space Grotesk text, square keylines and poster
plates. The premium feeling comes from scale, photography, spacing and a
small authored motion vocabulary — not from effects.

## Measured results (post-implementation, production build on :3100)

Lighthouse 12, headless Chrome:

| metric | desktop | mobile (devtools throttle) | mobile (simulated) | unthrottled |
|---|---|---|---|---|
| Performance | **98** | 79 | 75 | **100** |
| Accessibility | 99 | 99 | 99 | — |
| Best practices | 100 | 100 | 100 | — |
| SEO | 100 | 100 | 100 | — |
| LCP | 1.0 s | 1.0 s | 5.1 s* | 0.1 s |
| CLS | 0.00 | 0.00 | 0.00 | 0.046 |
| TBT | 30 ms | 750 ms | 300 ms | 30 ms |
| Speed Index | 0.9 s | 4.6 s | 2.9 s | 0.6 s |

\* The simulated run models LCP pessimistically; under real DevTools
throttling the hero image paints at ~1.0s. Mobile SI is bounded by the
deferred WebGPU `CityBlocks` scene (lazy-mounted by design — see
`PREMIUM_SITE_MOTION.md` §5); a static skyline poster under the canvas is
the listed follow-up that buys that score back.

Fixes landed during measurement: RNW atomic base classes mirrored into
`globals.css` (the nav stacked its links 378px→114px pre-hydration — the
site's only CLS, now 0), `CityBlocks` moved to a `next/dynamic` chunk,
hero entrance made transform-only + never-pre-hidden, hero image given an
explicit preload + `fetchPriority`, both brand fonts moved to
`display: optional`.
