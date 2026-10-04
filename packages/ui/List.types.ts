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
}
