'use client';
import { Image } from 'react-native';
import { wordmarkSource } from './wordmarkSource';

/** The master is 2172×724, so the lettering is exactly three times as wide as tall. */
const ASPECT = 3;

export interface BrandWordmarkProps {
  /**
   * Hide the mark from assistive tech. Use it inside a link or control that
   * already carries the name, so "NYC-MON" isn't announced twice.
   */
  decorative?: boolean;
  /** Rendered height in px; width follows the 3:1 artwork. */
  height: number;
}

/**
 * The NYC-MON lettering for app headers. Shown as supplied: never tint, crop
 * or filter it. The badge (BrandLogo) stays for the hero, splash and footer.
 */
export function BrandWordmark({ height, decorative = false }: BrandWordmarkProps) {
  return (
    <Image
      source={wordmarkSource}
      {...(decorative
        ? { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessibilityRole: 'image' as const, accessibilityLabel: 'NYC-MON', 'aria-label': 'NYC-MON' })}
      resizeMode="contain"
      // Computed geometry: the size is a numeric prop, not a fixed class.
      style={{ width: height * ASPECT, height }}
    />
  );
}
