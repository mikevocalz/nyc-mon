'use client';
import '../rn-globals-shim';
import { useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import { palette } from '@acme/theme';
import { haptics } from '../haptics';
import { hiddenA11y, testIdProps } from '../hlynk/a11y';
import { TRACKPAD_GESTURE } from '../hlynk/trackpad-gesture';
import { rovingTabIndex } from '../radio-group';
import { Pressable, Text, View } from '../tw';
import { triptychKey } from './hatch-model';
import { easingPoints, tokenMs } from './motion-curves';

const isWeb = Platform.OS === 'web';
const EMPHASIZED = easingPoints('emphasized');
const STANDARD = easingPoints('standard');
const ENTER_MS = tokenMs('motion-enter', false);
const ENTER_REDUCED_MS = tokenMs('motion-enter', true);

/** One tile: a still or a render target, with its spoken name. */
export interface ChoiceTriptychItem {
  key: string;
  /** Visible under the tile. */
  label: string;
  /** e.g. `m08.tile.a11y.label`, filled. */
  accessibilityLabel: string;
  /** Image today, a render target when models land. */
  media: ReactNode;
}

/**
 * 2–4 equal tiles with radio semantics and no default (D-16b). Focusing a tile
 * grows it to fill the container; null focus is the browsing state.
 */
export interface ChoiceTriptychProps {
  items: readonly ChoiceTriptychItem[];
  /** null = nothing focused (browsing). Controlled: the screen and the trackpad both drive it. */
  focusedIndex: number | null;
  onFocusChange: (index: number | null) => void;
  /** Group name for assistive tech. */
  accessibilityLabel: string;
  /** Content shown over the focused tile (the card). */
  focusedOverlay?: ReactNode;
  /** Where the overlay docks: over the bottom (phone) or beside (compact, Quest). @default 'bottom' */
  overlayPlacement?: 'bottom' | 'trailing';
  /**
   * The trackpad is held on the focused tile (the screen sets it from
   * `onHoldStart` / `onHoldEnd`). Draws the hold bar filling over the 600 ms
   * commit; it is progress, not decoration, so reduced motion keeps it.
   */
  holding?: boolean;
  reducedMotion: boolean;
  testID?: string;
  /** Per-tile test ID, e.g. `(item) => \`m08-egg-${item.key}\``. */
  itemTestID?: (item: ChoiceTriptychItem) => string;
}

/** The focused tile filling the container, entering from its slot in the row. */
function Stage({
  item, index, count, overlay, placement, holding, reducedMotion,
}: {
  item: ChoiceTriptychItem;
  index: number;
  count: number;
  overlay: ReactNode;
  placement: 'bottom' | 'trailing';
  holding: boolean;
  reducedMotion: boolean;
}) {
  const enter = useSharedValue(0);
  const wobble = useSharedValue(0);
  const hold = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    enter.set(0);
    enter.set(withTiming(1, reducedMotion
      ? { duration: ENTER_REDUCED_MS }
      : { duration: ENTER_MS, easing: Easing.bezier(...EMPHASIZED) }));
    cancelAnimation(wobble);
    wobble.set(0);
    if (!reducedMotion) {
      // Two ±3° rotations about the egg's base, 600 ms, once per focus.
      const step = { duration: 150, easing: Easing.bezier(...STANDARD) };
      wobble.set(withSequence(withTiming(3, step), withTiming(-3, step), withTiming(3, step), withTiming(0, step)));
    }
    return () => cancelAnimation(wobble);
  }, [index, reducedMotion, enter, wobble]);

  useEffect(() => {
    cancelAnimation(hold);
    hold.set(holding ? withTiming(1, { duration: TRACKPAD_GESTURE.holdMs, easing: Easing.linear }) : 0);
  }, [holding, hold]);

  // Explicit dependency arrays: Storybook (web, no Reanimated Babel plugin) needs them.
  const stageStyle = useAnimatedStyle(() => {
    const e = enter.get();
    if (reducedMotion) return { opacity: e, transform: [] };
    // Scale and slide from the tile's slot in the row to the whole container.
    const startScale = 1 / count;
    const startX = ((index + 0.5) / count - 0.5) * width.get();
    return {
      opacity: 1,
      transform: [{ translateX: startX * (1 - e) }, { scale: startScale + (1 - startScale) * e }],
    };
  }, [enter, width, reducedMotion, count, index]);
  const mediaStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.get()}deg` }], transformOrigin: 'bottom' }), [wobble]);
  const cardStyle = useAnimatedStyle(() => {
    const e = enter.get();
    return { opacity: e, transform: [{ translateY: reducedMotion ? 0 : 8 * (1 - e) }] };
  }, [enter, reducedMotion]);
  const holdStyle = useAnimatedStyle(() => ({ width: `${hold.get() * 100}%` }), [hold]);

  return (
    <Animated.View
      onLayout={(e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width)}
      style={[{ flex: 1, flexDirection: placement === 'trailing' ? 'row' : 'column' }, stageStyle]}
    >
      <View {...(hiddenA11y(true) as object)} className="flex-1 overflow-hidden" style={{ flexBasis: placement === 'trailing' ? '66%' : undefined }}>
        <Animated.View style={[{ flex: 1 }, mediaStyle]}>{item.media}</Animated.View>
        <View className="absolute bottom-0 left-0 right-0 bg-signage-black/40" style={{ height: 4 }}>
          <Animated.View style={[{ height: 4, backgroundColor: palette.orange[500] }, holdStyle]} />
        </View>
      </View>
      {overlay ? (
        <Animated.View
          style={[
            placement === 'trailing'
              ? { width: '34%', maxWidth: 400, justifyContent: 'center', padding: 12 }
              : { position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: '60%' },
            cardStyle,
          ]}
        >
          {overlay}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Three (2–4) equal choices with no default, for M08's eggs and later
 * pickers. Browsing: a row of 4:5 tiles, labels under each. Focusing a tile
 * (tap, arrow keys, the trackpad's step) makes it fill the container,
 * entering from its slot (300 ms `emphasized`; reduced: 200 ms cross-fade),
 * wobbles once, and raises `focusedOverlay`. The other choices step aside
 * into a row of labelled radios above the stage, so every choice stays one
 * tap or one arrow away and nothing focusable is ever invisible.
 *
 * Semantics: a radio group with nothing checked until a tile is focused
 * (WAI-ARIA APG via `radio-group.ts`): arrows wrap, Home/End jump, Escape
 * returns to browsing. Only the checked radio, or the first while none is,
 * is a Tab stop on web.
 */
export function ChoiceTriptych({
  items, focusedIndex, onFocusChange, accessibilityLabel, focusedOverlay, overlayPlacement = 'bottom',
  holding = false, reducedMotion, testID, itemTestID,
}: ChoiceTriptychProps) {
  const count = items.length;
  const checked = focusedIndex ?? -1;
  const focus = (next: number | null) => {
    if (next === focusedIndex) return;
    haptics.selection();
    onFocusChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const next = triptychKey(event.key, focusedIndex, count);
    if (next === undefined) return;
    event.preventDefault();
    if (next !== null) {
      event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
    }
    focus(next);
  };
  const focused = focusedIndex === null ? undefined : items[focusedIndex];
  const approaching = focused !== undefined;

  const radio = (item: ChoiceTriptychItem, i: number, children: ReactNode, className: string) => {
    const on = i === checked;
    return (
      <Pressable
        key={item.key}
        role="radio"
        aria-checked={on}
        accessibilityState={{ checked: on, selected: on }}
        accessibilityLabel={item.accessibilityLabel}
        aria-label={item.accessibilityLabel}
        {...(testIdProps(itemTestID?.(item)) as object)}
        onPress={() => focus(i)}
        onKeyDown={isWeb ? onKeyDown : undefined}
        {...(isWeb ? ({ tabIndex: rovingTabIndex(i, checked) } as object) : {})}
        className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
      >
        {children}
      </Pressable>
    );
  };

  return (
    <View
      testID={testID}
      role="radiogroup"
      accessibilityRole="radiogroup"
      aria-label={accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      className="flex-1"
    >
      {approaching ? (
        <>
          <View className="flex-row gap-2 pb-2">
            {items.map((item, i) =>
              radio(
                item,
                i,
                <Text className={`text-type-label text-text ${i === checked ? 'underline' : ''}`} numberOfLines={1}>{item.label}</Text>,
                `min-h-target flex-1 items-center justify-center border-2 px-2 ${i === checked ? 'border-text' : 'border-border'}`,
              ),
            )}
          </View>
          <Stage
            key={focused.key}
            item={focused}
            index={checked}
            count={count}
            overlay={focusedOverlay}
            placement={overlayPlacement}
            holding={holding}
            reducedMotion={reducedMotion}
          />
        </>
      ) : (
        <View className="flex-row gap-3">
          {items.map((item, i) =>
            radio(
              item,
              i,
              <>
                <View {...(hiddenA11y(true) as object)} className="w-full overflow-hidden border-2 border-border" style={{ aspectRatio: 4 / 5 }}>
                  {item.media}
                </View>
                <Text className="mt-2 text-center text-type-label text-text">{item.label}</Text>
              </>,
              'min-w-target flex-1 items-stretch',
            ),
          )}
        </View>
      )}
    </View>
  );
}
