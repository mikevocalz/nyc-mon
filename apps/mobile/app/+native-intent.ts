// Incoming URLs before expo-router routes them. The only rewrite: Google's
// OAuth redirect (com.nycmon.app:/oauthredirect?code=...) belongs to
// expo-auth-session, which is waiting for it in M03; routing it would land
// on +not-found. Android delivers it to the app; iOS hands it straight to
// the auth session and never gets here.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (path.includes('oauthredirect')) return initial ? '/' : null;
  return path;
}
