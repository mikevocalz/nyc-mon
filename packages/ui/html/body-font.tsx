'use client';
/**
 * The kit's body face on text-backed primitives.
 *
 * On web, react-native-web gives every root Text an unlayered
 * `font: 14px System` (react-native-web/dist/exports/Text/index.js, textStyle),
 * so the page's `font-family` never reaches a Paragraph or table cell, and a
 * layered rule cannot beat it. Only an `!important` utility on the element
 * itself wins, which the Storybook and console sheets emit (`important`). So
 * each text primitive carries `font-sans` unless the caller names a face of
 * its own. Native resolves fonts per element through Uniwind and is left as
 * it was.
 */
import React from 'react';
import { Platform } from 'react-native';
import type { CN } from './css';

/** A caller class that already picks a font family. */
const HAS_FACE = /(?:^|\s)(?:[\w-]+:)*font-(?:sans|display|mono|serif|\[)/;

/** `font-sans` before the caller's classes, unless they name a face. Web only. */
export function withBodyFace(className: string | undefined): string | undefined {
  if (Platform.OS !== 'web') return className;
  if (className && HAS_FACE.test(className)) return className;
  return className ? `font-sans ${className}` : 'font-sans';
}

/** Wraps a text-backed primitive so it renders in the body face by default. */
export function bodyFace<P extends object>(Component: React.FC<P & CN>, displayName: string) {
  const Wrapped = ({ className, ...props }: P & CN) => (
    <Component {...(props as P)} className={withBodyFace(className)} />
  );
  Wrapped.displayName = displayName;
  return Wrapped as React.FC<P & CN>;
}
