'use client';

import { brand } from '@acme/theme';
import { useSizeClass } from '../use-size-class';
import { citySkylineLayers } from './city-skyline-model';
import type { CitySkylineProps, GlyphCityVariant } from './CitySkyline.types';
import { THEMES } from './district-theme';
import { QuadBackground } from './QuadBackground';
import { normaliseOpacity, useLayers } from './QuadBackground.shared';
import type { SkylineDistrict } from './skyline-model';

const VARIANT_DISTRICT: Record<GlyphCityVariant, SkylineDistrict> = {
  downtown: 'downtown',
  megacity: 'megacity',
  district: 'midtown',
  ruins: 'harlem',
};

/** The NYC-MON hero skyline. See CitySkylineProps. */
export function CitySkyline({
  district,
  variant,
  seed = 1,
  depth,
  colorPrimary,
  colorSecondary = brand.carolina,
  colorTertiary,
  bgColor,
  backgroundColor,
  speed = 1,
  showVehicles = true,
  blinkingLights = true,
  windowLights = true,
  opacity = 1,
  ...rest
}: CitySkylineProps) {
  const sizeClass = useSizeClass();
  const resolved = district ?? (variant ? VARIANT_DISTRICT[variant] : 'all');
  const theme = THEMES[resolved === 'all' ? 'midtown' : resolved];
  const sky = bgColor ?? backgroundColor ?? null;
  const layers = useLayers(citySkylineLayers, {
    district: resolved,
    seed,
    depth: depth ?? (sizeClass === 'regular' ? 3 : 2),
    light: colorPrimary ?? theme.light,
    vehicleColor: colorSecondary,
    beaconColor: colorTertiary ?? theme.beacon,
    skyColor: sky,
    windowLights,
    showVehicles,
    blinkingLights,
    speed,
  });
  return <QuadBackground {...rest} layers={layers} background={sky ?? theme.sky[0]!} opacity={normaliseOpacity(opacity)} />;
}

/** NeonBlade's name for the same component. */
export const GlyphCity = CitySkyline;
