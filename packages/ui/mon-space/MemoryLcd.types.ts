import type { LcdLayerSpec } from './lcd-layer';

/** Where the 3D Mon is: drawn as the dithered sprite on the LCD, or full-colour 3D in front of it. */
export type MonPlacement = 'inLcd' | 'out';

/** The Mon the LCD shows. Changing `placement` plays the step in or out. */
export interface MemoryLcdMon {
  /** A species model key the 3D Mon loader knows (e.g. `squeaklet`). */
  readonly modelKey: string;
  readonly placement: MonPlacement;
  /** An animation clip present in the model's GLB; unset plays the idle clip. */
  readonly clip?: string;
}

/** The attention lamp. Both lit states use `motion-led-blink-needs-you` (<= 3 flashes a second). */
export type MemoryLcdLed = 'off' | 'call' | 'false-call';

/** Contract section 5 (lane d). */
export interface MemoryLcdProps {
  /** day = reflective paper LCD; night = backlit + bloom on lit pixels and LED only */
  readonly scheme: 'daylit' | 'night';
  /** lights-out */
  readonly inverted: boolean;
  /** ghosting persistence 0, no bloom pulse, no step-in/out tween */
  readonly reducedMotion: boolean;
  /** bloom off */
  readonly reduceTransparency?: boolean;
  /** The 3D Mon. `inLcd` = drawn as the dithered LCD sprite; `out` = full-colour 3D in front. Transition is the step in/out. */
  readonly mon: MemoryLcdMon | null;
  /** 2D layer the screen draws in LCD pixels (icons, poop, hearts, segment numerals): passed as a draw spec, not RN views. */
  readonly layer: LcdLayerSpec;
  /** uses led-rhythm.ts tokens, <= 3 flashes/s */
  readonly led: MemoryLcdLed;
  /** Called with the frame's CPU ms when a frame runs over the A12X budget (16.7 ms). */
  readonly onFrameBudgetExceeded?: (ms: number) => void;
  /** Accessible name for the LCD; the screen's real text carries the content. Unset = decorative. */
  readonly accessibilityLabel?: string;
  /** Web only, for stories and tests: WebGPURenderer's WebGL2 backend. */
  readonly forceWebGL?: boolean;
  readonly className?: string;
}
