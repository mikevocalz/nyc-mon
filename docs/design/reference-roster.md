# Reference roster

Verbatim from `docs/phase-1-brief.md` §0A.1. The quality bar and the primary-source documentation to consult for each area of the stack — creator / spec-author tier only. When a decision falls in a domain, cite the source its author would cite.

```text

RENDERING — three.js creator / renderer-core tier (Ricardo Cabello "mrdoob", Michael Herzog "Mugen87"):
  WebGPURenderer internals, TSL node materials, AnimationMixer semantics, the r16x+
  WebGPU migration. Source: https://threejs.org/docs/ · https://github.com/mrdoob/three.js
  · TSL wiki https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language

GPU API / TYPED SHADERS — TypeGPU spec-author tier (Software Mansion):
  typed buffers, bind groups, WGSL via `tgpu`, compute pipelines, `@typegpu/three` interop.
  Source: https://docs.swmansion.com/TypeGPU/

RN GRAPHICS BOUNDARY — react-native-webgpu creator tier (William Candillon):
  the WebGPU surface in RN, Metro resolver for `three/webgpu`, frame pacing.
  Source: https://github.com/wcandillon/react-native-webgpu

2D GPU UI — React Native Skia creator tier (Candillon, Shopify):
  Skia for meters, rings, HUD, streak calendar — never for the creature.
  Source: https://shopify.github.io/react-native-skia/

REACT NATIVE / EXPO — Expo SDK core-architect tier (Evan Bacon, Brent Vatne; Fernando Rojo for
  Expo Router + cross-platform routing). New Architecture only. Source: https://docs.expo.dev/

NATIVE BOUNDARY — Marc Rousavy tier (Nitro Modules / JSI; react-native-vision-camera author).
  Any native code is written with a Margelo react-native-skill loaded (§2.7).
  Source: https://nitro.margelo.com/ · https://github.com/margelo/react-native-skills

STATE & DATA — Daishi Kato tier (Zustand) · Colin McDonnell tier (Zod) · Marc Rousavy tier (MMKV).
  Source: https://zustand.docs.pmnd.rs/ · https://zod.dev/ · https://github.com/mrousavy/react-native-mmkv

WEB — Next.js core tier (Guillermo Rauch, Tim Neutkens) · Tailwind creator tier (Adam Wathan).
  Source: https://nextjs.org/docs · https://tailwindcss.com/docs

DESIGN — a Pentagram-partner-tier identity designer; a Studio Dumbar / Kinetic-type motion
  designer; a Collins-tier brand systems lead. Reference craft: https://activetheory.net/ ·
  https://lusion.co/ · https://14islands.com/

GAME DESIGN — Bandai WIZ virtual-pet design tier (Tamagotchi, 1996– ; "care is the game") ·
  Game Freak starter-design tier (Ken Sugimori lineage: three starters, one silhouette each,
  readable at thumbnail scale) · Kazuo Ikeda-tier creature animator (personality in idle).

ACCESSIBILITY — WCAG 2.2 working-group tier. Source: https://www.w3.org/TR/WCAG22/ ·
  Apple HIG https://developer.apple.com/design/human-interface-guidelines/

NARRATIVE — the NYC-MON Bible v11 is the showrunner. You do not invent canon. Ever.
```

## Marketing site (W01 premium redesign)

Added 2026-10-07 for the premium site redesign; this is the one roster, so the site work cites this file. The question for each decision: would the person who wrote the spec, library, or standard sign off on this exact file. "Senior" and "principal" are below the bar.

| Domain | Bar | Rejected on sight |
|---|---|---|
| RSC / App Router | Sebastian Markbåge, Tim Neutkens | A section made `"use client"` for convenience; hydration-dependent layout; `next/image` without real dimensions; client fetch of data the server had |
| Authored motion (GSAP / ScrollTrigger) | Jack Doyle | Two RAF clocks; ScrollTriggers without `kill()` on cleanup; no `refresh()` after layout-affecting mounts; pinning that moves content on mobile; motion with no nameable purpose |
| Smooth scroll (Lenis) | darkroom.engineering (Clément Roche) | Lenis auto-RAF alongside the GSAP ticker; touch smoothing that fights native scroll; ignoring `prefers-reduced-motion` |
| Kinetrell | Mike W. Allen; the pinned version is the spec | Any API absent from the installed source; a second GSAP/Lenis abstraction beside it |
| three.js / WebGPU | Ricardo Cabello; Renaud Rohlinger and sunag (WebGPURenderer / TSL); WebGPU WG editors Kai Ninomiya, Corentin Wallez, Brandon Jones | A canvas as LCP; uncapped DPR; a render loop running offscreen; R3F; no WebGL fallback; UA-string feature detection |
| CSS layout | Rachel Andrew, Jen Simmons, Miriam Suzanne | Masonry JS or measured layout for bento; grid order that breaks mobile reading order; `100vh` on mobile; spacing outside `packages/theme` |
| Responsive images | Eric Portis | Desktop hero bytes on a 390px phone; missing or lying `sizes`; hotlinked stock |
| Web performance | Philip Walton, Annie Sullivan, Barry Pollard | One cherry-picked Lighthouse run; React state on RAF; long tasks during hero paint; font CLS |
| Accessibility | Alastair Campbell (WCAG 2.2 editor); Adrian Roselli, Léonie Watson, Sara Soueidan, Heydon Pickering; Val Head for motion | Drag-only controls; hover-only information; focus under the sticky nav; state by color alone; wrong alt ownership; parallax surviving reduced motion |
| Interface craft | Rauno Freiberg, Emil Kowalski | Springs on marketing copy; everything fading up; hover tilt on text; letter-by-letter gimmicks |
| Type and signage | Massimo Vignelli (NYCTA Graphics Standards Manual, https://standardsmanual.com/); Michael Bierut | A third face; tiny caps labels everywhere; signage that reads as a crypto ticker; a serif "for luxury" |
| Component vocabulary | NeuronRush (NeonBlade UI); the `@acme/ui` NYC-Tron port is canonical | NeonBlade installed as a dependency; a second copy of a primitive in app code; glow as a daylight border habit |
| State | pmndrs (Zustand); React 19 `useActionState` / `useOptimistic` for the waitlist only | Bare `useState` / `useReducer` |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | `any`; non-exhaustive unions for section and art-slot ids; skipping `tsc --noEmit` |

Primary sources: WCAG 2.2 https://www.w3.org/TR/WCAG22/ · Target Size 2.5.8 https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · Animation from Interactions 2.3.3 https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html · Web Vitals https://web.dev/articles/vitals (LCP, INP, CLS under /articles/) · `prefers-reduced-motion` and `content-visibility` on MDN · RSC https://react.dev/reference/rsc/server-components · `next/image` https://nextjs.org/docs/app/api-reference/components/image · ScrollTrigger https://gsap.com/docs/v3/Plugins/ScrollTrigger/ · Lenis https://github.com/darkroomengineering/lenis · WebGPU https://www.w3.org/TR/webgpu/ · Kinetrell https://github.com/mikevocalz/Kinetrell · axe-core https://github.com/dequelabs/axe-core · Playwright https://playwright.dev/ · Lighthouse CI https://github.com/GoogleChrome/lighthouse-ci · Mobbin https://mobbin.com

## City data (dataset v3)

### Engineers (creator / spec-author tier)

| Domain | Bar | Source |
|---|---|---|
| Valdrada tile format, compiler, overrides | Mehmet Kerem Turkcan, Valdrada author | https://github.com/mkturkcan · docs: https://mkturkcan.github.io/valdrada/ |
| Geodesy and projection | Charles Karney, GeographicLib (the memory-standard "GeographicLib-level geodesy") | https://geographiclib.sourceforge.io/ |
| Polygon triangulation and simplification | Volodymyr Agafonkin, earcut author. three's `ShapeUtils.triangulateShape`, which `city-mesh.ts` L64 uses, is its port (`three/src/extras/Earcut.js`) | https://github.com/mourner · https://github.com/mapbox/earcut |
| Geometry upload, `BufferGeometry` merge, WebGPURenderer | Ricardo Cabello (https://github.com/mrdoob), Michael Herzog (https://github.com/Mugen87), sunag (https://github.com/sunag), Renaud Rohlinger (https://github.com/RenaudRohlinger) | https://threejs.org/docs/ |
| Schema and parse boundary | Colin McDonnell (Zod) | https://zod.dev/ |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | `tsc --noEmit` |
| Native boundary (only if §6.6 triggers) | Marc Rousavy | https://github.com/mrousavy · https://nitro.margelo.com/ |
| Simulator asset lineage (models Valdrada ships; not imported here) | CARLA Simulator team | https://carla.org/ |

### Designers

| Name | Why they are the bar | Source |
|---|---|---|
| Massimo Vignelli (roster) | NYC street-information discipline: transit and signage placement must be true to the street | https://standardsmanual.com/ |
| Michael Bierut, Pentagram (roster) | WalkNYC: legible NYC street furniture and wayfinding | https://www.pentagram.com/work/walknyc |
| Kevin Lynch | *The Image of the City*. Paths, edges, districts, nodes and landmarks are the test for whether v3 Harlem reads as Harlem | https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ |
| Justin K. Thompson | Stylised NYC that stays recognisable (Spider-Verse production design) | https://www.cartoonbrew.com/feature-film/spider-man-into-the-spider-verse-production-design-is-about-character-not-style-168137.html |
| Syd Mead | The "futuristic touch" layered on a real city without erasing it | https://sydmead.com/ |

### Design agencies

| Agency | Take | Source |
|---|---|---|
| Pentagram | WalkNYC system thinking for furniture, credit and map UI | https://www.pentagram.com/ · https://www.pentagram.com/work/walknyc |
| Sony Pictures Imageworks | Stylised-NYC production reference | https://www.imageworks.com/node/1371 |
| Chromosphere | Flat-shape city colour scripting | https://chromosphere.studio/ |

### Dev agencies

| Agency | Role here | Source |
|---|---|---|
| Software Mansion | TypeGPU and the cel body the city renders through | https://swmansion.com/ |
| Callstack | Measured bundle, TTI and frame cost of the bigger dataset | https://www.callstack.com/ · https://github.com/callstackincubator/agent-skills |
| Margelo | `api-design` on exported `@acme/*` surfaces; native only behind §6.6 | https://margelo.com/ · https://github.com/margelo/react-native-skills/tree/main/skills |
| Utsubo | WebGPU/TSL production work | https://www.utsubo.com/ |
| Active Theory · Lusion · 14islands (roster) | Real-time city craft bar | https://activetheory.net/ · https://lusion.co/ · https://14islands.com/ |

### Rejected on sight

- Shipping or streaming Valdrada's raw tiles on the phone.
- Offsetting and scaling Valdrada metres into nyc-mon metres without unprojecting first.
- Dropping Valdrada's read-time overrides (that drop puts the Hotel Theresa on the wrong footprint).
- A procedural flag recorded as a fact.
- Importing Valdrada's GLSL materials or its photoreal (MetaHuman) pedestrians.
- Colours outside the palette.

## Slop-grade city (2026-10-26)

Source: `docs/plans/slop-grade-city-prompt.md` §1, copied verbatim.

Judge every decision by one test: would the author of the technique, spec or API sign off on this exact file? Do not use "senior" or "principal" in role framing; those titles are below this bar. The names set a craft standard. They do not imply that anyone listed takes part.

### Engineers (creator / spec-author tier)

| Domain | Bar | Source |
|---|---|---|
| Slop New York, the look target | Ricardo Cabello (mrdoob), three.js creator and Slop's author | https://github.com/mrdoob · https://github.com/mrdoob/slop-newyork |
| WebGPURenderer, TSL, `RenderPipeline`, SSR and bloom nodes, `SunLight`, `ClusteredLighting` | Michael Herzog (Mugen87), sunag, Renaud Rohlinger | https://github.com/Mugen87 · https://github.com/sunag · https://github.com/RenaudRohlinger · TSL wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language |
| RN WebGPU surface, `present()`, Dawn on iOS; React Native Skia 3 on Graphite and the shared device | William Candillon, author of react-native-webgpu and React Native Skia | https://github.com/wcandillon/react-native-webgpu · https://wcandillon.dev/article/hello-graphite-performance |
| Skia Graphite, the 2D backend that shares the device | Google Skia team | https://skia.org/ |
| WebGPU itself | W3C GPU for the Web spec editors; Dawn implementers | https://www.w3.org/TR/webgpu/ · https://dawn.googlesource.com/dawn |
| The GPU underneath (iPhone, iPad) | Apple Metal team | https://developer.apple.com/metal/ |
| Physically based shading | Brian Karis, Naty Hoffman (SIGGRAPH 2013 Physically Based Shading course) | https://blog.selfshadow.com/publications/s2013-shading-course/ |
| PBR in production, light units and exposure | Sébastien Lagarde (Moving Frostbite to PBR) | https://seblagarde.wordpress.com/ |
| Interior mapping (the lit rooms behind Slop's windows) | Joost van Dongen, *Interior Mapping* (2008) | https://www.proun-game.com/Oogst3D/CODING/InteriorMapping/InteriorMapping.pdf |
| Procedural shading, noise, anti-aliased patterns | Inigo Quilez | https://iquilezles.org/ |
| Traffic behaviour (IDM, the model Slop's `traffic.js` names) | Martin Treiber | https://traffic-simulation.de/ |
| City records | Mehmet Kerem Turkcan, Valdrada author | https://github.com/mkturkcan/valdrada |
| TypeGPU interop | Software Mansion TypeGPU team | https://docs.swmansion.com/TypeGPU/ |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | https://www.typescriptlang.org/ |
| Native boundary (only if §6.6 triggers) | Marc Rousavy | https://github.com/mrousavy · https://nitro.margelo.com/ |

### Designers

| Name | Why they are the bar | Source |
|---|---|---|
| Syd Mead | A future layered onto a real city without erasing it: the facelift's test | https://sydmead.com/ |
| Kevin Lynch | *The Image of the City*: paths, edges, districts, nodes and landmarks. The test that the new look still reads as Harlem | https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ |
| Massimo Vignelli | NYC transit information discipline: street signs, chips and wayfinding stay true to the street | https://standardsmanual.com/ |
| Michael Bierut, Pentagram | WalkNYC: the facelift's "upgraded wayfinding" | https://www.pentagram.com/work/walknyc |
| Justin K. Thompson | NYC stylisation that stays recognisable | https://www.cartoonbrew.com/feature-film/spider-man-into-the-spider-verse-production-design-is-about-character-not-style-168137.html |

### Design agencies

| Agency | Take | Source |
|---|---|---|
| Pentagram | WalkNYC system thinking for street furniture, credits and HUD street chips | https://www.pentagram.com/ · https://www.pentagram.com/work/walknyc |
| Territory Studio | Screen graphics for future cities in film: restraint for LED panels and HUD overlays | https://territorystudio.com/ |
| Sony Pictures Imageworks | Stylised-NYC production reference | https://www.imageworks.com/node/1371 |
| Chromosphere | Colour scripting across times of day | https://chromosphere.studio/ |

### Dev agencies

| Agency | Role here | Source |
|---|---|---|
| Software Mansion | TypeGPU, and the worklet runtime the renderer runs on | https://swmansion.com/ |
| Callstack | Measured frame time, TTI and memory; `agent-device` evidence | https://www.callstack.com/ · https://github.com/callstackincubator/agent-skills |
| Margelo | `api-design` on exported `@acme/*` surfaces; native only behind §6.6 | https://margelo.com/ · https://github.com/margelo/react-native-skills/tree/main/skills |
| Utsubo | WebGPU/TSL production work | https://www.utsubo.com/ |
| Active Theory · Lusion · 14islands | Real-time city craft bar | https://activetheory.net/ · https://lusion.co/ · https://14islands.com/ |

### Rejected on sight

- "Fixing" the look by tuning cel bands or colour constants while the output stays linear with no tone mapping.
- Importing Slop's Manhattan geodata (OSM-derived, ODbL, a different area) in place of the Valdrada tile.
- A hex literal outside `packages/theme/tokens.ts`. Slop has hundreds; each one becomes a token or a named physical constant with units.
- DOM APIs (`document.createElement('canvas')`, `localStorage`, Web Audio, `navigator.getGamepads`) carried into the React Native or worklet bundle.
- A device claim backed only by the simulator.
- Flipping a flag to default-on without G8.
- Uniform neon cyberpunk, logos or lettering on LED panels, or invented NYCHA development names.
- A second `RenderPipeline` mount next to `post/pipeline.ts`.
- A second or third GPU device once the shared one passes Phase 0 (G9).
- Slop code without its MIT notice.
- "Should work" without numbers.
