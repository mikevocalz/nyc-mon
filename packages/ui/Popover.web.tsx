'use client';
import { useEffect, useId, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { PopoverTrigger } from './Popover.surface';
import { placePopover, popoverVessel } from './Popover.geometry';
import { useReservedRegions } from './reserved-regions';
import type { PopoverProps } from './Popover.types';

/**
 * Source-owned web instrument popover. Native APIs live in the .ios/.android
 * siblings; this is the only kit source permitted to touch browser DOM.
 * Top-layer Popover API when present, clamped fixed-position fallback.
 */
export function Popover({
  open, onOpenChange, trigger, children, accessibleLabel, title, placement = 'auto',
}: PopoverProps) {
  const { width, height } = useWindowDimensions();
  const regions = useReservedRegions();
  const sheet = popoverVessel({ width, height, regions }) === 'sheet';
  const callback = useRef(onOpenChange);
  callback.current = onOpenChange;
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusAfterClose = useRef(false);
  const id = useId();

  // A rich instrument is not a menu. Below usable width use our source-owned
  // drag/dismiss/keyboard-aware universal sheet, not a crushed desktop inspector.
  const floating = open && !sheet;

  useEffect(() => {
    if (!floating) {
      if (focusAfterClose.current) {
        root.current?.querySelector<HTMLButtonElement>('button')?.focus();
        focusAfterClose.current = false;
      }
      return;
    }
    const element = panel.current;
    const triggerBox = root.current;
    const owner = element?.ownerDocument;
    const view = owner?.defaultView;
    if (!element || !triggerBox || !owner || !view) return;
    let frame = 0;
    const topLayer = typeof element.showPopover === 'function' &&
      typeof element.hidePopover === 'function';
    if (topLayer) {
      element.setAttribute('popover', 'manual');
      element.showPopover();
    }
    const position = () => {
      if (!element.isConnected || !triggerBox.isConnected) return;
      const visual = view.visualViewport;
      const viewport = {
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        width: visual?.width ?? view.innerWidth,
        height: visual?.height ?? view.innerHeight,
      };
      const box = triggerBox.getBoundingClientRect();
      const direction = view.getComputedStyle(triggerBox).direction === 'rtl' ? 'rtl' : 'ltr';
      const desiredWidth = Math.min(360, Math.max(280, box.width));
      const naturalHeight = element.scrollHeight;
      const rect = placePopover(
        { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        viewport, desiredWidth, naturalHeight || 240, placement, direction,
      );
      Object.assign(element.style, {
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        maxHeight: rect.maxHeight + 'px',
        overflowY: rect.scrollable ? 'auto' : 'visible',
        visibility: 'visible',
      });
    };
    const schedule = () => {
      if (frame) return;
      frame = view.requestAnimationFrame(() => { frame = 0; position(); });
    };
    position();
    const resizeObserver = typeof view.ResizeObserver === 'function'
      ? new view.ResizeObserver(schedule) : null;
    resizeObserver?.observe(triggerBox);
    // The content may change height while a color/brush control is visible.
    resizeObserver?.observe(element);
    const outside = (event: PointerEvent) => {
      const path = event.composedPath();
      if (path.includes(triggerBox) || path.includes(element)) return;
      callback.current(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      focusAfterClose.current = true;
      callback.current(false);
    };
    owner.addEventListener('pointerdown', outside, true);
    owner.addEventListener('keydown', escape, true);
    owner.addEventListener('scroll', schedule, true);
    view.addEventListener('resize', schedule);
    view.visualViewport?.addEventListener('resize', schedule);
    view.visualViewport?.addEventListener('scroll', schedule);
    // Focus the first live instrument control. This is non-modal and does not
    // trap Tab, but Escape always closes and returns focus to the trigger.
    const first = element.querySelector<HTMLElement>(
      'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    (first ?? element).focus();
    return () => {
      if (frame) view.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      owner.removeEventListener('pointerdown', outside, true);
      owner.removeEventListener('keydown', escape, true);
      owner.removeEventListener('scroll', schedule, true);
      view.removeEventListener('resize', schedule);
      view.visualViewport?.removeEventListener('resize', schedule);
      view.visualViewport?.removeEventListener('scroll', schedule);
      if (topLayer && element.matches(':popover-open')) element.hidePopover();
      element.removeAttribute('popover');
    };
  }, [floating, placement]);

  return (
    <>
      <div ref={root} className="relative inline-flex">
        <PopoverTrigger
          label={accessibleLabel}
          expanded={open}
          onPress={() => onOpenChange(!open)}
        >
          {trigger}
        </PopoverTrigger>
      </div>
      {sheet ? (
        <BottomSheet
          open={open}
          onClose={() => onOpenChange(false)}
          title={title ?? accessibleLabel}
          closeLabel={'Close ' + accessibleLabel}
          scheme="system"
        >
          {children}
        </BottomSheet>
      ) : floating ? (
        // Browser-only native DOM is confined to /ui. In supported browsers
        // showPopover() promotes this surface into the top layer.
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-modal="false"
          aria-label={accessibleLabel}
          tabIndex={-1}
          className="fixed z-[1000] rounded-md border border-border bg-surface-raised text-text shadow-overlay"
          style={{ left: -9999, top: -9999, visibility: 'hidden', boxSizing: 'border-box' }}
        >
          {title ? (
            <div className="sticky top-0 border-b border-border bg-surface-raised px-4 py-3 text-sm font-semibold">
              {title}
            </div>
          ) : null}
          <div className="p-4">{children}</div>
        </div>
      ) : null}
    </>
  );
}
