// Re-export shim: control tones live in ../district. `resolveTone` here keeps
// the control signature (tone, district); the shared module calls it resolveControlTone.
export {
  DISTRICTS, DISTRICT_NAME, DISTRICT_TONE, CONTROL_TONES, TONE_CLASSES,
  resolveControlTone as resolveTone, toneHex, toneInput, toneVariants,
  type ControlTone, type District, type ToneClasses, type ToneHex,
} from '../district/index.ts';
