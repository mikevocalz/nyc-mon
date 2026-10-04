// Neon primitives: the shared base for the NeonBlade UI ports.
// Solid shade steps are the primary building block; glow and cut corners
// are accents on top.
export {
  neonColor, neonToken, neonFamily, parseColor, withAlpha, mixColor, NEON_PRESET_TOKENS,
  type NeonColor, type NeonColorInput, type NeonPreset, type NeonToken, type Rgba,
} from './colors';
export { shadeSteps, shadeStepsRgba, type ShadeSteps } from './shade';
export { neonGlow, neonDropShadowFilter, neonTextGlow, GLOW_INTENSITY, type GlowIntensity } from './glow';
export { neonSize, useNeonSize, type NeonSize, type NeonSizeMetrics } from './sizes';
export { cornerCutPolygon, cornerCutClipPath, insetCut, type CutCorner } from './corner-cut';
export { CornerCutFrame, type CornerCutFrameProps } from './CornerCutFrame';
export { SolidPanel, type SolidPanelProps, type SolidTone } from './SolidPanel';
