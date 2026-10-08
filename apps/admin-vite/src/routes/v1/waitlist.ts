import { handleJoinWaitlist } from '@acme/payload/admin/console/waitlist';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/waitlist` is called by the `apps/web` server action behind the
 * marketing site's sign-up form (PS-001). Anonymous: there is no account. The
 * handler answers with a `status` the form maps to copy; an under-13 answer
 * stores nothing (ADR 0001).
 */
export const Route = createFileRoute('/v1/waitlist')({
  server: {
    handlers: {
      POST: ({ request }) => handleJoinWaitlist(request),
    },
  },
});
