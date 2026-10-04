'use client';

import { createAuth, type Auth } from '@acme/auth';

/**
 * The auth surface for the app: `EXPO_PUBLIC_AUTH_URL` names the admin-vite
 * origin that hosts Better Auth at `/payload-api/auth` (ADR 0003). Local dev
 * default is the admin-vite dev server.
 */
export const AUTH_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:5174';

let cached: Auth | undefined;

/** The shared auth client; built once. */
export function auth(): Auth {
  cached ??= createAuth({ baseURL: AUTH_BASE_URL });
  return cached;
}

/**
 * Passkey support: on web the WebAuthn API is present; on native the
 * `@better-auth/expo` credential manager is not installed yet, so the
 * passkey button stays hidden (M03 B5/B7).
 */
export function isPasskeySupported(): boolean {
  return typeof globalThis.PublicKeyCredential !== 'undefined';
}
