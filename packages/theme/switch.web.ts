// User theme override — web. The cookie is read server-side in the Next root
// layout and rendered as <html data-theme=...>, so there is zero flash.
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'app-theme';

export function setThemePreference(pref: ThemePreference) {
  const root = document.documentElement;
  // No attribute = the brand default (dark). 'system' is an explicit opt-in to
  // following the OS, so it is stored like the other two choices.
  root.setAttribute('data-theme', pref);
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
}
