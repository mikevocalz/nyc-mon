import { useMemo } from 'react';
import { Canvas, LinearGradient, Path, Skia, vec } from 'react-native-skia';
import { led } from '@acme/theme';
import { FAN_POLYGON, type ScannerFanProps } from './ScannerFan.types';

/**
 * PLATFORM FORK (native): the fan wedge as one Skia path with a vertical
 * gradient, emitter red at the apex fading to clear at the head's top edge.
 * The path is rebuilt only when the size changes. Decorative.
 */
export function ScannerFan({ widthPt, heightPt }: ScannerFanProps) {
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    FAN_POLYGON.forEach(([x, y], i) => {
      const px = (x / 100) * widthPt;
      const py = (y / 100) * heightPt;
      if (i === 0) b.moveTo(px, py);
      else b.lineTo(px, py);
    });
    return b.close().build();
  }, [widthPt, heightPt]);
  return (
    <Canvas aria-hidden style={{ width: widthPt, height: heightPt, pointerEvents: 'none' }}>
      <Path path={path}>
        <LinearGradient start={vec(0, heightPt)} end={vec(0, 0)} colors={[led.on, `${led.on}00`]} />
      </Path>
    </Canvas>
  );
}
