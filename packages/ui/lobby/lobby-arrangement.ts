// How the lobby's two panes share a foldable or wide window (foldable skill
// §9; docs/design/foldable-arrangements.md). Pure, so the pane maths is
// node-tested against the arrangement library's own policy.
// SOT-KEYWORDS: lobby arrangement fold book tabletop resume start pane
import type { PaneArrangement, PhysicalSide } from '../arrangement/arrangement.types';
import type { LayoutProfile } from '../game-controls/contract.ts';

/**
 * Resume + START is the primary pane, on the physical right; identity + NYC
 * Rank is the companion on the left. Overlay in tabletop puts the primary
 * after the fold (below it); split everywhere else puts the panes side by
 * side across a vertical fold or on a regular-width window, and shows the
 * primary alone on a compact one, where the lobby draws today's single
 * column. The primary is the trailing pane, so on both platforms the
 * companion (identity, rank) is read first and START last.
 */
export function lobbyPaneArrangement(profile: LayoutProfile): PaneArrangement {
  return profile === 'fold-tabletop' ? 'overlay' : 'split';
}

export const LOBBY_PRIMARY_SIDE: PhysicalSide = 'right';
