/**
 * The W01 motion marker convention, as a pure parser (import-free so it can
 * be unit-tested without a DOM). Elements carry marker ids:
 *   `mfx-<name>`  fade-in target — pre-hidden while `motion-armed` is set
 *   `mpx-<name>`  transform-only target (parallax/scrub), never pre-hidden
 *   `trg-<name>`  ScrollTrigger anchor — the section root
 * See motion.ts for how the parsed names bind to Kinetrell timelines.
 */
export type MotionMarkerKind = 'fade' | 'scrub' | 'trigger';

export interface MotionMarker {
  kind: MotionMarkerKind;
  /** The id without its prefix, e.g. `hero-title` for `mfx-hero-title`. */
  name: string;
}

const PREFIXES: Record<string, MotionMarkerKind> = {
  'mfx-': 'fade',
  'mpx-': 'scrub',
  'trg-': 'trigger',
};

/** Parse a DOM id into its motion marker, or null when it isn't one. */
export function parseMotionMarker(id: string): MotionMarker | null {
  for (const prefix of Object.keys(PREFIXES)) {
    if (id.startsWith(prefix)) {
      const name = id.slice(prefix.length);
      return name.length ? { kind: PREFIXES[prefix]!, name } : null;
    }
  }
  return null;
}

/** The selector that finds every marked element under a scope. */
export const MOTION_MARKER_SELECTOR = '[id^="mfx-"], [id^="mpx-"], [id^="trg-"]';

/**
 * DOM ids of the hero headline and support line, the page's LCP candidates.
 * Deliberately not markers: no timeline can target them, so they paint in
 * their final place from the server HTML and never wait on JS (PS-035).
 */
export const HERO_LCP_TEXT_IDS = { title: 'w01-hero-title', body: 'w01-hero-body' } as const;
