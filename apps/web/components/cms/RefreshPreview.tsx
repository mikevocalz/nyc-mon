'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
/** The preview displays saved/autosaved drafts. Only trusted parent-window events can request a refresh. */
export function RefreshPreview({ adminOrigin }: { adminOrigin: string }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (event: MessageEvent) => {
      if (event.origin !== adminOrigin || event.source !== window.parent || typeof event.data !== 'object' || !event.data) return;
      if (!['payload-document-event', 'payload-live-preview'].includes(event.data.type)) return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1700);
    };
    window.addEventListener('message', update);
    // A top-level preview has no parent messages. Refresh only while visible; no polling in public pages.
    const interval = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 10000);
    return () => { window.removeEventListener('message', update); clearTimeout(timer); clearInterval(interval); };
  }, [adminOrigin, router]);
  return null;
}
