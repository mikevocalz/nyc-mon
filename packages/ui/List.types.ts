import type { ReactNode } from 'react';
import type { ControlTone, District } from './district';

export interface ListProps {
  children?: ReactNode;
  /** Pull-to-refresh. Native only; the web fork ignores it. */
  onRefresh?: () => Promise<void>;
  className?: string;
  /** Web: row accent colour by neighbourhood. Default midtown. Native uses the platform list. */
  district?: District;
  /** Web: row accent tone; overrides the district. */
  tone?: ControlTone;
}

export interface ListItemProps {
  children?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  supportingText?: string;
  className?: string;
  /** Marks the current row: tone accent bar and tint. Web only. */
  selected?: boolean;
  /**
   * The page this row points at is the one on screen (04-components.md G14):
   * `aria-current="page"` plus the selected look. Nav items are Links —
   * pair with `href`, not `onPress`.
   */
  current?: boolean;
  /** A real link destination (web); nav items use this instead of onPress. */
  href?: string;
}
