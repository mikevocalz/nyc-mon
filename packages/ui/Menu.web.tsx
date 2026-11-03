'use client';
import { useCallback, useEffect, useRef } from 'react';
import { tv } from 'tailwind-variants';
import { TYPE_SCALE_TV } from './type-scale';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { TONE_CLASSES, resolveControlTone } from './district';
import { ROW_BAR } from './surface-look';
import type { MenuProps } from './Menu.types';
import { placeMenu } from './Menu.web-position';

/**
 * Web menu in the NYC-MON look: a night panel with a heavy keyline over a
 * solid depth plate, the title on a tone cornice band, and items that take a
 * tone accent bar and tint on hover or keyboard focus. Destructive items are
 * apple red.
 *
 * `details`/`summary` owns disclosure and keyboard activation. Selection,
 * Escape and outside-pointer dismissal are explicit: details does not provide
 * them automatically. Its DOM open state stays imperative rather than being
 * duplicated in React state. The summary remains the focus return target.
 */
const menu = tv({
  slots: {
    panel: 'fixed z-[1000]',
    plate: 'absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink-950',
    face: 'relative border-2 border-ink-700 bg-ink-900 py-1',
    cornice: 'mb-1 px-3 py-1.5',
    title: 'font-display text-sm',
    item:
      'min-h-11 justify-center border-l-4 border-l-transparent px-3 py-2 transition-colors duration-fast ' +
      'focus:outline-none motion-reduce:transition-none',
    label: 'text-base',
  },
  variants: {
    appearance: {
      default: {},
      studio: {
        plate: 'hidden',
        face: 'rounded-[4px] border border-[#4A4D54] bg-[#2C2E33] py-1',
        cornice: 'mb-1 border-b border-[#45484F] bg-transparent px-3 py-2',
        title: 'font-sans font-medium text-[12px] text-[#AEB4BE]',
        item: 'border-l-0 px-3 py-2',
        label: 'font-sans font-medium text-[13px]',
      },
    },
  },
  defaultVariants: { appearance: 'default' },
}, TYPE_SCALE_TV);

export function Menu({ children, actions, onAction, title, className, district, tone, appearance = 'default' }: MenuProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const reposition = useRef<(() => void) | null>(null);
  const close = useCallback((restoreFocus: boolean) => {
    const element = details.current;
    if (!element?.open) return;
    const popup = element.querySelector<HTMLElement>('[role="menu"]');
    if (typeof popup?.hidePopover === 'function' && popup.matches(':popover-open')) popup.hidePopover();
    element.open = false;
    if (restoreFocus && element.isConnected) element.querySelector('summary')?.focus();
  }, []);
  useEffect(() => {
    const element = details.current;
    const owner = element?.ownerDocument;
    const window = owner?.defaultView;
    const popup = element?.querySelector<HTMLElement>('[role="menu"]');
    const trigger = element?.querySelector('summary');
    if (!element || !owner || !window || !popup || !trigger) return;
    // The browser top layer escapes transformed/clipped ancestors. The fixed
    // fallback remains available for browsers without the Popover API.
    const topLayer = typeof popup.showPopover === 'function';
    if (topLayer) popup.setAttribute('popover', 'manual');
    Object.assign(popup.style, { position: 'fixed', inset: 'auto', margin: '0', padding: '0', border: '0', background: 'transparent', zIndex: '1000', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain', overflowWrap: 'anywhere' });
    let frame = 0;
    const position = () => {
      if (!element.open || !element.isConnected || !popup.isConnected) return;
      if (topLayer && !popup.matches(':popover-open')) popup.showPopover();
      const viewport = window.visualViewport;
      const bounds = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0, width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight };
      const anchor = trigger.getBoundingClientRect();
      popup.style.width = `${Math.max(1, Math.min(Math.max(208, anchor.width), bounds.width - 16))}px`;
      const height = popup.scrollHeight + popup.offsetHeight - popup.clientHeight;
      const placement = placeMenu(anchor, bounds, Math.max(208, anchor.width), height);
      Object.assign(popup.style, { left: `${placement.left}px`, top: `${placement.top}px`, width: `${placement.width}px`, maxHeight: `${placement.maxHeight}px`, visibility: 'visible' });
    };
    const schedule = () => {
      if (!element.open || frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; position(); });
    };
    const onToggle = (event: Event) => {
      if (event.target !== element) return;
      if (element.open) position();
      else if (topLayer && popup.matches(':popover-open')) popup.hidePopover();
    };
    reposition.current = schedule;
    element.addEventListener('toggle', onToggle);
    window.addEventListener('resize', schedule);
    owner.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    if (element.open) position();
    const onPointerDown = (event: PointerEvent) => {
      const element = details.current;
      if (element?.open && !event.composedPath().includes(element)) close(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.current?.open) return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    owner.addEventListener('pointerdown', onPointerDown, true);
    owner.addEventListener('keydown', onEscape, true);
    return () => {
      reposition.current = null;
      if (frame) window.cancelAnimationFrame(frame);
      element.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', schedule);
      owner.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      if (topLayer && popup.matches(':popover-open')) popup.hidePopover();
      popup.removeAttribute('popover');
      owner.removeEventListener('pointerdown', onPointerDown, true);
      owner.removeEventListener('keydown', onEscape, true);
    };
  }, [close]);
  useEffect(() => { reposition.current?.(); }, [actions, title]);
  const toneName = resolveControlTone(tone, district);
  const t = TONE_CLASSES[toneName];
  const bar = ROW_BAR[toneName];
  const studio = appearance === 'studio';
  const s = menu({ appearance });
  return (
    <details ref={details} className={`relative open:z-50 ${className ?? ''}`}>
      <summary className="cursor-pointer list-none">{children}</summary>
      <View role="menu" className={s.panel()} style={{ visibility: 'hidden' }}>
        <View aria-hidden className={s.plate()} />
        <View className={s.face()}>
          {title ? (
            <View className={s.cornice({ className: studio ? undefined : t.face })}>
              <Text className={s.title({ className: studio ? undefined : toneName === 'apple' ? 'text-ink-950' : t.onFace })}>{title}</Text>
            </View>
          ) : null}
          {actions.map((action) => (
            <Pressable
              key={action.id}
              role="menuitem"
              aria-disabled={action.disabled}
              onPress={() => {
                if (action.disabled) return;
                onAction(action.id);
                close(true);
              }}
              className={s.item({
                className: action.disabled
                  ? 'opacity-40'
                  : action.destructive
                    ? 'hover:border-l-apple-500 hover:bg-apple-500/15 focus:border-l-apple-500 focus:bg-apple-500/15'
                    : studio ? 'hover:bg-white/5 focus:bg-white/10' : `${bar.hover} ${bar.hoverTint} ${bar.focus} ${bar.focusTint}`,
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
