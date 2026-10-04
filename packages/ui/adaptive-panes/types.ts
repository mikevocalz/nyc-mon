import type { ReactNode, Ref } from 'react';

/**
 * Public types for {@linkcode AdaptivePanes} (also exported as `SplitView`).
 *
 * Written out here rather than derived from expo-router's `SplitHostProps`:
 * `@acme/ui` does not depend on expo-router, and apps/web does not install it.
 * The shapes below are the subset the adaptive implementation honours. On iOS
 * apps/mobile renders expo-router's native `SplitView` instead, whose props are
 * a superset of these names, so one call site compiles against both.
 *
 * SOT-KEYWORDS: adaptive panes types column commands props split view
 */

/** The navigable columns, leading to trailing. `secondary` is the detail. */
export type SplitNavigableColumn = 'primary' | 'supplementary' | 'secondary';

/**
 * Imperative surface exposed on the host's `ref`.
 *
 * @see {@linkcode AdaptivePanesProps.ref}
 */
export interface AdaptivePanesCommands {
  /**
   * Bring a column on top. Collapsed: swaps the visible pane. Expanded:
   * visual no-op (everything the size class allows is already tiled), but the
   * column is recorded so a later collapse lands there.
   */
  show: (column: SplitNavigableColumn) => void;
}

/** Props for {@linkcode AdaptivePanes}. */
export interface AdaptivePanesProps {
  /** `AdaptivePanes.Column` (up to two) and `AdaptivePanes.Inspector` children. */
  children?: ReactNode;
  /** Which pane is visible once collapsed. Defaults to the leading column. */
  topColumnForCollapsing?: SplitNavigableColumn;
  /**
   * Slide the inspector drawer open where the size class allows one. It
   * overlays the detail pane from the logical trailing edge and takes no
   * layout width. On a foldable it is capped to the trailing display region.
   */
  showInspector?: boolean;
  /**
   * Detail pane content. apps/mobile passes expo-router's `<Slot />` here so
   * the route under the layout fills the trailing pane; stories and web pass
   * content directly. Omitted, the detail pane is empty.
   */
  detail?: ReactNode;
  /**
   * Host-owned visibility for the detail pane, overriding the resolved policy.
   *
   * Normally the detail pane's visibility is the size class plus whatever
   * `PaneToggle` wrote into the pane overrides — a layout preference stored
   * per size class. Supply this when the detail pane's visibility is itself
   * app state the host already owns; it then wins outright. The detail pane
   * still refuses to hide while it is the only pane on screen.
   *
   * @default undefined (use the resolved policy)
   */
  detailOpen?: boolean;
  /**
   * Explicit width for the primary pane, in dp, replacing the `w-pane-primary`
   * token and opting out of the narrow rail step at `medium`/`expanded`.
   *
   * The rail step suits a list (an icon sidebar is still navigable); a pane
   * whose content has no narrow form states its width here instead. The
   * divider's resize and `PRIMARY_WIDTH_MIN`/`MAX` still govern.
   */
  primaryWidthDp?: number;
  /** The supplementary (middle) pane's width in dp, overriding the token. */
  supplementaryWidthDp?: number;
  /**
   * Whether the host draws its own row of `PaneToggle`s above the detail pane.
   * Set false when the screen mounts the same toggles in its own header.
   *
   * @default true
   */
  paneControls?: boolean;
  /**
   * Whether the detail pane's own navigator can pop, read at each Android
   * hardware Back press while collapsed. When it returns true the press is
   * handed down to that navigator instead of stepping to the previous column.
   * apps/mobile passes `router.canGoBack`.
   *
   * @default () => false
   */
  canGoBack?: () => boolean;
  ref?: Ref<AdaptivePanesCommands>;
}
