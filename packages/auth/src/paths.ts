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

/**
 * Header naming the surface a sign-in belongs to. The game's sign-in calls
 * send {@link APP_SURFACE} so the server's APP_ALLOWED_EMAILS gate
 * (packages/payload/src/auth/app-allowlist.ts) can tell them from the OAuth
 * linking flow the judges use — same endpoint, no header. Must match
 * `SURFACE_HEADER` in `packages/payload/src/auth/surface.ts`.
 */
export const SURFACE_HEADER = 'x-nycmon-surface';

/**
 * Marker for the game app's sign-in surface. Deliberately not a real session
 * surface label, so it can only ever deny, never claim privilege. Must match
 * `APP_SURFACE` in `packages/payload/src/auth/app-allowlist.ts`.
 */
export const APP_SURFACE = 'app';
