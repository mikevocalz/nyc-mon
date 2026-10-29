// The lobby's single-tree layout classes (G02; the onboarding pattern in
// packages/app/features/onboarding/OnboardingPanes.tsx). Pure strings, so the
// phone contract and the variant rules are node-tested.
//
// One tree for every window: rotating a tablet only swaps classes, so the
// board's and START's Rive surfaces never remount (foldable skill §6).
//
// - Phone (below md, and every non-tablet profile): exactly the old column,
//   wordmark, board, resume, START at the foot. No `md:` class at all, so a
//   phone in landscape (wider than md) keeps its own two-column branch.
// - Tablet portrait (md+): top-aligned, the column widened to 640, START
//   straight after its resume line instead of at the foot.
// - Tablet landscape (md+): two panes across the content area (left of the
//   rail, under the header), capped at content-wide (1008 pt): wordmark +
//   NYC Rank on the left, the board running the pane's full height; resume +
//   START docked at the foot of the right pane (40%, at most 480 pt), START's
//   bottom edge level with the board's.
//
// md is a WINDOW breakpoint (672 pt at the native rem of 14), and the
// lobby's host is smaller: the rail (80 pt) and the header come off it. The
// smallest md windows on rail hardware still leave room: iPad mini portrait
// 744 - 80 = 664 pt host for the 640 column (584 inside its 28 pt gutters),
// and the smallest landscape tablet window (960 x 600 Android) leaves 880 pt:
// a 452 pt board beside a 330 pt resume pane. Phones never get these classes.
//
// Each property carries at most a base value, a breakpoint value and ONE
// orientation value, so no two compound variants compete for one style.
// SOT-KEYWORDS: lobby layout tablet portrait landscape panes start anchored

/**
 * Resolved through Uniwind to learn whether the landscape panes are drawn
 * (`display: 'flex'`), the HLynkStage pattern. Only the board's `fill`, a JS
 * prop, needs it; everything else is a class.
 */
export const LOBBY_SPLIT_PROBE = 'hidden md:landscape:flex';

/** The wordmark's height, resolved to a number for `BrandWordmark` (44 pt on phones, 60 from md). */
export const LOBBY_WORDMARK_HEIGHT = 'h-[44px] md:h-[60px]';

/** Phone wordmark height, used when the layout is not the roomy one. */
export const LOBBY_WORDMARK_PHONE_PT = 44;

/** Tablet heading, one rung above the kit's `title` step at md (OnboardingPanes' PANE_HEADING_CLASS). */
export const LOBBY_HEADING_LARGE = 'md:text-display-md';
/** Resume district line, one rung above `body` at md. */
export const LOBBY_BODY_LARGE = 'md:text-xl';
/** New-game line, one rung above `caption` at md. */
export const LOBBY_CAPTION_LARGE = 'md:text-lg';

export interface LobbyLayoutClasses {
  /** The whole lobby: a column, a row of two panes in md landscape. */
  readonly column: string;
  /** Wordmark + board. */
  readonly identity: string;
  /** Wraps the board so it can take the identity pane's height. */
  readonly board: string;
  /** Resume block + strip + START. */
  readonly resume: string;
  /** Wraps START. */
  readonly start: string;
}

/**
 * Classes for the default (one-pane) lobby branch. `roomy` is the tablet and
 * web profile: the only ones whose window reaches md in portrait, and the
 * only ones that split by class. Everything else gets the phone strings.
 */
export function lobbyLayoutClasses(roomy: boolean): LobbyLayoutClasses {
  if (!roomy) {
    return {
      column: 'flex-1 gap-6 px-4 pb-4 pt-6',
      identity: 'gap-6',
      board: '',
      resume: 'flex-1 gap-6',
      start: 'mt-auto',
    };
  }
  return {
    column:
      'w-full flex-1 gap-6 self-center px-4 pb-4 pt-6 max-w-content-screen md:max-w-[640px] md:gap-8 md:px-8 md:pt-8 md:pb-8 md:landscape:max-w-content-wide md:landscape:flex-row md:landscape:gap-12',
    identity: 'gap-6 md:landscape:flex-1',
    board: 'md:landscape:flex-1',
    // Portrait: resume then START, top-aligned. Landscape: a fixed share, docked at the foot.
    resume: 'flex-1 gap-6 md:landscape:max-w-[420px] md:landscape:justify-end',
    start: 'mt-auto md:mt-0',
  };
}

/** The resume pane of the native paired arrangement (Android, iOS 27.1+): docked at the foot, level with the board. */
export const LOBBY_PAIRED_RESUME = 'flex-1 justify-end gap-6 px-4 pb-4 pt-6 md:px-8 md:pb-8';
/** The identity pane of the native paired arrangement. */
export const LOBBY_PAIRED_IDENTITY = 'flex-1 gap-6 px-4 pb-4 pt-6 md:px-8 md:pb-8 md:pt-8';
