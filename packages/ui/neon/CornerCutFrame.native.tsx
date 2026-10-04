import { BlurMask, Canvas, Path, Skia } from 'react-native-skia';
import { useMemo } from 'react';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import type { CornerCutFrameProps } from './CornerCutFrame.types';
import { cornerCutPolygon, insetCut } from './corner-cut';
import { frameColors } from './frame-colors';
import { GLOW_INTENSITY } from './glow';

function polygonPath(points: [number, number][], dx = 0, dy = 0) {
  const builder = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? builder.moveTo(x + dx, y + dy) : builder.lineTo(x + dx, y + dy)));
  return builder.close().build();
}

/**
 * Native: one Skia canvas behind the content draws the depth plate, the
 * border shape, the inset face and an optional BlurMask glow, all from the
 * same polygon as the web clip-path. Content sits on top, padded by the
 * border width; it is not clipped to the cut, so keep content clear of the
 * corner with the `cut` length of padding.
 */
export function CornerCutFrame({
  children,
  className,
  tone = 'orange',
  variant = 'solid',
  corner = 'bottom-right',
  cut = 16,
  borderWidth = 2,
  depth = 4,
  glow = false,
  radius = 0,
}: CornerCutFrameProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const colors = frameColors(tone, variant);
  const glowRadius = glow === false ? 0 : glow === true ? GLOW_INTENSITY.medium : GLOW_INTENSITY[glow];

  const paths = useMemo(() => {
    if (radius > 0) {
      // Opt-in rounding: rounded rectangles in place of the cut polygon.
      const rr = (x: number, y: number, w: number, h: number, r: number) =>
        Skia.PathBuilder.Make().addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r)).build();
      const inner = Math.max(0, radius - borderWidth);
      return {
        outer: rr(0, 0, width, height, radius),
        depth: rr(depth, depth, width, height, radius),
        inner: rr(borderWidth, borderWidth, width - borderWidth * 2, height - borderWidth * 2, inner),
      };
    }
    const outer = cornerCutPolygon(width, height, cut, corner);
    const innerCut = insetCut(cut, borderWidth);
    const inner = cornerCutPolygon(width - borderWidth * 2, height - borderWidth * 2, innerCut, corner);
    return {
      outer: polygonPath(outer),
      depth: polygonPath(outer, depth, depth),
      inner: polygonPath(inner, borderWidth, borderWidth),
    };
  }, [width, height, cut, corner, borderWidth, depth, radius]);

  return (
    <View className="relative" onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. Sized past the frame by the depth offset and glow radius. Decorative. */}
      <Canvas
        aria-hidden
        style={{
          position: 'absolute',
          left: -glowRadius,
          top: -glowRadius,
          width: width + depth + glowRadius * 2,
          height: height + depth + glowRadius * 2,
          pointerEvents: 'none',
        }}
      >
        {depth > 0 ? <Path path={paths.depth} color={colors.depth} transform={[{ translateX: glowRadius }, { translateY: glowRadius }]} /> : null}
        {glowRadius ? (
          <Path path={paths.outer} color={colors.glow} transform={[{ translateX: glowRadius }, { translateY: glowRadius }]}>
            <BlurMask blur={glowRadius / 2} style="outer" />
          </Path>
        ) : null}
        <Path path={paths.outer} color={colors.border} transform={[{ translateX: glowRadius }, { translateY: glowRadius }]} />
        <Path path={paths.inner} color={colors.fill} transform={[{ translateX: glowRadius }, { translateY: glowRadius }]} />
      </Canvas>
      {/* Computed: the inset equals the borderWidth prop. */}
      <View className={className} style={{ margin: borderWidth }}>
        {children}
      </View>
    </View>
  );
}
