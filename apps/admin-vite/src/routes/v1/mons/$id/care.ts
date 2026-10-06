import { handleApplyCare } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `PUT /v1/mons/:id/care` applies queued care actions for the signed-in
 * caller — the ADR 0001 §1.4 contract (`{ seq, delta, clientTime }`; the
 * server is the tie-breaker on `seq`). `POST` is kept as an alias for older
 * clients. The mon instance id is taken from the URL.
 */
export const Route = createFileRoute('/v1/mons/$id/care')({
  server: {
    handlers: {
      PUT: ({ request, params }: { request: Request; params: { id: string } }) =>
        handleApplyCare(request, params.id),
      POST: ({ request, params }: { request: Request; params: { id: string } }) =>
        handleApplyCare(request, params.id),
    },
  },
});
