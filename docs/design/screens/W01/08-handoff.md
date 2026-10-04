# W01 Home: handoff

Skill: `design:design-handoff`. The implementation contract. Inputs: 01–07, D12 in `docs/design/DECISIONS.md`.

## Files

| Path | What |
|---|---|
| `apps/web/app/(site)/page.tsx` | Server page: metadata, renders `HomePage` |
| `apps/web/components/home/HomePage.tsx` | Section order, `Main` landmark |
| `apps/web/components/home/HomeHero.tsx` | Client: district store, SceneSection + CityBlocks, plate, seal |
| `apps/web/components/home/HLynkSection.tsx` | h2, copy, `DeviceStage` |
| `apps/web/components/home/StartersSection.tsx` | Cards from `@acme/content` |
| `apps/web/components/home/CareSection.tsx` | Three meters, three verbs |
| `apps/web/components/home/HatchBand.tsx` | The dark band |
| `apps/web/components/home/copy.ts` | Every string in `05-copy.md` |
| `apps/web/components/DeviceStage.tsx` | §5 path. `ThreeCanvas` + figure + static capture |
| `apps/web/components/home/device-scene.ts` | three/webgpu scene, loaded on demand |
| `apps/web/public/home/h-lynk-core.png` | Static capture of the scene |
| `packages/ui/LinkButton.tsx` + story | NEW kit: Button's face inside an `<a>` |
| `packages/ui/neon/SolidPanel.tsx` + story | NEW tone `page`: daylit plate in light, night in dark |
| `apps/web/components/site/nav.ts` | `showsSiteChrome` stops excluding `/` |

## Layout

Container: `mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8`. Section rhythm `py-16 md:py-24`.

| Width | Hero | H-Lynk | Starters | Care |
|---|---|---|---|---|
| 390 | stacked: seal 208 then plate | stacked, stage 4:5 | 1 column | 1 column |
| 768 / 884 | 2 columns (plate 7/12, seal 5/12), seal 280 | 2 columns | 3 columns | 3 columns |
| 1280 / 1440 | seal 360 | 2 columns | 3 columns | 3 columns |

Hero minimum height `min-h-[640px] md:min-h-[78dvh]`; the scene holds that space before it draws (no CLS).

## States

| State | Behaviour |
|---|---|
| First paint | Server HTML: plate text, CTA, starters, seal, every section's text. Canvases absent |
| After LCP | CityBlocks mounts (SceneSection near-viewport). DeviceStage mounts when its section is within 600 px |
| Offscreen | Both canvases paused |
| Reduced motion | DeviceStage renders the static capture `img`, no canvas. City still, no traffic |
| No WebGPU / WebGL2 | `ThreeCanvas` `fallback` = the static capture |
| No JS | `noscript` capture inside the figure; city absent; page reads complete |
| District change | `useDistrictStore.setDistrict`; CityBlocks and both dividers follow |

## DeviceStage (H-Lynk Core placeholder)

Units are body widths. Body 1.0 × 1.78 × 0.16, `hlynk.core.body` matte. Scanner head: black box across the top, 0.86 × 0.14, two red emissive lenses (`led.on`); a red additive fan plane above it at 22% opacity. Antenna stub top-left, black, 0.06 × 0.14. Screen: black bezel 0.84 × 1.08, inner screen 3:4 (0.75 × 1.0) dark night glass. Control row: four black keys 0.11 square and a 0.24 square trackpad with an `hlynk.core.ring` ring. Side keys as small black extrusions (two each side). Idle yaw ±18° over 9 s; pointer tilt clamped to 8°. Camera 35° FOV; one key light, one rim, ambient. `maxPixelRatio` 1.5.

## Motion

Only the two canvases move. No section entrance animations. CTA press is the kit's.

## Test IDs

`w01-hero`, `w01-cta`, `w01-district`, `w01-hlynk`, `w01-device-stage`, `w01-starters`, `w01-care`, `w01-hatch`.

## Acceptance

`tsc` and `eslint` clean for `apps/web`; Storybook Vitest green for the new stories; `next build` clean, no `requestAnimationFrame` error from `/`; Lighthouse mobile performance ≥ 95 and accessibility ≥ 95 on `/`; screenshots at 390, 768, 884, 1280 and 1440 in light and dark with no horizontal scroll.
