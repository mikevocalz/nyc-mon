import type { ReactNode } from 'react';
import type { ControlTone, District } from './district';

export interface MenuAction {
  id: string;
  title: string;
  /** Rendered in red and, on iOS, flagged to the system as destructive. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** The control the menu is anchored to. */
  children: ReactNode;
  actions: readonly MenuAction[];
  onAction: (id: string) => void;
  /** Heading shown at the top of the menu. */
  title?: string;
  className?: string;
  /** Web: title, hover bar and focus colour by neighbourhood. Default midtown. Native uses the OS menu. */
  district?: District;
  /** Web: accent tone; overrides the district. */
  tone?: ControlTone;
}
