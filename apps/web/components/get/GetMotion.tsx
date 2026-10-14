'use client';

import dynamic from 'next/dynamic';

/**
 * The waitlist page's motion island, loaded after hydration. The form never
 * waits on it: it is server HTML that works before this chunk exists.
 */
export const GetMotion = dynamic(() => import('./GetMotionRoot'), { ssr: false });
