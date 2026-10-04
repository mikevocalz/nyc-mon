import { handleApplyCare } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/mons/:id/care` applies queued care actions for the signed-in caller
 * (ADR 0001 §1.4). The mon instance id is taken from the URL.
 */
export const Route = createFileRoute('/v1/mons/$id/care')({
  server: {
    handlers: {
      POST: ({ request, params }: { request: Request; params: { id: string } }) =>
        handleApplyCare(request, params.id),
    },
  },
});
