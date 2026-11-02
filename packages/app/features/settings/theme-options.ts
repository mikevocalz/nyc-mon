// The theme choices, in the order the 2D Appearance card shows them and the
// Settings glass cycles them. Pure, with a type-only import, so node tests
// pin it.
import type { ThemePreference } from '../profile/profile.store';
import { copy } from '../onboarding/copy.ts';

export const THEME_OPTIONS: readonly { readonly value: ThemePreference; readonly label: string }[] = [
  { value: 'system', label: copy('settings.theme.system') },
  { value: 'light', label: copy('settings.theme.light') },
  { value: 'dark', label: copy('settings.theme.dark') },
];

export function themeLabel(theme: ThemePreference): string {
  return THEME_OPTIONS.find((o) => o.value === theme)?.label ?? theme;
}

/** The next choice after `current`, wrapping round. */
export function nextOf<T>(options: readonly { readonly value: T }[], current: T): T {
  const at = options.findIndex((o) => o.value === current);
  return options[(at + 1) % options.length]!.value;
}
