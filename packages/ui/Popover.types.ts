import type { ReactNode } from 'react';

/** Source-owned rich instrument overlay. Use @acme/ui/Menu for action lists. */
export interface PopoverProps {
  /** Controlled visibility; the host owns state (Zustand or document/session state). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presentational trigger content. The UI kit supplies the interactive button. */
  trigger: ReactNode;
  /** Live React Native/React content, never a screenshot of the instrument. */
  children: ReactNode;
  /** Accessible trigger and overlay name, localized by caller. */
  accessibleLabel: string;
  title?: string;
  placement?: 'auto' | 'above' | 'below';
}
