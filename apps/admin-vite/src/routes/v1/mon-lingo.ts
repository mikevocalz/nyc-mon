import { handleMonLingo } from '@acme/payload/admin/console/v1-mon-lingo';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `GET /v1/mon-lingo` serves the Mon's published lines and lingo from Payload
 * (`language-lexicon` + the `mon-voices` global), with an ETag. `OPTIONS`
 * answers the web app's CORS preflight. See
 * packages/payload/src/admin/console/v1/mon-lingo.ts.
 */
export const Route = createFileRoute('/v1/mon-lingo')({
  server: {
    handlers: {
      GET: ({ request }) => handleMonLingo(request),
      OPTIONS: ({ request }) => handleMonLingo(request),
    },
  },
});
