'use client';

import dynamic from 'next/dynamic';

/** GSAP, Lenis and Kinetrell load after hydration, as on the home page (HomeMotion.tsx). */
export const StoryMotion = dynamic(() => import('./StoryMotionRoot'), { ssr: false });
