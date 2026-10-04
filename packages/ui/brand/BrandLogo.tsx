'use client';
import { Image } from 'react-native';
import { logoSource } from './logoSource';

export interface BrandLogoProps {
  /** Rendered width and height in px; the badge is square. */
  size: number;
}

/**
 * The NYC-MON badge, shown as supplied. Never tint, crop or filter it: if it
 * clashes with a surface, change the surface.
 */
export function BrandLogo({ size }: BrandLogoProps) {
  return (
    <Image
      source={logoSource}
      accessibilityRole="image"
      accessibilityLabel="NYC-MON"
      aria-label="NYC-MON"
      resizeMode="contain"
      // Computed geometry: the size is a numeric prop, not a fixed class.
      style={{ width: size, height: size }}
    />
  );
}
