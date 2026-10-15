'use client';

import dynamic from 'next/dynamic';

/**
 * The How it works page's motion island. GSAP, Lenis and Kinetrell load after
 * hydration, out of the requests that paint the page; nothing visible waits
 * on this chunk (the hero entrance is transform-only and skipped when late).
 */
export const HowItWorksMotion = dynamic(() => import('./HowItWorksMotionRoot'), { ssr: false });
