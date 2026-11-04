/** The existing console detail-pane breakpoint, in layout units. */
export function keyValueListColumns(paneWidth: number, maximum: 1 | 2 = 2): 1 | 2 {
  return maximum === 2 && Number.isFinite(paneWidth) && paneWidth >= 600 ? 2 : 1;
}

/**
 * Two border-box halves, with one rem of padding on each side of the gutter,
 * preserve the original two-rem gap without mixed-unit calc() on native.
 * Logical edges keep the gutter between the pairs in both LTR and RTL.
 */
export function keyValuePairClassName(columns: 1 | 2, index: number): string {
  if (columns === 1) return 'w-full';
  return index % 2 === 0 ? 'w-1/2 pe-4' : 'w-1/2 ps-4';
}
