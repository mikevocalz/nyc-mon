'use client';
import { IconButton } from './IconButton';
import { ChevronLeft } from './icons';

export interface BackButtonProps {
  onPress: () => void;
  /** Spoken name. Default "Back". */
  label?: string;
}

/**
 * The app's back button: the kit's corner-cut tile in royal, the structure
 * colour (orange is kept for the one action on a screen). 48pt on phones,
 * 64pt from md. Screens draw it themselves rather than in the native stack
 * header, which wraps header items in the OS's own glass.
 */
export function BackButton({ onPress, label = 'Back' }: BackButtonProps) {
  return (
    <IconButton
      aria-label={label}
      icon={<ChevronLeft />}
      variant="cornerCut"
      tone="royal"
      corner="bottom-right"
      size="adaptive-lg"
      onPress={onPress}
    />
  );
}
