/**
 * `/admin/*`: collection lists, documents, account, and the plugin's login,
 * reset-password and two-factor views. One splat route, because Payload
 * resolves the view from the path and ships it as a Flight payload.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/adminRoutes.d.ts (payloadAdminSplatRoute)
 */
import { payloadAdminSplatRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

import { loadAdminPageRSC } from './server.functions';

export const Route = createFileRoute('/_payload/admin/$')(
  payloadAdminSplatRoute({ load: loadAdminPageRSC }),
);
