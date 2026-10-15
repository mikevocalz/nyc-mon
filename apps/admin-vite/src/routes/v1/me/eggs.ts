import { handleListMyEggs } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `GET /v1/me/eggs` returns the signed-in caller's eggs that have not hatched
 * yet, soonest first. The MCP server's `check_incubation` tool reads it
 * (ADR 0015 §4).
 */
export const Route = createFileRoute('/v1/me/eggs')({
  server: {
    handlers: {
      GET: ({ request }) => handleListMyEggs(request),
    },
  },
});
