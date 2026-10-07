'use client';
import { useEffect } from 'react';

/** Dev-only LCP / CLS / INP logger with attribution (web-vitals/attribution).
 *  Renders nothing; in production builds the effect returns before the
 *  dynamic import, so the web-vitals chunk is never fetched. */
export function WebVitals() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let cancelled = false;
    void import('web-vitals/attribution').then(({ onCLS, onINP, onLCP }) => {
      if (cancelled) return;
      const opts = { reportAllChanges: true };
      onLCP(({ value, rating, attribution: a }) => {
        console.info('[vitals] LCP', Math.round(value), rating, {
          target: a.target,
          url: a.url,
          timeToFirstByte: Math.round(a.timeToFirstByte),
          resourceLoadDelay: Math.round(a.resourceLoadDelay),
          resourceLoadDuration: Math.round(a.resourceLoadDuration),
          elementRenderDelay: Math.round(a.elementRenderDelay),
        });
      }, opts);
      onCLS(({ value, rating, attribution: a }) => {
        console.info('[vitals] CLS', value.toFixed(4), rating, {
          largestShiftTarget: a.largestShiftTarget,
          largestShiftValue: a.largestShiftValue,
        });
      }, opts);
      onINP(({ value, rating, attribution: a }) => {
        console.info('[vitals] INP', Math.round(value), rating, {
          interactionTarget: a.interactionTarget,
          interactionType: a.interactionType,
          inputDelay: Math.round(a.inputDelay),
          processingDuration: Math.round(a.processingDuration),
          presentationDelay: Math.round(a.presentationDelay),
        });
      }, opts);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
