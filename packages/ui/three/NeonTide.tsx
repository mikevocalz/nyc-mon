'use client';

import { useMemo, type ReactNode } from 'react';
import { RiverTide } from '../backgrounds/RiverTide';
import { normaliseOpacity } from '../backgrounds/QuadBackground.shared';
import type { NeonColorInput } from '../neon/colors';
import { loadTide } from './tide/load-tide';
import { TIDE_DEFAULT_COLORS, type NeonTideOrigin, type TideOptions } from './tide/tide-config';
import { ThreeCanvas } from './ThreeCanvas';
import type { ThreeBackend } from './types';

export type { NeonTideOrigin };

export interface NeonTideProps {
  /** NeonBlade name: trough colour. Default royal. */
  colorA?: NeonColorInput;
  /** NeonBlade name: crest colour. Default carolina, or `colorA` when only that is set (NeonBlade's single-colour look). */
  colorB?: NeonColorInput;
  /** Specular highlight colour. Default orange; `#ffffff` gives NeonBlade's white. */
  glossColor?: NeonColorInput;
  /** NeonBlade name: clear and fog colour. Default night. */
  bgColor?: string;
  /** NeonBlade name: the waves flow from this corner toward the opposite one. Default top-right. */
  origin?: NeonTideOrigin;
  /** NeonBlade name: animation speed. Default 0.5. */
  speed?: number;
  /** NeonBlade name: wave height, world units. Default 1.2. */
  amplitude?: number;
  /** NeonBlade name: wave density. Default 0.55. */
  frequency?: number;
  /** NeonBlade name: fresnel rim glow. Default 0.9. */
  glow?: number;
  /** NeonBlade name: specular highlight. Default 0.6. */
  gloss?: number;
  /** NeonBlade name: surface width, world units. Default 34. */
  planeWidth?: number;
  /** NeonBlade name: surface depth, world units. Default 34. */
  planeDepth?: number;
  /** NeonBlade name: camera height. Default 11. */
  cameraHeight?: number;
  /** NeonBlade name: camera distance as a multiple of its height. Default 1.6. */
  cameraTilt?: number;
  /** NeonBlade name: subdivisions per axis, 8 to 220. Default 120. */
  gridSegments?: number;
  /** NeonBlade name: FogExp2 into `bgColor`. Default true. */
  fog?: boolean;
  /** NeonBlade name: 0 to 100 (or 0 to 1). Default 100. */
  opacity?: number;
  /** NeonBlade name: a bump follows the pointer. Default true. */
  hoverEffect?: boolean;
  /** NeonBlade name: bump radius, world units. Default 4. */
  hoverRadius?: number;
  /** NeonBlade name: bump height, world units. Default 1.4. */
  hoverStrength?: number;
  /** Stop the frame loop; the last frame stays. */
  paused?: boolean;
  /** Web only: render on WebGPURenderer's WebGL2 backend even where WebGPU works. */
  forceWebGL?: boolean;
  /** Skip three.js and draw the 2D RiverTide bands (TypeGPU quads, or Skia). */
  forceFallback?: boolean;
  /** Called with the backend in use, or null on the fallback. */
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Accessible description. Unset means decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  className?: string;
  /** Foreground content, laid over the tide. */
  children?: ReactNode;
}

/**
 * NeonBlade UI's Neon Tide (MIT, see THIRD-PARTY-NOTICES.md) in three.js: a
 * soft, glowing 3D wave surface flowing diagonally between two corners, with
 * NeonBlade's geometry, lighting, fog, motion and pointer bump. The default
 * colours come from the theme (royal to carolina over night, orange glints);
 * every colour prop takes NeonBlade's values too.
 *
 * Runs on three's WebGPURenderer through ThreeCanvas: WebGPU on web and
 * native (react-native-webgpu), WebGL2 on browsers without WebGPU. Where
 * neither runs it draws RiverTide's flat bands in the same colours.
 */
export function NeonTide({
  colorA,
  colorB,
  glossColor = TIDE_DEFAULT_COLORS.glossColor,
  bgColor = TIDE_DEFAULT_COLORS.bgColor,
  origin = 'top-right',
  speed = 0.5,
  amplitude = 1.2,
  frequency = 0.55,
  glow = 0.9,
  gloss = 0.6,
  planeWidth = 34,
  planeDepth = 34,
  cameraHeight = 11,
  cameraTilt = 1.6,
  gridSegments = 120,
  fog = true,
  opacity = 100,
  hoverEffect = true,
  hoverRadius = 4,
  hoverStrength = 1.4,
  paused,
  forceWebGL,
  forceFallback = false,
  onBackendChange,
  accessibilityLabel,
  className,
  children,
}: NeonTideProps) {
  const troughs = colorA ?? TIDE_DEFAULT_COLORS.colorA;
  const crests = colorB ?? (colorA ? colorA : TIDE_DEFAULT_COLORS.colorB);
  const options: TideOptions = {
    colorA: troughs, colorB: crests, glossColor, bgColor, origin, speed, amplitude, frequency, glow, gloss,
    planeWidth, planeDepth, cameraHeight, cameraTilt, gridSegments, fog, opacity: normaliseOpacity(opacity),
    hoverEffect, hoverRadius, hoverStrength,
  };
  // Params keyed on value, so a re-render with equal props doesn't redraw a still frame.
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised options on purpose.
  const params = useMemo(() => options, [key]);

  // RiverTide's colorA is its crest and colorB its deepest water.
  const flat = (
    <RiverTide
      colorA={crests}
      colorB={troughs}
      bgColor={bgColor}
      origin={origin}
      speed={speed}
      amplitude={amplitude}
      frequency={frequency}
      glow={glow}
      gloss={gloss}
      shore={false}
      opacity={opacity}
      hoverEffect={hoverEffect}
      hoverRadius={hoverRadius}
      hoverStrength={hoverStrength}
      forceFallback={forceFallback}
      accessibilityLabel={accessibilityLabel}
      className={forceFallback ? className : 'flex-1'}
    >
      {forceFallback ? children : null}
    </RiverTide>
  );
  if (forceFallback) return flat;

  return (
    <ThreeCanvas
      load={loadTide}
      params={params}
      forceWebGL={forceWebGL}
      paused={paused}
      fallback={flat}
      tracksPointer={hoverEffect}
      background={bgColor}
      accessibilityLabel={accessibilityLabel}
      className={className}
      onBackendChange={onBackendChange}
    >
      {children}
    </ThreeCanvas>
  );
}
