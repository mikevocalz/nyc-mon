/**
 * Web: the stage's controls are hidden until one takes keyboard focus
 * (WCAG 2.4.7, focus visible). Then the group opens in the stage's top-left
 * corner and shows ONLY the focused control, as a chip with the focus ring,
 * so a keyboard user sees which action Enter will run. The other controls
 * stay at 1 px and zero opacity; nothing shows while the focus is elsewhere.
 */
export const STAGE_CONTROLS_LOOK = {
  group:
    'absolute left-0 top-0 z-50 h-px w-px overflow-hidden opacity-0 ' +
    'focus-within:left-4 focus-within:top-4 focus-within:h-auto focus-within:w-auto focus-within:overflow-visible focus-within:opacity-100',
  item:
    'h-px w-px overflow-hidden opacity-0 ' +
    'focus-within:h-auto focus-within:w-auto focus-within:overflow-visible focus-within:opacity-100 ' +
    'focus-within:rounded-md focus-within:bg-ink-950 focus-within:p-1 focus-within:ring-2 focus-within:ring-focus',
} as const;
