// NeonBlade card and control ports: frames and the card slider. Tones live in ../district.
// The variants themselves live on the kit components (Card, Button,
// IconButton, TextField, Textarea, Select, Checkbox, Switch).
export { notchPolygon, notchClipPath, DEFAULT_NOTCH, type NotchSide, type NotchShape } from './notch';
export { NotchFrame, type NotchFrameProps } from './NotchFrame';
export { BeamFrame, type BeamFrameProps, type BeamVariant } from './BeamFrame';
export { CardSlider, type CardSliderProps, type CardSliderProgressStyle } from './CardSlider';
export { visibleFor, sliderMetrics, type VisibleCount } from './card-slider-model';
