import { handleAuthServerMetadata } from '@acme/payload/auth/oauth';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `GET /.well-known/oauth-authorization-server` — RFC 8414 metadata for the
 * Alexa+ authorization server (ADR 0016). The issuer is this origin, so the
 * document belongs at the root; Better Auth's own copy sits under
 * `/payload-api/auth`, where Amazon would not look.
 */
export const Route = createFileRoute('/.well-known/oauth-authorization-server')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthServerMetadata(request),
    },
  },
});
