'use client';

import {
  BlurMask, Canvas, Fill, Group, Line, LinearGradient, Rect, vec, useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { neon } from '@acme/theme';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from './use-reduced-motion';
import { useWebPhase } from './use-web-phase';
import type { GridFloorProps } from './GridFloor.types';

/** `#RRGGBB` + two-digit alpha. Non-hex inputs pass through untouched. */
const withAlpha = (hex: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

// One row of the floor. NeonBlade draws rows with a quadratic depth curve and
// fades them in over the first 35% of the plane; the glow is a blurred
// underlay in glowColor beneath a crisp lineColor stroke.
function Row({
  index, rows, horizonY, planeHeight, width, speed, lineColor, glowColor, opacity, lineWidth,
}: {
  index: number; rows: number; horizonY: number; planeHeight: number; width: number;
  speed: number; lineColor: string; glowColor: string; opacity: number; lineWidth: number;
}) {
  const clock = useClock();
  const t = useDerivedValue(() => {
    const phase = speed === 0 ? 0 : ((clock.get() / 1000) * speed * 1.5) % 1;
    return (index + phase) / rows;
  });
  const p1 = useDerivedValue(() => vec(0, horizonY + planeHeight * t.get() * t.get()));
  const p2 = useDerivedValue(() => vec(width, horizonY + planeHeight * t.get() * t.get()));
  const alpha = useDerivedValue(() => Math.min((t.get() * t.get()) / 0.35, 1) * opacity);

  return (
    <>
      <Line p1={p1} p2={p2} color={glowColor} opacity={alpha} strokeWidth={lineWidth * 3}>
        <BlurMask blur={lineWidth * 3} style="normal" />
      </Line>
      <Line p1={p1} p2={p2} color={lineColor} opacity={alpha} strokeWidth={lineWidth} />
    </>
  );
}

// Same row from a plain number, for the web path (see use-web-phase.web.ts).
function StaticRow({
  index, rows, horizonY, planeHeight, width, phase, lineColor, glowColor, opacity, lineWidth,
}: {
  index: number; rows: number; horizonY: number; planeHeight: number; width: number;
  phase: number; lineColor: string; glowColor: string; opacity: number; lineWidth: number;
}) {
  const t = (index + phase) / rows;
  const y = horizonY + planeHeight * t * t;
  const alpha = Math.min((t * t) / 0.35, 1) * opacity;
  if (alpha <= 0) return null;
  return (
    <>
      <Line p1={vec(0, y)} p2={vec(width, y)} color={glowColor} opacity={alpha} strokeWidth={lineWidth * 3}>
        <BlurMask blur={lineWidth * 3} style="normal" />
      </Line>
      <Line p1={vec(0, y)} p2={vec(width, y)} color={lineColor} opacity={alpha} strokeWidth={lineWidth} />
    </>
  );
}

export default function GridFloorSkia({
  className, children, horizon = 0.45, columns = 24, rows = 18,
  lineColor = neon.line, glowColor = neon.glow, horizonGlowColor = neon.glowSoft,
  bgColor, backgroundColor, speed = 0.6, opacity = 0.85, lineWidth = 1,
}: GridFloorProps) {
  const fill = bgColor ?? backgroundColor ?? neon.bg;
  const reducedMotion = useReducedMotion();
  const effectiveSpeed = reducedMotion ? 0 : speed;
  const webPhase = useWebPhase(effectiveSpeed);
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const horizonY = height * horizon;
  const planeHeight = height - horizonY;
  const centerX = width / 2;

  const columnOffsets = Array.from({ length: columns + 1 }, (_, i) => i - columns / 2);
  const rowIndexes = Array.from({ length: rows + 1 }, (_, i) => i);
  const haze = horizonGlowColor === 'transparent' ? null : horizonGlowColor;

  return (
    <View
      className={`relative flex-1 overflow-hidden ${className ?? ''}`}
      // Caller colour prop (bgColor), not a theme token, so it can't be a class.
      style={{ backgroundColor: fill }}
      onLayout={onLayout}
    >
      {/* Skia surface: Canvas takes a style, not a className. Decorative, so hidden from assistive tech. */}
      <Canvas aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <Fill color={fill} />
        {haze ? (
          <Rect x={0} y={horizonY - height * 0.18} width={width} height={height * 0.3}>
            <LinearGradient
              start={vec(0, horizonY - height * 0.18)}
              end={vec(0, horizonY + height * 0.12)}
              colors={[withAlpha(haze, '00'), withAlpha(haze, '38'), withAlpha(haze, '00')]}
              positions={[0, 0.6, 1]}
            />
          </Rect>
        ) : null}
        <Group opacity={opacity}>
          {columnOffsets.map((offset) => {
            const xTop = centerX + offset * (width / columns);
            const xBottom = centerX + offset * ((width * 2) / columns);
            return (
              <Line key={offset} p1={vec(xTop, horizonY)} p2={vec(xBottom, height)} strokeWidth={lineWidth}>
                <LinearGradient
                  start={vec(0, horizonY)}
                  end={vec(0, height)}
                  colors={[withAlpha(lineColor, '00'), lineColor, lineColor]}
                  positions={[0, 0.35, 1]}
                />
              </Line>
            );
          })}
        </Group>
        {rowIndexes.map((index) =>
          webPhase === null ? (
            <Row
              key={index}
              index={index}
              rows={rows}
              horizonY={horizonY}
              planeHeight={planeHeight}
              width={width}
              speed={effectiveSpeed}
              lineColor={lineColor}
              glowColor={glowColor}
              opacity={opacity}
              lineWidth={lineWidth}
            />
          ) : (
            <StaticRow
              key={index}
              index={index}
              rows={rows}
              horizonY={horizonY}
              planeHeight={planeHeight}
              width={width}
              phase={webPhase}
              lineColor={lineColor}
              glowColor={glowColor}
              opacity={opacity}
              lineWidth={lineWidth}
            />
          ),
        )}
        {/* The horizon itself: one crisp line where the floor meets the sky. */}
        <Line p1={vec(0, horizonY)} p2={vec(width, horizonY)} color={glowColor} strokeWidth={lineWidth} opacity={0.6} />
      </Canvas>
      {children}
    </View>
  );
}
