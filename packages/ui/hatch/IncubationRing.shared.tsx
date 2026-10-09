'use client';
import type { KeyboardEvent, ReactNode } from 'react';
import { Platform } from 'react-native';
import { haptics } from '../haptics';
import { rovingTabIndex } from '../radio-group';
import { hiddenA11y, testIdProps } from '../hlynk/a11y';
import { Pressable, Text, View } from '../tw';
import { arcMidpoint, stepStop, stopArcs } from '../care/ring-model';
import { RING_STROKE, type IncubationRingChoiceProps } from './IncubationRing.types';

const isWeb = Platform.OS === 'web';
/** Stop hit target: 48 pt square (44 pt minimum, 48 dp Android). */
const TARGET_PT = 48;

/** Ring geometry for a size and stroke: centre, stroke radius, and the radius the stop labels sit on. */
export function ringLayout(sizePt: number, strokePt: number) {
  const c = sizePt / 2;
  const r = c - strokePt / 2;
  return { c, r, labelR: r - strokePt / 2 - TARGET_PT / 2 };
}

/**
 * The accessible layer of the choice ring: a radio group whose radios sit over
 * each stop's arc, inside the stroke. Arrows step (shorter / longer, ends hold),
 * Home and End jump; only the chosen stop is a Tab stop on web.
 */
export function RingStops<V extends number>({
  stops, value, onChange, sizePt, scheme = 'daylit', stopTestID,
}: Pick<IncubationRingChoiceProps<V>, 'stops' | 'value' | 'onChange' | 'sizePt' | 'scheme' | 'stopTestID'>) {
  const { c, r, labelR } = ringLayout(sizePt, RING_STROKE.choice);
  const arcs = stopArcs(stops.length, RING_STROKE.gap, r);
  const checked = stops.findIndex((s) => s.value === value);
  const pick = (i: number) => {
    const s = stops[i];
    if (!s || !onChange || s.value === value) return;
    haptics.selection();
    onChange(s.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const k = event.key;
    let next: number | null = null;
    if (k === 'Home') next = 0;
    else if (k === 'End') next = stops.length - 1;
    else if (k === 'ArrowRight' || k === 'ArrowDown') next = stepStop(stops.length, checked < 0 ? null : checked, 1);
    else if (k === 'ArrowLeft' || k === 'ArrowUp') next = stepStop(stops.length, checked < 0 ? null : checked, -1);
    if (next === null) return;
    event.preventDefault();
    event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
    pick(next);
  };
  const ink = scheme === 'night' ? 'text-ink-50' : 'text-signage-black';
  return (
    <>
      {stops.map((stop, i) => {
        const p = arcMidpoint(c, c, labelR, arcs[i]!);
        const on = i === checked;
        return (
          <Pressable
            key={stop.value}
            role="radio"
            aria-checked={on}
            accessibilityState={{ checked: on, selected: on, disabled: !onChange }}
            accessibilityLabel={stop.accessibilityLabel}
            aria-label={stop.accessibilityLabel}
            {...(testIdProps(stopTestID?.(stop.value)) as object)}
            onPress={onChange ? () => pick(i) : undefined}
            onKeyDown={isWeb ? onKeyDown : undefined}
            {...(isWeb ? ({ tabIndex: rovingTabIndex(i, checked) } as object) : {})}
            className="absolute items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            style={{ left: p.x - TARGET_PT / 2, top: p.y - TARGET_PT / 2, width: TARGET_PT, height: TARGET_PT }}
          >
            <Text className={`text-type-label tabular-nums ${ink} ${on ? 'underline' : ''}`}>{stop.label}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

/** Square box holding the drawn ring, the centre content and (choice ring) the stops. */
export function RingFrame({
  sizePt, canvas, centre, children, testID, group,
}: {
  sizePt: number;
  canvas: ReactNode;
  centre?: ReactNode;
  children?: ReactNode;
  testID?: string;
  /** Radio-group semantics (choice ring). Omitted (countdown): only the centre content is exposed. */
  group?: { label: string };
}) {
  const a11y = group
    ? { role: 'radiogroup' as const, accessibilityRole: 'radiogroup' as const, 'aria-label': group.label, accessibilityLabel: group.label }
    : {};
  return (
    <View testID={testID} style={{ width: sizePt, height: sizePt }} {...(a11y as object)}>
      {/* The drawing is decorative: the stops (choice) or the time text (countdown) carry the meaning. */}
      <View {...(hiddenA11y(true) as object)} className="absolute inset-0" style={{ pointerEvents: 'none' }}>{canvas}</View>
      {centre ? (
        <View className="absolute inset-0 items-center justify-center" style={{ pointerEvents: 'box-none' }}>{centre}</View>
      ) : null}
      {children}
    </View>
  );
}
