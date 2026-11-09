# Native Specs Rive visual integration contract

Reuse the existing NYC-MON Rive design, especially packages/assets/rive/hatch-evolve/scene.gen.mjs and build/hatch-evolve.riv. Hatch artboard view model Hatch has stir, crack, burst, reveal triggers; intensity and reducedMotion inputs.

A native Lens does NOT run React Native's Rive runtime or render an arbitrary .riv file. Export Rive art into native Lens Animated Textures/atlases; register the resulting textures with ViroSpecsAssetRegistry. This export is not completed here. Do not use a WebView.

## Care meters
Provide SqueakletCare Rive artboard, with an independently animated ring per Energy, Fullness and Social in original NYC-MON orange/cream HUD colors. Inputs: energy, fullness, social numbers 0..100; reducedMotion boolean; carePulse trigger. No new HP/sickness/death or streaks.
Export transparent images for each meter at 0,10,20,...100 using logical Lens asset keys:
- rive/energy/{value}
- rive/fullness/{value}
- rive/social/{value}
Exact percentages stay as native Lens Text. Lower values should be distinct but not flash red. Register all 33 gauge textures.

## Fifteen-second reveal
Original phases: stir, pressure, crack (three fracture beats), burst, emerge, first-look attention. Specs timeline: 2200+1700+3500+800+3300+3500 = 15000 ms. Register the Rive exports:
- rive/hatch/crack
- rive/hatch/burst
- rive/hatch/emerge
Prefer an optimized animated texture or atlas per beat and respect 21-frame / 350ms bloom ramp. Reduced motion retains 15s duration with calm fades, no flashing.

## Validation
Asset IDs in src/specs.mjs and lens/SqueakletLensScene.ts are scene contracts, not already imported resources. Lens Preview/LEAF and real SPECS 27 must verify correctly sized imported prefab/texture visuals, SIK pinch hit targets, contrast, motion, voice, thermal and memory budgets before calling this hardware-ready.
