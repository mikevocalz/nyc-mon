// Which routes put the kit BackButton at the left of the shell header, and
// where it goes. Pure: no react-native import, so node --test covers it.
// SOT-KEYWORDS: header back button fallback route shell
import { companionCopy } from '../companion/copy.ts';
import { monsCopy } from '../mons/copy.ts';
import { systemCopy } from '../system/copy.ts';
import { shellChromeVisible } from './shell-destinations.ts';

export interface HeaderBack {
  /** Where Back goes when the stack has nothing to pop; null means Back hides then. */
  readonly fallback: string | null;
  /** The screen's spoken name for Back; undefined keeps the kit's "Back". */
  readonly label: string | undefined;
}

export type BackAction = { readonly kind: 'pop' } | { readonly kind: 'replace'; readonly href: string };

/** The primary tabs' own routes: a tab is a top-level place, so it has no Back. */
const PRIMARY_TAB_ROOTS = new Set(['', '/', '/home', '/game', '/mons', '/profile']);

/** The screens that had their own Back before it moved to the header, with that Back's fallback and copy. */
const SCREENS: readonly { readonly match: RegExp; readonly fallback: string | null; readonly label: () => string }[] = [
  { match: /^\/sync\/?$/, fallback: '/(home)', label: () => systemCopy('m21.back') },
  { match: /^\/mons\/[^/]+\/?$/, fallback: '/(home)/mons', label: () => monsCopy('mons.entry.back') },
  { match: /^\/settings\/?$/, fallback: '/(home)', label: () => companionCopy('m17.back.a11y') },
  { match: /^\/journal\/?$/, fallback: null, label: () => companionCopy('m17.back.a11y') },
  { match: /^\/mon\/[^/]+\/?$/, fallback: null, label: () => companionCopy('m17.back.a11y') },
];

/**
 * The header Back for a path, or null on a primary tab and on full-window
 * routes (onboarding, auth, legal, the hatch), which draw their own Back.
 */
export function headerBack(pathname: string): HeaderBack | null {
  if (PRIMARY_TAB_ROOTS.has(pathname) || !shellChromeVisible(pathname)) return null;
  const screen = SCREENS.find((s) => s.match.test(pathname));
  return screen === undefined ? { fallback: null, label: undefined } : { fallback: screen.fallback, label: screen.label() };
}

/** Pop when the stack can; otherwise the screen's fallback; with neither, there is nowhere to go and Back hides. */
export function backAction(back: HeaderBack, canGoBack: boolean): BackAction | null {
  if (canGoBack) return { kind: 'pop' };
  return back.fallback === null ? null : { kind: 'replace', href: back.fallback };
}
