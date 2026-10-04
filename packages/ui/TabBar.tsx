'use client';
import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Nav } from './primitives';
import { View, Text, Pressable } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { TONE_CLASSES, resolveControlTone, toneInput, toneVariants, type ControlTone, type District } from './district';

// NYC-MON bottom tab bar. A night bar under a heavy tone keyline; the active
// tab is a solid tone chip on a depth plate; the emphasized center tab is a
// raised corner-cut tile. Presentational: active state and handlers come in
// via props (the nav shell owns routing).
const tabBar = tv({
  slots: {
    root: 'w-full bg-ink-950',
    keyline: 'h-1 w-full',
    row: 'flex-row items-stretch border-t-2 border-ink-800 px-1 pb-1.5 pt-1.5 md:px-4',
    tab:
      'group min-h-14 flex-1 items-center justify-center rounded-none px-0.5 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
    chip: 'relative min-w-14 items-center md:min-w-20',
    plate: 'absolute inset-0 translate-x-[3px] translate-y-[3px]',
    face:
      'items-center gap-1 px-2 py-1.5 transition-colors duration-fast motion-reduce:transition-none md:flex-row md:gap-2 md:px-3',
    label: 'font-display text-xs leading-tight md:text-sm',
    emphasis: '-mt-5 items-center gap-1',
    emphasisLabel: 'font-display text-xs leading-tight md:text-sm',
    faceOn: '',
    labelOn: '',
  },
  variants: {
    // Active chip parts read the tone table: face, plate step, ink on the face.
    tone: toneVariants((c) => ({ keyline: c.face, emphasisLabel: c.text, plate: c.plate, faceOn: c.face, labelOn: c.onFace })),
    active: {
      true: { face: '' },
      false: { face: 'group-hover:bg-ink-800', label: 'text-silver-300' },
    },
  },
  defaultVariants: { active: false },
});

/** State handed to an icon render function, so the glyph can match the chip. */
export interface TabIconState {
  active: boolean;
  /** Text-colour class for the icon: the face's ink when active, silver otherwise. */
  colorClass: string;
}

export interface TabBarTab {
  key: string;
  label: string;
  /**
   * A node, or a function that gets the active state and the colour class to
   * use. Prefer the function: a static node cannot follow the chip colour.
   */
  icon: ReactNode | ((state: TabIconState) => ReactNode);
  active?: boolean;
  onPress?: () => void;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  /** Key of a center tab rendered as a raised corner-cut tile. */
  emphasizedKey?: string;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

const renderIcon = (icon: TabBarTab['icon'], state: TabIconState) =>
  typeof icon === 'function' ? icon(state) : icon;

export function TabBar({ tabs, emphasizedKey, tone: toneProp, district, className }: TabBarProps) {
  const tone = resolveControlTone(toneProp, district);
  const onFace = TONE_CLASSES[tone].onFace;
  const s = tabBar({ tone });
  return (
    <Nav role="tablist" aria-label="Main navigation" className={s.root({ className })}>
      <View aria-hidden className={s.keyline()} />
      <View className={s.row()}>
        {tabs.map((tab) => {
          const active = !!tab.active;
          const emphasized = tab.key === emphasizedKey;
          return (
            <Pressable
              key={tab.key}
              role="tab"
              aria-label={tab.label}
              aria-selected={active}
              onPress={tab.onPress}
              className={s.tab()}
            >
              {emphasized ? (
                <View className={s.emphasis()}>
                  <CornerCutFrame tone={toneInput(tone)} cut={12} depth={4} glow={active ? 'low' : false} className="h-12 w-14 items-center justify-center">
                    {renderIcon(tab.icon, { active, colorClass: onFace })}
                  </CornerCutFrame>
                  <Text className={s.emphasisLabel()}>{tab.label}</Text>
                </View>
              ) : (
                <View className={s.chip()}>
                  {active ? <View aria-hidden className={s.plate()} /> : null}
                  <View className={s.face({ active, className: active ? s.faceOn() : undefined })}>
                    {renderIcon(tab.icon, { active, colorClass: active ? onFace : 'text-silver-300' })}
                    <Text className={s.label({ active, className: active ? s.labelOn() : undefined })}>{tab.label}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Nav>
  );
}
