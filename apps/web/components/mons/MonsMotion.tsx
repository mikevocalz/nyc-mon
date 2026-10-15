'use client';

import dynamic from 'next/dynamic';

/**
 * GSAP, Lenis and Kinetrell load after hydration and only on the /mons
 * routes, as on the home page (../home/HomeMotion.tsx). Nothing on the page
 * waits on this chunk: without it every section is at rest and visible.
 */
export const MonsMotion = dynamic(() => import('./MonsMotionRoot'), { ssr: false });
