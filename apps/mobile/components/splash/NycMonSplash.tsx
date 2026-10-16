// The animated splash. It opens on the native splash's own frame (the seal,
// 200 dp, centred on brand night; app.config.ts), so the hand-off is invisible.
// Then the NeonBlade grid floor rises and scrolls toward the viewer, the seal
// lifts with an orange bloom behind it, one light sweep crosses it, and the
// overlay fades off the app built underneath. Settled at 2.1 s, gone at 2.5 s.
// Reduced motion: the seal holds, then fades.
//
// Skia, not Redraw: Redraw ships only as subscriber tarballs (redraw.dev) and
// none are vendored here; danger-room's splash made the same call.
// SOT: apps/mobile/app/_layout.tsx (mount + preventAutoHide)
// SOT-KEYWORDS: splash animated boot seal grid floor skia cold start
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Image,
  LinearGradient,
  Path,
  Rect,
  Skia,
  useImage,
  vec,
} from 'react-native-skia';
import { brand } from '@acme/theme';
import { useInstanceStore, useStore } from '@acme/ui';

/** Timeline in ms. The native frame is t = 0. */
const T = { settled: 2100, end: 2500, reducedHold: 400 } as const;
/** The native splash draws its 200 dp image with the seal at 64% (assets/images/splash-icon.png): 128 dp, measured on the Duo. */
const NATIVE_SEAL = 128;
// The 640 px master resample (packages/assets/brand), the same file BrandLogo draws on native.
const SEAL = require('../../../../packages/assets/brand/nyc-mon-logo-640.png') as number;
const GRID_LINES = 14;
const GRID_ROWS = 10;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};
const easeOut = (v: number) => {
  'worklet';
  return 1 - (1 - v) ** 3;
};
/** Progress of `t` through [from, to], eased. */
const span = (t: number, from: number, to: number) => {
  'worklet';
  return easeOut(clamp01((t - from) / (to - from)));
};

void SplashScreen.preventAutoHideAsync();

export function NycMonSplash() {
  const { width: w, height: h } = useWindowDimensions();
  const reduced = useReducedMotion();
  const seal = useImage(SEAL);
  const state = useInstanceStore(() => ({ done: false }));
  const done = useStore(state, (s) => s.done);
  const t = useSharedValue(0);
  const fade = useSharedValue(1);

  // The seal decodes first: hiding the native splash before it can draw would flash night.
  useEffect(() => {
    if (!seal) return;
    void SplashScreen.hideAsync();
    const finish = () => state.setState({ done: true });
    const fadeOut = () => {
      fade.set(withTiming(0, { duration: T.end - T.settled }, (ok) => ok && runOnJS(finish)()));
    };
    if (reduced) {
      const id = setTimeout(fadeOut, T.reducedHold);
      return () => clearTimeout(id);
    }
    t.set(withTiming(T.settled, { duration: T.settled, easing: Easing.linear }, (ok) => ok && runOnJS(fadeOut)()));
    return undefined;
  }, [seal, reduced, t, fade, state]);

  const cx = w / 2;
  const cy = h / 2;
  const horizon = cy + NATIVE_SEAL * 0.85;

  // Seal: native size → 1.9x, nudged up to sit on the horizon.
  const sealSize = useDerivedValue(() => NATIVE_SEAL * (1 + 0.9 * span(t.get(), 250, 1100)));
  const sealRect = useDerivedValue(() => {
    const s = sealSize.get();
    const lift = 24 * span(t.get(), 250, 1100);
    return Skia.XYWHRect(cx - s / 2, cy - s / 2 - lift, s, s);
  });
  const sealX = useDerivedValue(() => sealRect.get().x);
  const sealY = useDerivedValue(() => sealRect.get().y);

  // Orange bloom behind the seal.
  const bloomR = useDerivedValue(() => sealSize.get() * 0.55 * span(t.get(), 300, 1200));
  const bloomOpacity = useDerivedValue(() => 0.55 * span(t.get(), 300, 1200));
  const bloomY = useDerivedValue(() => cy - 24 * span(t.get(), 250, 1100));

  // One light sweep, 900–1500 ms, clipped to the seal's own pixels (SrcATop).
  const sweepX = useDerivedValue(() => {
    const p = clamp01((t.get() - 900) / 600);
    return cx - NATIVE_SEAL + p * NATIVE_SEAL * 2;
  });
  const sweepStart = useDerivedValue(() => vec(sweepX.get() - 60, cy - NATIVE_SEAL));
  const sweepEnd = useDerivedValue(() => vec(sweepX.get() + 60, cy + NATIVE_SEAL));
  const sweepOpacity = useDerivedValue(() => (t.get() > 900 && t.get() < 1500 ? 1 : 0));

  // Grid floor: fixed perspective rays plus rows that scroll toward the viewer.
  const rays = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (let i = 0; i <= GRID_LINES; i++) {
      const fx = (i / GRID_LINES - 0.5) * w * 3.2;
      p.moveTo(cx, horizon);
      p.lineTo(cx + fx, h);
    }
    return p.build();
  }, [w, h, cx, horizon]);
  const rows = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const phase = (t.get() / 700) % 1;
    for (let i = 0; i < GRID_ROWS; i++) {
      const k = (i + phase) / GRID_ROWS;
      const y = horizon + (h - horizon) * k * k;
      p.moveTo(0, y);
      p.lineTo(w, y);
    }
    return p.build();
  });
  const floorOpacity = useDerivedValue(() => 0.85 * span(t.get(), 0, 700));

  const overlay = useAnimatedStyle(() => ({ opacity: fade.get() }));

  if (done) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, overlay]} aria-hidden>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={w} height={h} color={brand.night} />
        {reduced ? null : (
          <Group opacity={floorOpacity}>
            <Rect x={0} y={horizon} width={w} height={h - horizon}>
              <LinearGradient start={vec(0, horizon)} end={vec(0, h)} colors={[brand.night, '#001A5C']} />
            </Rect>
            <Path path={rays} style="stroke" strokeWidth={1} color={brand.royal} opacity={0.7} />
            <Path path={rows} style="stroke" strokeWidth={1.5} color={brand.carolina} opacity={0.8} />
            <Rect x={0} y={horizon - 1} width={w} height={2} color={brand.orange} />
          </Group>
        )}
        {reduced ? null : (
          <Circle cx={cx} cy={bloomY} r={bloomR} color={brand.orange} opacity={bloomOpacity}>
            <Blur blur={40} />
          </Circle>
        )}
        {seal ? (
          <Group layer>
            {reduced ? (
              <Image image={seal} x={cx - NATIVE_SEAL / 2} y={cy - NATIVE_SEAL / 2} width={NATIVE_SEAL} height={NATIVE_SEAL} fit="contain" />
            ) : (
              <Image image={seal} x={sealX} y={sealY} width={sealSize} height={sealSize} fit="contain" />
            )}
            {reduced ? null : (
              <Rect x={0} y={0} width={w} height={h} blendMode="srcATop" opacity={sweepOpacity}>
                <LinearGradient
                  start={sweepStart}
                  end={sweepEnd}
                  colors={['rgba(248,248,248,0)', 'rgba(248,248,248,0.65)', 'rgba(248,248,248,0)']}
                />
              </Rect>
            )}
          </Group>
        ) : null}
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: brand.night, zIndex: 1000 },
});
