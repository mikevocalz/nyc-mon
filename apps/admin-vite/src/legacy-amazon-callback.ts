/** Preserve an existing LWA callback registration after Better Auth 1.7's route migration. */
export function legacyAmazonCallback(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Response | undefined {
  // Local development only, matching the redirectURI override in @acme/payload's amazon.ts.
  if (env.NODE_ENV !== 'development' || env.AMAZON_LWA_LOCAL_LEGACY_CALLBACK !== 'true') return;
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return;
  if (request.method !== 'GET' || url.pathname !== '/payload-api/auth/oauth2/callback/amazon') return;
  url.pathname = '/payload-api/auth/callback/amazon';
  // Keep the OAuth code/state unchanged. Better Auth still validates state and
  // exchanges the code using the originally configured redirect URI and PKCE.
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.href,
      'Cache-Control': 'private, no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
