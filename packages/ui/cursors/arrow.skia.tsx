'use client';
import '../rn-globals-shim';

import { useMemo } from 'react';
import { Canvas, Group, Path, Skia } from 'react-native-skia';
import { brand, palette } from '@acme/theme';

export interface ArrowCanvasProps {
  size: number;
  fill: string;
  outline: string;
}

// Pointer silhouette on a 24-unit grid, tip at (4, 2).
const ARROW = 'M4 2 L4 19.5 L8.6 15.2 L11.6 21.8 L14.7 20.4 L11.8 14 L18.2 14 Z';
// Lit bevel along the leading edge: the badge's rim light.
const BEVEL = 'M5.6 5.4 L5.6 15.6 L8.2 13.2 Z';

/** The arrow drawing: night drop, royal outline, orange face, lit bevel. */
export default function ArrowCanvas({ size, fill, outline }: ArrowCanvasProps) {
  const arrow = useMemo(() => Skia.Path.MakeFromSVGString(ARROW), []);
  const bevel = useMemo(() => Skia.Path.MakeFromSVGString(BEVEL), []);
  if (!arrow || !bevel) return null;
  return (
    // Skia surface: Canvas takes a style, not a className.
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 24 }]}>
        <Group transform={[{ translateX: 1.4 }, { translateY: 1.4 }]}>
          <Path path={arrow} color={brand.night} />
        </Group>
        <Path path={arrow} color={outline} style="stroke" strokeWidth={2.2} strokeJoin="round" />
        <Path path={arrow} color={fill} />
        <Path path={bevel} color={palette.orange[200]} opacity={0.85} />
      </Group>
    </Canvas>
  );
}
