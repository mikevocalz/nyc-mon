'use client';
import { createContext, useContext } from 'react';
import { tv } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { Link } from './html';
import { Text } from './Text';
import { NIGHT_SCHEME } from './NightScope';
import { resolveControlTone, type ControlTone } from './district';
import { ROW_BAR } from './surface-look';
import type { ListProps, ListItemProps } from './List.types';

/**
 * Web list in the NYC-MON look: a night slab with a heavy keyline over a
 * solid depth plate, rows split by keylines. A row takes a tone accent bar
 * on its left edge when hovered, pressed, focused or `selected`. Pull to
 * refresh has no web equivalent, so `onRefresh` is accepted and ignored to
 * keep one prop set across platforms.
 */
const list = tv({
  slots: {
    root: 'relative mb-1.5 mr-1.5',
    plate: 'absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink-950',
    face: 'relative overflow-hidden border-2 border-ink-700 bg-ink-900',
    row:
      'border-b-2 border-l-4 border-b-ink-800 border-l-transparent transition-colors duration-fast ' +
      'last:border-b-0 focus:outline-none motion-reduce:transition-none',
    content: 'min-h-11 flex-row items-center gap-3 px-4 py-3',
    body: 'flex-1',
    title: 'text-base text-ink-50',
    support: 'text-sm text-silver-300',
  },
});

// The list's tone reaches its rows without every ListItem taking a prop.
const ToneContext = createContext<ControlTone>('orange');

export function List({ children, onRefresh: _onRefresh, className, district, tone }: ListProps) {
  const s = list();
  return (
    <View className={s.root({ className })}>
      <View aria-hidden className={s.plate()} />
      <View role="list" className={s.face({ className: NIGHT_SCHEME })}>
        <ToneContext.Provider value={resolveControlTone(tone, district)}>{children}</ToneContext.Provider>
      </View>
    </View>
  );
}

export function ListItem({
  children, onPress, leading, trailing, supportingText, className, selected, current, href,
}: ListItemProps) {
  const bar = ROW_BAR[useContext(ToneContext)];
  const s = list();
  const content = (
    <View className={s.content()}>
      {leading}
      <View className={s.body()}>
        <Text className={s.title()}>{children}</Text>
        {supportingText ? <Text className={s.support()}>{supportingText}</Text> : null}
      </View>
      {trailing}
    </View>
  );
  // `current` is the page marker: same look as selected, aria-current="page".
  const state = selected || current ? `${bar.bar} ${bar.tint}` : '';

  // Nav items are real links (G14): an anchor with aria-current, not a pressable.
  if (href) {
    return (
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        className={s.row({
          className: `block no-underline ${state} ${bar.hover} ${bar.hoverTint} ${bar.focus} ${bar.focusTint} ${className ?? ''}`,
        })}
      >
        {content}
      </Link>
    );
  }

  if (!onPress) {
    return <View role="listitem" className={s.row({ className: `${state} ${className ?? ''}` })}>{content}</View>;
  }

  return (
    <Pressable
      role="listitem"
      aria-selected={selected}
      aria-current={current ? 'page' : undefined}
      onPress={onPress}
      className={s.row({
        className: `${state} ${bar.hover} ${bar.hoverTint} ${bar.focus} ${bar.focusTint} active:opacity-90 ${className ?? ''}`,
      })}
    >
      {content}
    </Pressable>
  );
}
