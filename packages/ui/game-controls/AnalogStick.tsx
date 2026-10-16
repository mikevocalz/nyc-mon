'use client';
// The left analog stick and its D-pad mode (Master Directive v2 §2A). The
// housing, well, thumbpad, rings and indicators are the `left-stick` Rive
// artboard (§8: `stick/x`, `stick/y`, `stick/engaged`, `stick/mode`); this
// component is the touch surface, the maths and the accessibility node.
//
// Gesture: react-native-gesture-handler 3.2.1 `useManualGesture` with the
// touch callbacks (lib/typescript/v3/types/ConfigTypes.d.ts) so the first
// finger engages on touch-down, not after a pan's activation distance, and
// so the owning pointer is tracked by id through every multidirectional
// move while the other thumb works the caps. Callbacks are worklets on the
// UI thread: the floating housing follows the finger there, and a reading is
// hopped to JS with Reanimated's runOnJS only when it changed
// (`isSameReading`), stamped with the gesture-thread Date.now() because RNGH
// touch events carry no timestamp (handlers/gestureHandlerCommon.d.ts).
//
// JS side, per accepted reading: the Rive bindings get `stick/x`, `stick/y`,
// `stick/engaged` (no React render), `onMove` gets the contract reading, and
// the spoken value updates only when the eight-way direction changes.
//
// The pad is an arcade lever (Decision: BUILD, 2026-10-15, from the device
// report "why doesnt joystick move like an arcade joystick?"). It used to be
// a node inside the LeftStick artboard, moved by the JS-thread `stick/x`/`y`
// writes. On the Surface Duo those writes reached the instance and the
// artboard never redrew them: the Android runtime of @rive-app/react-native
// 0.5.2 stops advancing a settled state machine and a view model write does
// not wake it (see `ArcadeRiveBindingOptions.onDidWrite`). Now the pad is the
// `Thumbpad` artboard in its own view, and every touch move sets its
// Reanimated transform on the UI thread: it follows the finger from the
// first dp, parks at the gate, leans toward the push with perspective, and
// springs home on release. D-pad mode parks it on eight notches of an
// octagonal gate. Reduced motion: the pad snaps home, no spring, no engage
// scale. Rive keeps the housing, rings, indicators, gate and the cap's look.
//
// Neutralization (§2A "no drift"): the owner's up, a cancel, a finalize with
// the owner still set, or `disabled` flipping true all publish `end`/`cancel`
// with the neutral reading and send the pad home. The clamp radius follows the
// profile scale so a full push always reaches the well's edge
// (arcade-ergonomics.md §8); the tuning's dp is at reference scale 1.0.
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  useManualGesture,
  type GestureTouchEvent,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { css } from '../html/css';
import { testIdProps } from '../hlynk/a11y';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { Direction8, Phase, StickMode, StickPlacement, StickReading, StickTuning } from './contract.ts';
import { ArcadeRiveSurface } from './ArcadeRiveSurface';
import type { ArcadeRiveSource } from './ArcadeRiveSurface.types.ts';
import { NEUTRAL_STICK, leverOffsetDp, leverTiltDeg, readStick, stickOrigin, toDigitalReading } from './stick-math.ts';
import { DIRECTION_WORDS, STICK_GEOMETRY_DP, insideCircle } from './touch-geometry.ts';
import { mustReleaseOnDisable } from './touch-ownership.ts';
import type { ArcadeRiveBinding } from './rive-binding.ts';
import { useRiveBinding } from './use-rive-binding.ts';

/** A non-drag way to move (WCAG 2.5.7): a named action the screen reader lists on the stick. */
export interface StickAccessibilityAction {
  readonly name: string;
  readonly label: string;
  readonly perform: () => void;
}

/** Props of {@linkcode AnalogStick}. */
export interface AnalogStickProps {
  /** `analog` publishes the 360° reading; `dpad` snaps it to eight unit vectors. Also written to Rive `stick/mode`. */
  readonly mode: StickMode;
  /** `fixed` centres the housing in the control; `floating` puts it where the finger lands. */
  readonly placement: StickPlacement;
  /** Dead zone, sensitivity and clamp radius from the profile. */
  readonly tuning: StickTuning;
  /** {@linkcode ControllerProfile.scale} after the layout resolver clamped it. */
  readonly scale: number;
  /** True while a blocking state covers the world; an engaged stick neutralizes when this flips on. */
  readonly disabled: boolean;
  /** Authored sibling: the pad and housing snap home in one frame instead of springing; no engage scale. */
  readonly reducedMotion: boolean;
  /** Every accepted reading, in the contract's units. `begin` and `end`/`cancel` always arrive; `update` only on change. */
  readonly onMove: (reading: StickReading, phase: Phase, timestampMs: number) => void;
  /** Actions a screen reader can perform instead of dragging (the camera's step commands). */
  readonly a11yActions?: readonly StickAccessibilityAction[];
  /** The `left-stick` artboard. Absent: the touch surface still works and every write is a no-op. */
  readonly rive?: ArcadeRiveSource;
  readonly testID?: string;
  /** Size of the touch surface. Defaults to `flex-1`; floating placement uses the whole surface. */
  readonly style?: StyleProp<ViewStyle>;
}

const Housing = css(Animated.View, 'AnalogStickHousing');
const Pad = css(Animated.View, 'AnalogStickPad');
const ENGAGE_SCALE = 1.03;
const ENGAGE_MS = 120;
/** The floating housing's return when the finger lifts. */
const RETURN_SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;
/**
 * The lever's snap back to centre: damping ratio about 0.43, so the pad
 * overshoots once, a few dp, and settles in about 0.3 s.
 */
const LEVER_SPRING = { damping: 14, stiffness: 520, mass: 0.5 } as const;
/** How far the cap leans at the gate, in degrees, and the perspective that makes the lean read. */
const LEVER_TILT_DEG = 14;
const LEVER_PERSPECTIVE = 320;
/** The cap artboard and machine in `left-stick.riv` (left-stick/scene.rml). */
const PAD_ARTBOARD = 'Thumbpad';
const PAD_STATE_MACHINE = 'Pad';

interface StickVoice {
  direction: Direction8;
}

/**
 * The movement control. One finger owns it from touch-down to lift; the
 * reading is normalized −1…1 with +y up, the dead zone is radial, diagonals
 * never exceed unit length, and {@linkcode AnalogStickProps.mode} `dpad`
 * snaps to eight directions with the same gesture.
 *
 * @see {@linkcode DigitalDPad} for the D-pad preset and {@linkcode readStick} for the maths.
 */
export function AnalogStick({
  mode,
  placement,
  tuning,
  scale,
  disabled,
  reducedMotion,
  onMove,
  a11yActions,
  rive,
  testID,
  style,
}: AnalogStickProps) {
  const housingDp = STICK_GEOMETRY_DP.housing * scale;
  const housingRadius = housingDp / 2;
  const clampRadius = tuning.clampRadiusDp * scale;
  const scaledTuning: StickTuning = { deadZone: tuning.deadZone, sensitivity: tuning.sensitivity, clampRadiusDp: clampRadius };
  const travelDp = STICK_GEOMETRY_DP.padTravel * scale;
  const glowDp = STICK_GEOMETRY_DP.glowMargin * scale;
  const padBoxDp = STICK_GEOMETRY_DP.pad * scale + 2 * glowDp;
  const lever = { mode, clampRadiusDp: clampRadius, travelDp } as const;

  // One binding per artboard: the housing (LeftStick) and the cap (Thumbpad) each get their own instance.
  const syncBinding = (b: ArcadeRiveBinding) => {
    b.setStickMode(mode);
    b.setReducedMotion(reducedMotion);
    b.setStick(NEUTRAL_STICK);
  };
  const binding = useRiveBinding(syncBinding);
  const padBinding = useRiveBinding(syncBinding);
  useEffect(() => {
    binding.write((b) => b.setStickMode(mode));
    padBinding.write((b) => b.setStickMode(mode));
  }, [binding, padBinding, mode]);
  useEffect(() => {
    binding.write((b) => b.setReducedMotion(reducedMotion));
    padBinding.write((b) => b.setReducedMotion(reducedMotion));
  }, [binding, padBinding, reducedMotion]);

  // The spoken value changes only with the eight-way direction: a handful of renders per second at most.
  const voice = useInstanceStore<StickVoice>(() => ({ direction: 'none' }));
  const direction = useStore(voice, (s) => s.direction);

  const latest = useRef({ onMove });
  useEffect(() => {
    latest.current = { onMove };
  });

  /** JS side of every accepted reading. Primitives cross the thread; the object is rebuilt here. */
  const publish = useCallback(
    (x: number, y: number, engaged: boolean, dir: Direction8, phase: Phase, timestampMs: number) => {
      const reading: StickReading = engaged ? { x, y, engaged, direction: dir } : NEUTRAL_STICK;
      binding.write((b) => b.setStick(reading));
      padBinding.write((b) => b.setStick(reading));
      if (voice.getState().direction !== reading.direction) voice.setState({ direction: reading.direction });
      latest.current.onMove(reading, phase, timestampMs);
    },
    [binding, padBinding, voice],
  );

  /** Pointer id that owns the stick, −1 when none. */
  const owner = useSharedValue(-1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  /** Housing offset from the surface centre (floating placement) and engage scale. */
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const engage = useSharedValue(0);
  /** Lever pad offset from the housing centre, dp, +y down. Written on every move, on the UI thread. */
  const padX = useSharedValue(0);
  const padY = useSharedValue(0);
  /** Last published reading, so an unchanged update costs no JS hop. */
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const lastEngaged = useSharedValue(false);
  const lastDirection = useSharedValue<Direction8>('none');

  const onLayout = (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width);
    height.set(event.nativeEvent.layout.height);
  };

  const gesture = useManualGesture({
    enabled: !disabled,
    onTouchesDown: (e: GestureTouchEvent) => {
      'worklet';
      if (owner.get() !== -1) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const w = width.get();
      const h = height.get();
      if (placement === 'fixed' && !insideCircle(touch.x, touch.y, w / 2, h / 2, housingRadius)) {
        GestureStateManager.fail(e.handlerTag);
        return;
      }
      const origin = stickOrigin(placement, touch.x, touch.y, { width: w, height: h }, clampRadius);
      originX.set(origin.x);
      originY.set(origin.y);
      owner.set(touch.id);
      if (placement === 'floating') {
        shiftX.set(origin.x - w / 2);
        shiftY.set(origin.y - h / 2);
      }
      engage.set(reducedMotion ? 1 : withTiming(1, { duration: ENGAGE_MS }));
      GestureStateManager.activate(e.handlerTag);
      const reading = readStick(touch.x - origin.x, touch.y - origin.y, scaledTuning);
      const r = mode === 'dpad' ? toDigitalReading(reading) : reading;
      const pad = leverOffsetDp(touch.x - origin.x, touch.y - origin.y, r, lever);
      padX.set(pad.x);
      padY.set(pad.y);
      lastX.set(r.x);
      lastY.set(r.y);
      lastEngaged.set(r.engaged);
      lastDirection.set(r.direction);
      runOnJS(publish)(r.x, r.y, r.engaged, r.direction, 'begin', Date.now());
    },
    onTouchesMove: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1) return;
      const touch = e.allTouches.find((t) => t.id === current);
      if (!touch) return;
      const dx = touch.x - originX.get();
      const dy = touch.y - originY.get();
      const reading = readStick(dx, dy, scaledTuning);
      const r = mode === 'dpad' ? toDigitalReading(reading) : reading;
      // The pad moves on every move event, before the change check: it is visual, not a reading.
      const pad = leverOffsetDp(dx, dy, r, lever);
      padX.set(pad.x);
      padY.set(pad.y);
      if (r.x === lastX.get() && r.y === lastY.get() && r.engaged === lastEngaged.get() && r.direction === lastDirection.get()) return;
      lastX.set(r.x);
      lastY.set(r.y);
      lastEngaged.set(r.engaged);
      lastDirection.set(r.direction);
      runOnJS(publish)(r.x, r.y, r.engaged, r.direction, 'update', Date.now());
    },
    onTouchesUp: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      owner.set(-1);
      lastX.set(0);
      lastY.set(0);
      lastEngaged.set(false);
      lastDirection.set('none');
      engage.set(reducedMotion ? 0 : withTiming(0, { duration: ENGAGE_MS }));
      shiftX.set(reducedMotion ? 0 : withSpring(0, RETURN_SPRING));
      shiftY.set(reducedMotion ? 0 : withSpring(0, RETURN_SPRING));
      padX.set(reducedMotion ? 0 : withSpring(0, LEVER_SPRING));
      padY.set(reducedMotion ? 0 : withSpring(0, LEVER_SPRING));
      if (e.numberOfTouches === 0) GestureStateManager.deactivate(e.handlerTag);
      runOnJS(publish)(0, 0, false, 'none', 'end', Date.now());
    },
    onTouchesCancel: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      owner.set(-1);
      lastEngaged.set(false);
      lastDirection.set('none');
      engage.set(0);
      shiftX.set(0);
      shiftY.set(0);
      padX.set(0);
      padY.set(0);
      runOnJS(publish)(0, 0, false, 'none', 'cancel', Date.now());
    },
    onFinalize: () => {
      'worklet';
      if (owner.get() === -1) return;
      owner.set(-1);
      lastEngaged.set(false);
      lastDirection.set('none');
      engage.set(0);
      shiftX.set(0);
      shiftY.set(0);
      padX.set(0);
      padY.set(0);
      runOnJS(publish)(0, 0, false, 'none', 'cancel', Date.now());
    },
  });

  // Disabling mid-drag neutralizes: the gesture is torn down by `enabled`, so the reading must end here.
  // Ownership decides, not the reading: a thumb resting in the dead zone owns the stick too (M4).
  useEffect(() => {
    if (!disabled) return;
    if (mustReleaseOnDisable(owner.get())) {
      owner.set(-1);
      lastEngaged.set(false);
      lastDirection.set('none');
      engage.set(0);
      shiftX.set(0);
      shiftY.set(0);
      padX.set(0);
      padY.set(0);
      publish(0, 0, false, 'none', 'cancel', Date.now());
    }
  }, [disabled, engage, lastDirection, lastEngaged, owner, padX, padY, publish, shiftX, shiftY]);

  const housingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shiftX.get() },
      { translateY: shiftY.get() },
      { scale: reducedMotion ? 1 : 1 + (ENGAGE_SCALE - 1) * engage.get() },
    ],
  }));

  const padStyle = useAnimatedStyle(() => {
    const offset = { x: padX.get(), y: padY.get() };
    const tilt = leverTiltDeg(offset, travelDp, LEVER_TILT_DEG);
    return {
      transform: [
        { perspective: LEVER_PERSPECTIVE },
        { translateX: offset.x },
        { translateY: offset.y },
        { rotateX: `${tilt.rotateX}deg` },
        { rotateY: `${tilt.rotateY}deg` },
      ],
    };
  });

  const modePrefix = mode === 'dpad' ? 'Direction pad' : 'Analog stick';
  const actions = a11yActions ?? [];

  return (
    <GestureDetector gesture={gesture}>
      <View
        {...testIdProps(testID)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Move"
        accessibilityHint="Drag to move. Double tap for step controls"
        accessibilityValue={{ text: `${modePrefix}, ${DIRECTION_WORDS[direction]}` }}
        accessibilityState={{ disabled }}
        accessibilityActions={actions.map((a) => ({ name: a.name, label: a.label }))}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          const action = actions.find((a) => a.name === event.nativeEvent.actionName);
          if (!action) return;
          action.perform();
          AccessibilityInfo.announceForAccessibility(action.label);
        }}
        onLayout={onLayout}
        className="flex-1 items-center justify-center"
        style={style}
      >
        <Housing
          pointerEvents="none"
          aria-hidden
          className="rounded-full"
          // Computed: housing Ø128 × profile scale (arcade-ergonomics.md §8).
          style={[{ width: housingDp, height: housingDp }, housingStyle]}
        >
          <ArcadeRiveSurface
            riveFile={rive?.file}
            diagnosticsName="left-stick"
            artboardName={rive?.artboardName}
            stateMachineName={rive?.stateMachineName}
            onBinding={binding.onBinding}
            // Computed: the artboard is the housing plus its glow margin, drawn 1 unit = 1 dp × scale.
            style={{ position: 'absolute', left: -glowDp, top: -glowDp, width: housingDp + 2 * glowDp, height: housingDp + 2 * glowDp }}
          />
          <Pad
            pointerEvents="none"
            // Computed: the 72-unit cap artboard centred in the housing; the transform is the lever.
            style={[{ position: 'absolute', left: housingRadius - padBoxDp / 2, top: housingRadius - padBoxDp / 2, width: padBoxDp, height: padBoxDp }, padStyle]}
          >
            <ArcadeRiveSurface
              riveFile={rive?.file}
              diagnosticsName="left-stick-pad"
              artboardName={PAD_ARTBOARD}
              stateMachineName={PAD_STATE_MACHINE}
              onBinding={padBinding.onBinding}
              style={{ width: padBoxDp, height: padBoxDp }}
            />
          </Pad>
        </Housing>
      </View>
    </GestureDetector>
  );
}
