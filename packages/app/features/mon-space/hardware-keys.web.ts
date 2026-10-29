'use client';

import { useEffect } from 'react';

/**
 * Web: the page's keydown events drive Mon Space (arrows, Return or Space,
 * Escape). Keys typed into a text field are left alone, and a handled key
 * does not scroll the page.
 */
export function useHardwareKeys(onKey: (key: string) => boolean): void {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true) return;
      // A focused button already answers Space and Return itself; let it, so one press is one action.
      if ((event.key === ' ' || event.key === 'Enter') && target?.tagName === 'BUTTON') return;
      if (onKey(event.key)) event.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey]);
}
