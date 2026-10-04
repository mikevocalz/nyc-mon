// NeonBlade card and control ports: tones, frames and the card slider.
// The variants themselves live on the kit components (Card, Button,
// IconButton, TextField, Textarea, Select, Checkbox, Switch).
export {
  resolveTone, toneHex, toneInput, DISTRICT_TONE, DISTRICT_NAME, DISTRICTS, CONTROL_TONES, TONE_CLASSES,
  type ControlTone, type ToneHex, type ToneClasses,
} from './tones';
export { notchPolygon, notchClipPath, DEFAULT_NOTCH, type NotchSide, type NotchShape } from './notch';
export { NotchFrame, type NotchFrameProps } from './NotchFrame';
export { BeamFrame, type BeamFrameProps, type BeamVariant } from './BeamFrame';
export { CardSlider, type CardSliderProps, type CardSliderProgressStyle } from './CardSlider';
export { visibleFor, sliderMetrics, type VisibleCount } from './card-slider-model';
