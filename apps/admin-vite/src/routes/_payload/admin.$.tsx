/**
 * `/admin/*`: collection lists, documents, account, and the plugin's login,
 * reset-password and two-factor views. One splat route, because Payload
 * resolves the view from the path and ships it as a Flight payload.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/adminRoutes.d.ts (payloadAdminSplatRoute)
 */
import { payloadAdminSplatRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

import { ConsoleRouteError } from '../../console-route-error';
import { loadAdminPageRSC } from './server.functions';

export const Route = createFileRoute('/_payload/admin/$')(
  {
    ...payloadAdminSplatRoute({ load: loadAdminPageRSC }),
    // A stable error state with a manual retry (src/console-route-error.tsx).
    // Both admin routes share it so index <-> splat keeps one boundary type.
    errorComponent: ConsoleRouteError,
  },
);
