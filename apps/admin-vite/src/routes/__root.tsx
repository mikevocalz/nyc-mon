/**
 * The document. Under TanStack Start the root route owns `<html>` through
 * `shellComponent`, so there is no index.html.
 *
 * `withPayloadRoot` renders Payload's own `<html>` (server-computed
 * `data-theme`, `lang`, `dir`) for anything under `config.routes.admin`.
 * `FallbackDocument` covers what is not the panel: `/`, which redirects into
 * it, and a 404 for a path the panel does not own.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/layouts/Root/withPayloadRoot.d.ts
 */
import { withPayloadRoot } from '@payloadcms/tanstack-start/client';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const Route = createRootRoute({
  shellComponent: withPayloadRoot(FallbackDocument),
  component: Outlet,
});

function FallbackDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
