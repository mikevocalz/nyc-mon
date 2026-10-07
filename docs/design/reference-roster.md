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
