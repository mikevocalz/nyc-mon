/**
 * CORS for the `/v1` routes the web app calls with its session cookie
 * (`/v1/mon-voice`, `/v1/mon-lingo`). Native sends no CORS. Origins outside
 * the allow-list get no CORS headers, so the browser blocks the read.
 */

/** Copies `response` with CORS headers for `origin` when it is allowed. */
export function withCors(response: Response, origin: string | null, allowed: readonly string[], exposeHeaders: readonly string[]): Response {
  if (origin === null || !allowed.includes(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-expose-headers', exposeHeaders.join(', '));
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** The answer to a preflight: 204 for an allowed origin, 403 otherwise. */
export function preflight(origin: string | null, allowed: readonly string[], methods: string, allowHeaders = 'content-type, authorization'): Response {
  if (origin === null || !allowed.includes(origin)) return new Response(null, { status: 403, headers: { vary: 'Origin' } });
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': methods,
      'access-control-allow-headers': allowHeaders,
      'access-control-max-age': '600',
      vary: 'Origin',
    },
  });
}
