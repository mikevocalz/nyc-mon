/**
 * The three H-Lynk tiers of canon Decision #16: H-Lynk Core (Entry, matte red
 * plastic), H-Lynk (charcoal) and H-Lynk Pro (white and silver armour).
 * Every chrome component takes one: {@linkcode HLynkShell}, `ScannerLed`,
 * `Trackpad`, `HLynkKey`, `HLynkScreen`.
 *
 * Phase 1 implements `core` only. `standard` and `pro` are part of the type so
 * screens can be written against the final API; until their token sets are
 * measured they render a labelled placeholder (the shell) or the Core look
 * (the parts), with a development warning.
 * @see resolveTier
 */
export type HLynkTier = 'core' | 'standard' | 'pro';

/** The tiers this build can draw. */
export type ImplementedTier = 'core';

const warned = new Set<string>();

/**
 * The tier a component draws. Returns `core` for every input today and warns
 * once per component and tier in development when a tier without measured
 * tokens is requested.
 */
export function resolveTier(tier: HLynkTier, component: string): ImplementedTier {
  switch (tier) {
    case 'core':
      return 'core';
    case 'standard':
    case 'pro': {
      const key = `${component}:${tier}`;
      if (isDev() && !warned.has(key)) {
        warned.add(key);
        console.warn(
          `${component}: tier "${tier}" has no measured tokens yet and draws the Core look. ` +
            'See docs/design/hlynk/DIRECTION.md "Tier".',
        );
      }
      return 'core';
    }
    default:
      return assertNever(tier);
  }
}

/** Is `tier` one this build draws? */
export function isImplementedTier(tier: HLynkTier): tier is ImplementedTier {
  return tier === 'core';
}

function isDev(): boolean {
  const g = globalThis as { __DEV__?: boolean; process?: { env?: { NODE_ENV?: string } } };
  if (typeof g.__DEV__ === 'boolean') return g.__DEV__;
  return g.process?.env?.NODE_ENV !== 'production';
}

/** Exhaustiveness guard for discriminated unions. */
export function assertNever(value: never): never {
  throw new Error(`unhandled H-Lynk variant: ${String(value)}`);
}
