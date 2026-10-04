'use client';

import { BlurMask, Canvas, Fill, Group, Line, LinearGradient, vec, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { neon } from '@acme/theme';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from './use-reduced-motion';
import { useWebPhase } from './use-web-phase';
import type { GridSceneProps } from './GridScene.types';

function MovingLine({
  index, rows, edgeY, farY, width, speed, color, glowColor, opacity, lineWidth,
}: {
  index: number; rows: number; edgeY: number; farY: number; width: number;
  speed: number; color: string; glowColor: string; opacity: number; lineWidth: number;
}) {
  const clock = useClock();
  const y = useDerivedValue(() => {
    const phase = speed === 0 ? 0 : ((clock.get() / 1000) * speed * 1.5) % 1;
    const t = (index + phase) / rows;
    return edgeY + (farY - edgeY) * t * t;
  });
  const p1 = useDerivedValue(() => vec(0, y.get()));
  const p2 = useDerivedValue(() => vec(width, y.get()));
  const alpha = Math.min(1, ((index + 1) / rows) / 0.35) * opacity;

  // Blurred glow underlay + crisp line on top (NeonBlade's shadowBlur look).
  return (
    <Group opacity={alpha}>
      <Line p1={p1} p2={p2} color={glowColor} strokeWidth={lineWidth * 3}>
        <BlurMask blur={lineWidth * 3} style="normal" />
      </Line>
      <Line p1={p1} p2={p2} color={color} strokeWidth={lineWidth} />
    </Group>
  );
}

// Plain-number row for web, where Reanimated-driven Skia props don't draw.
function StaticLine({
  index, rows, edgeY, farY, width, phase, color, glowColor, opacity, lineWidth,
}: {
  index: number; rows: number; edgeY: number; farY: number; width: number;
  phase: number; color: string; glowColor: string; opacity: number; lineWidth: number;
}) {
  const t = (index + phase) / rows;
  const y = edgeY + (farY - edgeY) * t * t;
  const alpha = Math.min(1, ((index + 1) / rows) / 0.35) * opacity;
  return (
    <Group opacity={alpha}>
      <Line p1={vec(0, y)} p2={vec(width, y)} color={glowColor} strokeWidth={lineWidth * 3}>
        <BlurMask blur={lineWidth * 3} style="normal" />
      </Line>
      <Line p1={vec(0, y)} p2={vec(width, y)} color={color} strokeWidth={lineWidth} />
    </Group>
  );
}

export default function GridSceneSkia({
  className, children, horizon = 0.5, gap = 0.08, columns = 24, rows = 18,
  lineColor = neon.line, glowColor = neon.glow, backgroundColor = neon.bg,
  speed = 0.6, opacity = 0.85, lineWidth = 1, showCeiling = true, showFloor = true,
}: GridSceneProps) {
  const reducedMotion = useReducedMotion();
  const effectiveSpeed = reducedMotion ? 0 : speed;
  const webPhase = useWebPhase(effectiveSpeed);
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const horizonY = height * horizon;
  const halfGap = (height * gap) / 2;
  const floorEdgeY = horizonY + halfGap;
  const ceilingEdgeY = horizonY - halfGap;
  const columnsArray = Array.from({ length: columns + 1 }, (_, index) => index - columns / 2);
  const rowsArray = Array.from({ length: rows + 5 }, (_, index) => index);

  const planeColumns = (floor: boolean) => {
    const edgeY = floor ? floorEdgeY : ceilingEdgeY;
    const farY = floor ? height : 0;
    return columnsArray.map((offset) => {
      const centerX = width / 2;
      const xNear = centerX + offset * (width / columns);
      const xFar = centerX + offset * ((width * 2) / columns);
      return (
        <Line key={`${floor ? 'f' : 'c'}-${offset}`} p1={vec(xNear, edgeY)} p2={vec(xFar, farY)} strokeWidth={lineWidth} opacity={opacity * 0.72}>
          <LinearGradient start={vec(0, edgeY)} end={vec(0, farY)} colors={[`${lineColor}00`, lineColor, lineColor]} positions={[0, 0.35, 1]} />
        </Line>
      );
    });
  };

  return (
    <View
      className={`relative flex-1 overflow-hidden ${className ?? ''}`}
      // Caller colour prop (backgroundColor), not a theme token, so it can't be a class.
      style={{ backgroundColor }}
      onLayout={onLayout}
    >
      {/* Skia surface: Canvas takes a style, not a className. Decorative, so hidden from assistive tech. */}
      <Canvas aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <Fill color={backgroundColor} />
        <Group>
          {showFloor ? planeColumns(true) : null}
          {showCeiling ? planeColumns(false) : null}
          {showFloor ? rowsArray.map((index) => (
            webPhase === null ? (
              <MovingLine key={`fr-${index}`} index={index} rows={rows} edgeY={floorEdgeY} farY={height} width={width} speed={effectiveSpeed} color={lineColor} glowColor={glowColor} opacity={opacity} lineWidth={lineWidth} />
            ) : (
              <StaticLine key={`fr-${index}`} index={index} rows={rows} edgeY={floorEdgeY} farY={height} width={width} phase={webPhase} color={lineColor} glowColor={glowColor} opacity={opacity} lineWidth={lineWidth} />
            )
          )) : null}
          {showCeiling ? rowsArray.map((index) => (
            webPhase === null ? (
              <MovingLine key={`cr-${index}`} index={index} rows={rows} edgeY={ceilingEdgeY} farY={0} width={width} speed={effectiveSpeed} color={lineColor} glowColor={glowColor} opacity={opacity} lineWidth={lineWidth} />
            ) : (
              <StaticLine key={`cr-${index}`} index={index} rows={rows} edgeY={ceilingEdgeY} farY={0} width={width} phase={webPhase} color={lineColor} glowColor={glowColor} opacity={opacity} lineWidth={lineWidth} />
            )
          )) : null}
        </Group>
      </Canvas>
      {children}
    </View>
  );
}
