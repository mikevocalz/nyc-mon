import { BlurMask, Canvas, Group, Path, Skia } from 'react-native-skia';
import { useMemo } from 'react';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import { insetNotch, notchPolygon } from './notch';
import type { NotchFrameProps } from './NotchFrame.types';

function polygonPath(points: [number, number][], dx = 0, dy = 0) {
  const builder = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? builder.moveTo(x + dx, y + dy) : builder.lineTo(x + dx, y + dy)));
  return builder.close().build();
}

const GLOW = 12;

/**
 * Native: one Skia canvas behind the content draws the depth plate, the
 * border ring, the inset face and an optional BlurMask glow from the same
 * polygon the web clip-path uses. Content sits on top, inset by the border.
 */
export function NotchFrame({
  children, className, shape, fill, border, depthColor, glow, borderWidth = 3, depth = 6,
}: NotchFrameProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const pad = glow ? GLOW : 0;

  const paths = useMemo(() => {
    const outer = notchPolygon(width, height, shape);
    const inner = notchPolygon(width - borderWidth * 2, height - borderWidth * 2, insetNotch(shape, borderWidth));
    return {
      outer: polygonPath(outer),
      depth: polygonPath(outer, depth, depth),
      inner: polygonPath(inner, borderWidth, borderWidth),
    };
  }, [width, height, shape, borderWidth, depth]);

  return (
    <View className="relative" onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. Sized past the frame by the depth and glow. Decorative. */}
      <Canvas
        aria-hidden
        style={{
          position: 'absolute', left: -pad, top: -pad,
          width: width + depth + pad * 2, height: height + depth + pad * 2, pointerEvents: 'none',
        }}
      >
        <Group transform={[{ translateX: pad }, { translateY: pad }]}>
          {depth > 0 ? <Path path={paths.depth} color={depthColor} /> : null}
          {glow ? (
            <Path path={paths.outer} color={glow}>
              <BlurMask blur={GLOW / 2} style="outer" />
            </Path>
          ) : null}
          <Path path={paths.outer} color={border} />
          <Path path={paths.inner} color={fill} />
        </Group>
      </Canvas>
      {/* Computed: the inset equals the borderWidth prop. */}
      <View className={className} style={{ margin: borderWidth }}>
        {children}
      </View>
    </View>
  );
}
