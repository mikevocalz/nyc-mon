'use client';

import type { GlyphCityProps } from './GlyphCity.types';
import { View } from '../tw';
import { SkiaWebGate } from './SkiaWebGate';

const loadGlyphCity = () => import('./GlyphCity.skia');

export function GlyphCity(props: GlyphCityProps) {
  return (
    <SkiaWebGate
      load={loadGlyphCity}
      props={props}
      fallback={
        <View
          className={`flex-1 ${props.className ?? ''}`}
          // Caller colour prop (backgroundColor), not a theme token, so it can't be a class.
          style={{ backgroundColor: props.backgroundColor ?? 'transparent' }}
        >
          {props.children}
        </View>
      }
    />
  );
}
