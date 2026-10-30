/**
 * Where Better Auth is mounted: Payload's `routes.api` plus the plugin's auth
 * base path. Must match `PAYLOAD_API_ROUTE` + `AUTH_BASE_PATH` in
 * `packages/payload/src/auth/options.ts`.
 */
export const AUTH_BASE_PATH = '/payload-api/auth';

/**
 * The origin the native app sends. React Native's fetch sets no Origin header,
 * and Better Auth refuses a cookie-carrying request without one
 * (MISSING_OR_NULL_ORIGIN), so a native player who already holds a session
 * cookie could never sign in. Must match the app scheme in
 * `apps/mobile/app.config.ts` and `NATIVE_APP_ORIGIN` in
 * `packages/payload/src/auth/options.ts`.
 */
export const APP_ORIGIN = 'nycmon://';
