'use client';

import { useEffect } from 'react';
import { startPhotoMotion } from './motion-session';

/** The server composition is complete before this optional motion island loads. */
export function CityMotion() {
  useEffect(() => {
    const root = document.getElementById('w03-city');
    const sentinel = root?.querySelector('#w03-atlas-start');
    const downtown = root?.querySelector('#w03-photo-downtown');
    const midtown = root?.querySelector('#w03-photo-midtown');
    const harlem = root?.querySelector('#w03-photo-harlem');
    // Validate every required target before importing or constructing a timeline.
    if (!sentinel || !downtown || !midtown || !harlem || typeof IntersectionObserver === 'undefined') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const session = startPhotoMotion({
      preference,
      observe: (onVisible) => {
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onVisible();
        }, { threshold: 0 });
        observer.observe(sentinel);
        return () => observer.disconnect();
      },
      load: async () => {
        const { createCityTimeline } = await import('./motion-runtime');
        return () => createCityTimeline({ downtown, midtown, harlem });
      },
      onError: (error) => console.error('[CityMotion] optional atlas motion failed.', error),
    });
    return () => session.dispose();
  }, []);
  return null;
}
