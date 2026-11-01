import { fontFamilies, semantic } from '@acme/theme';

type Semantic = typeof semantic;

/**
 * Scheme helpers. Page colours come from @acme/theme/theme.css (globals.css);
 * MCP Apps views get the same semantic tokens through hostContext.styles.
 */

export type Scheme = 'light' | 'dark';

export function currentScheme(): Scheme {
  // The kit is daylit by default (theme.css); night only through data-theme.
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark') return 'dark';
  if (forced === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return 'light';
}

/** Host style variables for views (MCP Apps standardized keys), resolved for one scheme. */
export function hostStyleVariables(scheme: Scheme): Record<string, string> {
  const pick = (k: keyof Semantic) => semantic[k][scheme];
  return {
    '--color-background-primary': pick('surface-raised'),
    '--color-background-secondary': pick('surface-sunken'),
    '--color-text-primary': pick('text'),
    '--color-text-secondary': pick('text-muted'),
    '--color-border-primary': pick('border'),
    '--color-ring-primary': pick('focus'),
    '--font-sans': fontFamilies.sans,
  };
}
