'use client';
import { Image } from 'react-native';
import { logoSource } from './logoSource';

export interface BrandLogoProps {
  /**
   * Hide the mark from assistive tech. Use it inside a link or control that
   * already carries the name, so "NYC-MON" isn't announced twice.
   */
  decorative?: boolean;
  /** Rendered width and height in px; the badge is square. */
  size: number;
}

/**
 * The NYC-MON badge, shown as supplied. Never tint, crop or filter it: if it
 * clashes with a surface, change the surface.
 */
export function BrandLogo({ size, decorative = false }: BrandLogoProps) {
  return (
    <Image
      source={logoSource}
      {...(decorative
        ? { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessibilityRole: 'image' as const, accessibilityLabel: 'NYC-MON', 'aria-label': 'NYC-MON' })}
      resizeMode="contain"
      // Computed geometry: the size is a numeric prop, not a fixed class.
      style={{ width: size, height: size }}
    />
  );
}
