'use client';
import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Badge } from '../Badge';
import { Heading, List, ListItem, Paragraph, Time } from '../html';
import type { NeonColorInput } from '../neon/colors';
import { AnimatedView, cssAnimation } from '../progress/motion';
import { View } from '../tw';
import { useSizeClass } from '../use-size-class';
import { itemSide, segmentServed, stationStates, type StationState, type TimelineAlign } from './timeline-model';
import { resolveTone, TONE_CLASSES, type District, type Tone } from '../district';

export type { TimelineAlign };
export type TimelineVariant = 'default' | 'glow' | 'minimal' | 'stepped';
export type TimelineLineStyle = 'solid' | 'dashed' | 'glow' | 'none';
export type TimelineDotStyle = 'circle' | 'square' | 'diamond';
export type TimelineDotAnim = 'none' | 'pulse' | 'ping';

export interface TimelineItemData {
  /** Short date or time above the title. Pass an ISO string in `dateTime` for machines. */
  date?: string;
  dateTime?: string;
  title: string;
  description?: string;
  /** A small badge chip beside the title, e.g. "New" or "v2.0". */
  badge?: string;
  /** Drawn inside the current station. */
  icon?: ReactNode;
  /** The current stop. Earlier stops read as served, later ones as upcoming. */
  active?: boolean;
}

/**
 * A subway line: stations on a solid route bar, lit up to the current stop.
 * Ported from NeonBlade UI's Timeline (MIT, see THIRD-PARTY-NOTICES.md),
 * keeping its props; the glowing connector became a route stripe with local
 * and express stations.
 */
export interface TimelineProps {
  items: TimelineItemData[];
  /** Route colour: brand token or NeonBlade preset. Defaults to the district tone. */
  color?: NeonColorInput | Tone;
  /** default, glow (lit route glows), minimal (thin rail, small stops), stepped (each stop on a platform). Default default. */
  variant?: TimelineVariant;
  /** solid, dashed (planned service), glow, none. Default solid. */
  lineStyle?: TimelineLineStyle;
  /** Default square, a solid station block. circle (the subway map's round stop) is opt-in. */
  dotStyle?: TimelineDotStyle;
  /** Motion on the current stop. Default none. */
  dotAnim?: TimelineDotAnim;
  /** Text side. Alternate zig-zags on wide screens and stacks left on phones. Default left. */
  align?: TimelineAlign;
  /** Stagger the stops in on mount. Default false. */
  animate?: boolean;
  /** Default midtown. */
  district?: District;
  /** Names the list for screen readers, e.g. "Order status". */
  accessibilityLabel?: string;
  className?: string;
}

const line = tv({
  slots: {
    root: 'm-0 w-full p-0',
    item: 'flex-row',
    rail: 'relative w-10 items-center',
    track: 'absolute left-1/2',
    stationWrap: 'relative mt-1 items-center justify-center',
    station: 'items-center justify-center border-ink-950',
    ring: 'absolute inset-0',
    body: 'flex-1 gap-1 pb-8',
    platform: 'gap-1 border-2 border-ink-700 bg-ink-900 p-3',
    titleRow: 'flex-row flex-wrap items-center gap-2',
    date: 'text-xs font-semibold text-text-muted',
    title: 'my-0 font-display text-lg text-text',
    description: 'my-0 text-sm leading-snug text-text-muted',
    spacer: 'flex-1',
  },
  variants: {
    variant: {
      default: { track: '-ml-1 w-2' },
      glow: { track: '-ml-1 w-2' },
      minimal: { track: '-ml-0.5 w-1', title: 'font-sans text-base font-semibold' },
      stepped: { track: '-ml-1 w-2', body: 'pb-4' },
    },
  },
});

const STATION_SIZE: Record<StationState, { full: number; minimal: number }> = {
  served: { full: 16, minimal: 10 },
  current: { full: 26, minimal: 16 },
  upcoming: { full: 16, minimal: 10 },
};

export function Timeline({
  items,
  color,
  variant = 'default',
  lineStyle = 'solid',
  dotStyle = 'square',
  dotAnim = 'none',
  align = 'left',
  animate = false,
  district = 'midtown',
  accessibilityLabel,
  className,
}: TimelineProps) {
  const reduced = useReducedMotion();
  const compact = useSizeClass() === 'compact';
  const tone = TONE_CLASSES[resolveTone(district, color)];
  const s = line({ variant });
  const states = stationStates(items);
  const glowRoute = variant === 'glow' || lineStyle === 'glow';
  const shape = dotStyle === 'circle' ? 'rounded-full' : dotStyle === 'square' ? 'rounded-none' : 'rounded-none rotate-45';

  const track = (served: boolean, position: 'above' | 'below') => {
    if (lineStyle === 'none') return null;
    const fill =
      lineStyle === 'dashed'
        ? `border-l-4 border-dashed ${served ? tone.border : 'border-ink-700'}`
        : `${served ? tone.face : 'bg-ink-700'} ${served && glowRoute ? tone.glow : ''}`;
    return (
      <View
        aria-hidden
        className={s.track({ className: `${fill} ${position === 'above' ? 'top-0 h-[18px]' : 'bottom-0 top-[18px]'}` })}
      />
    );
  };

  return (
    <List aria-label={accessibilityLabel} className={s.root({ className })}>
      {items.map((item, i) => {
        const state = states[i]!;
        const side = itemSide(align, i, compact);
        const size = STATION_SIZE[state][variant === 'minimal' ? 'minimal' : 'full'];
        const current = state === 'current';
        const stationFill =
          state === 'upcoming'
            ? 'border-2 bg-ink-800 border-ink-600'
            : current
              ? `border-4 bg-ink-50 ${tone.border} ${variant === 'glow' ? tone.glow : ''}`
              : 'border-2 bg-ink-50';

        const content = (
          <View className={variant === 'stepped' ? s.platform() : 'gap-1'}>
            {item.date ? <Time dateTime={item.dateTime} className={s.date()}>{item.date}</Time> : null}
            <View className={s.titleRow({ className: side === 'left' ? 'justify-end' : '' })}>
              <Heading level={3} className={s.title()}>{item.title}</Heading>
              {item.badge ? <Badge variant="neon" size="xs" district={district} color={color} label={item.badge} /> : null}
            </View>
            {item.description ? (
              <Paragraph className={s.description({ className: side === 'left' ? 'text-right' : '' })}>
                {item.description}
              </Paragraph>
            ) : null}
          </View>
        );

        const body = (
          // Padding sits on an inner view: on the flex-1 body it would widen that side and knock the rail off centre.
          <View className={s.body({ className: side === 'left' ? 'items-end' : '' })}>
            <View className={side === 'left' ? 'pr-3' : 'pl-3'}>{content}</View>
          </View>
        );

        return (
          <ListItem key={`${item.title}-${i}`} aria-current={current ? 'step' : undefined} className="list-none">
            <AnimatedView
              className={s.item()}
              // Animated: the staggered entrance.
              style={animate ? cssAnimation(reduced, 'enter', 360, { delay: i * 90, iterations: 1, timing: 'ease-out' }) : undefined}
            >
              {side === 'left' ? body : align === 'alternate' && !compact ? <View className={s.spacer()} /> : null}
              <View className={s.rail()}>
                {i > 0 ? track(segmentServed(states, i - 1), 'above') : null}
                {i < items.length - 1 ? track(segmentServed(states, i), 'below') : null}
                {/* Station size depends on its state and the variant. */}
                <View className={s.stationWrap()} style={{ width: 28, height: 28 }}>
                  {current && dotAnim !== 'none' ? (
                    <AnimatedView
                      aria-hidden
                      className={`${s.ring()} ${shape} ${tone.face}`}
                      // Animated: the current-stop beacon.
                      style={{
                        width: size,
                        height: size,
                        left: (28 - size) / 2,
                        top: (28 - size) / 2,
                        ...cssAnimation(reduced, dotAnim === 'ping' ? 'ping' : 'pulse', dotAnim === 'ping' ? 1400 : 1100, {
                          timing: 'ease-out',
                        }),
                      }}
                    />
                  ) : null}
                  <View
                    aria-hidden
                    className={s.station({ className: `${shape} ${stationFill}` })}
                    style={{ width: size, height: size }}
                  >
                    {current && item.icon ? item.icon : null}
                  </View>
                </View>
              </View>
              {side === 'right' ? body : align === 'alternate' && !compact ? <View className={s.spacer()} /> : null}
            </AnimatedView>
          </ListItem>
        );
      })}
    </List>
  );
}
