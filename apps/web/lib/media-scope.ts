/**
 * A small `gsap.matchMedia()` stand-in for the route motion islands. Direct
 * GSAP imports are scoped to components/home/motion.ts (eslint
 * no-restricted-imports), so routes bind through the Kinetrell adapters and
 * use this for their desktop-only choreography.
 *
 * A setup runs once, when the scope is created inside the route's useGSAP
 * hook and its query matches. The hook's GSAP context records what the setup
 * builds and reverts it on unmount. A breakpoint crossed later takes effect on
 * the next mount of the page.
 */
export interface MediaScope {
  add(query: string, setup: () => void): void;
  revert(): void;
}

export function createMediaScope(matches: (query: string) => boolean = (q) => window.matchMedia(q).matches): MediaScope {
  return {
    add(query, setup) {
      if (matches(query)) setup();
    },
    // The owning useGSAP context reverts everything a setup created.
    revert() {},
  };
}

/** Shows elements a motion was meant to reveal but didn't bind, so nothing stays pre-hidden. */
export function showUnbound(elements: Iterable<Element>): void {
  for (const el of elements) if (el instanceof HTMLElement) el.style.opacity = '1';
}
