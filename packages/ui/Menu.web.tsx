'use client';
import { tv } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { TONE_CLASSES, resolveControlTone } from './district';
import { ROW_BAR } from './surface-look';
import type { MenuProps } from './Menu.types';

/**
 * Web menu in the NYC-MON look: a night panel with a heavy keyline over a
 * solid depth plate, the title on a tone cornice band, and items that take a
 * tone accent bar and tint on hover or keyboard focus. Destructive items are
 * apple red.
 *
 * `details`/`summary` gives open-on-click, close-on-outside-click and Escape
 * for free, with the correct semantics — no state, no listeners, no focus trap
 * to get wrong. (No role on the summary: a role there kills the toggle.)
 */
const menu = tv({
  slots: {
    panel: 'absolute right-0 top-full z-10 mt-2 min-w-52',
    plate: 'absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink-950',
    face: 'relative border-2 border-ink-700 bg-ink-900 py-1',
    cornice: 'mb-1 px-3 py-1.5',
    title: 'font-display text-sm',
    item:
      'min-h-11 justify-center border-l-4 border-l-transparent px-3 py-2 transition-colors duration-fast ' +
      'focus:outline-none motion-reduce:transition-none',
    label: 'text-base',
  },
});

export function Menu({ children, actions, onAction, title, className, district, tone }: MenuProps) {
  const toneName = resolveControlTone(tone, district);
  const t = TONE_CLASSES[toneName];
  const bar = ROW_BAR[toneName];
  const s = menu();
  return (
    <details className={`relative ${className ?? ''}`}>
      <summary className="cursor-pointer list-none">{children}</summary>
      <View role="menu" className={s.panel()}>
        <View aria-hidden className={s.plate()} />
        <View className={s.face()}>
          {title ? (
            <View className={s.cornice({ className: t.face })}>
              <Text className={s.title({ className: toneName === 'apple' ? 'text-ink-950' : t.onFace })}>{title}</Text>
            </View>
          ) : null}
          {actions.map((action) => (
            <Pressable
              key={action.id}
              role="menuitem"
              aria-disabled={action.disabled}
              onPress={() => !action.disabled && onAction(action.id)}
              className={s.item({
                className: action.disabled
                  ? 'opacity-40'
                  : action.destructive
                    ? 'hover:border-l-apple-500 hover:bg-apple-500/15 focus:border-l-apple-500 focus:bg-apple-500/15'
                    : `${bar.hover} ${bar.hoverTint} ${bar.focus} ${bar.focusTint}`,
              })}
            >
              <Text className={s.label({ className: action.destructive ? 'text-apple-400' : 'text-ink-50' })}>
                {action.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </details>
  );
}
