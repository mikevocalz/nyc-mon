import type { ReactNode } from 'react';
import type { ControlTone, District } from './district';

export interface CollapsibleProps {
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children?: ReactNode;
  className?: string;
  /** Web: accent bar, chevron and focus colour by neighbourhood. Default midtown. Native uses the OS disclosure. */
  district?: District;
  /** Web: accent tone; overrides the district. */
  tone?: ControlTone;
}
