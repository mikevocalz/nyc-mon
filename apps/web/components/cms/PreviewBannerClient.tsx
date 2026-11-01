'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Aside, Link, Text } from '@acme/ui/html';
/** Poll only this editor's short-lived preview; published visitors do no polling. */
export function PreviewBannerClient() {
  const router = useRouter(); const stamp = useRef<string | null>(null);
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>; const abort = new AbortController();
    const check = async () => {
      try {
        if (document.visibilityState !== 'hidden') {
          const response = await fetch('/api/site-content/preview/state', {cache: 'no-store', signal: abort.signal});
          if (response.status === 401 || response.status === 403) { window.location.assign(new URL('/api/site-content/preview/exit', window.location.origin).href); return; }
          if (response.ok) { const data: unknown = await response.json(); if (data && typeof data === 'object' && 'stamp' in data && typeof data.stamp === 'string') {
            if (stamp.current !== null && stamp.current !== data.stamp) router.refresh(); stamp.current = data.stamp;
          } }
        }
      } catch { /* A temporary network failure must not publish or discard a draft. */ }
      if (!stopped) timer = setTimeout(() => void check(), 3000);
    };
    void check(); return () => { stopped = true; abort.abort(); clearTimeout(timer); };
  }, [router]);
  return <Aside aria-label="Draft preview" className="sticky top-0 z-50 flex-row flex-wrap justify-between gap-3 bg-orange-500 px-4 py-3 text-ink-950">
    <Text>Draft preview — not published. Saved changes refresh here.</Text>
    <Link href="/api/site-content/preview/exit" className="font-bold underline">Exit preview</Link>
  </Aside>;
}
