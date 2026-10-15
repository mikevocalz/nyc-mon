import './rn-globals.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Paragraph } from '@acme/ui/html';
import { App, type PublicConfig } from './App.tsx';
import './globals.css';

async function boot(): Promise<void> {
  const root = createRoot(document.getElementById('root')!);
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const config = (await res.json()) as PublicConfig;
    root.render(
      <StrictMode>
        <App config={config} />
      </StrictMode>,
    );
  } catch {
    root.render(
      <Paragraph role="alert" className="mx-auto my-12 max-w-2xl px-4 text-base text-text">
        The simulator server isn’t answering. Start it with pnpm --filter @acme/web-sim dev, then reload.
      </Paragraph>,
    );
  }
}

void boot();
