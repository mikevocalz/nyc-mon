// One district + tone module for the whole kit. Components, charts,
// backgrounds and stories all read districts, tone classes, series colours
// and background themes from here; nothing else declares a district list.
export { DISTRICTS, DISTRICT_NAME, DISTRICT_NAMES, type District } from './districts.ts';
export {
  TONES, CONTROL_TONES, DISTRICT_TONES, DISTRICT_TONE, TONE_CLASSES,
  resolveTone, resolveControlTone, resolveAccent, toneClasses, toneVariants, toneHex, toneInput,
  type Tone, type ControlTone, type ToneClasses, type ToneHex,
} from './tones.ts';
export {
  DISTRICT_CHART_TONE, DISTRICT_LIGHT, districtSeries, districtTone, seriesColor, seriesShades, keylineFor,
  type ChartTone,
} from './series.ts';
export { THEMES, steps, skyBands, type DistrictTheme } from './themes.ts';
