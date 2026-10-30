// A single Better Auth client for console chrome: the passkey sign-in
// ceremony (WebAuthn, which a fetch can't perform) and sign-out. Console data
// calls stay on the typed endpoints in api.ts. Built lazily inside event
// handlers so nothing touches `window` during SSR.
'use client';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';

function build() {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return createAuthClient({ baseURL: `${origin}/payload-api/auth`, plugins: [passkeyClient()] });
}

let client: ReturnType<typeof build> | undefined;

export function consoleAuth() {
  client ??= build();
  return client;
}
