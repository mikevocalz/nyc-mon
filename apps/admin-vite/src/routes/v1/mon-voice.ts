import { handleMonVoice } from '@acme/payload/admin/console/v1-mon-voice';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/mon-voice` speaks one line in the signed-in Caller's Mon's own
 * voice (mp3, or 204 with `x-mon-voice-reason`). `OPTIONS` answers the web
 * app's CORS preflight. See packages/payload/src/admin/console/v1/mon-voice.ts.
 */
export const Route = createFileRoute('/v1/mon-voice')({
  server: {
    handlers: {
      POST: ({ request }) => handleMonVoice(request),
      OPTIONS: ({ request }) => handleMonVoice(request),
    },
  },
});
