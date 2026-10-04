'use client';
import '../rn-globals-shim';

import { useMemo } from 'react';
import { BlurMask, Canvas, Group, Path, Skia } from 'react-native-skia';
import { MOUSE_FACE, STROKE_SCALE, toPathData } from './mouse-face';

export interface FaceCanvasProps {
  /** Face size in px; the canvas grows past it by `pad` on every side for the glow. */
  size: number;
  pad: number;
  /** Line weight in NeonBlade fox units (see STROKE_SCALE). */
  strokeWidth: number;
  color: string;
  glowColor: string;
  /** Glow radius in px; 0 draws no glow. */
  glow: number;
  /** 0 to 1; the face and ears take a quarter of it, as on the fox. */
  fillOpacity: number;
}

/**
 * The mouse face in Skia: translucent face fill, a two-layer glow (a wide
 * halo in the glow colour, a core in the line colour), the crisp lines,
 * then the solid nose. Paths are built once; props only change paint.
 */
export default function FaceCanvas({ size, pad, strokeWidth, color, glowColor, glow, fillOpacity }: FaceCanvasProps) {
  const lines = useMemo(() => Skia.Path.MakeFromSVGString(toPathData(MOUSE_FACE.lines)), []);
  const fills = useMemo(() => Skia.Path.MakeFromSVGString(toPathData(MOUSE_FACE.fills, true)), []);
  const nose = useMemo(() => Skia.Path.MakeFromSVGString(toPathData([MOUSE_FACE.nose], true)), []);
  if (!lines || !fills || !nose) return null;
  const sw = strokeWidth * STROKE_SCALE;
  const stroke = { style: 'stroke', strokeWidth: sw, strokeCap: 'round', strokeJoin: 'round' } as const;
  const full = size + pad * 2;
  return (
    // Skia surface: Canvas takes a style, not a className; its size is computed from props.
    <Canvas style={{ width: full, height: full }}>
      <Group transform={[{ translateX: pad }, { translateY: pad }, { scale: size / 100 }]}>
        {fillOpacity > 0 ? <Path path={fills} color={color} opacity={fillOpacity * 0.25} /> : null}
        {glow > 0 ? (
          <>
            {/* respectCTM off: blur radii are screen px, whatever the face size. */}
            {/* Outer halo in the glow colour (royal for orange), then a core in the line colour like the fox's drop-shadow. */}
            <Path path={lines} color={glowColor} {...stroke} strokeWidth={sw * 1.5} opacity={0.85}>
              <BlurMask blur={glow * 1.1} style="normal" respectCTM={false} />
            </Path>
            <Path path={lines} color={color} {...stroke} opacity={0.6}>
              <BlurMask blur={glow / 2} style="normal" respectCTM={false} />
            </Path>
            <Path path={nose} color={color}>
              <BlurMask blur={glow / 2} style="normal" respectCTM={false} />
            </Path>
          </>
        ) : null}
        <Path path={lines} color={color} {...stroke} />
        <Path path={nose} color={color} />
      </Group>
    </Canvas>
  );
}
