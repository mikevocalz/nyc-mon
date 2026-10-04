'use client';
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { tv } from 'tailwind-variants';
import { PressScale } from './press-scale';
import { Text, View } from './tw';

/** A provider rendered by {@linkcode AuthProviderButton}. */
export type AuthProvider = 'apple' | 'google' | 'passkey' | 'email';

/** The account flow whose wording is rendered by {@linkcode AuthProviderButton}. */
export type AuthIntent = 'create' | 'sign-in';

const AUTH_PROVIDER_LABELS = {
  apple: { create: 'Create account with Apple', 'sign-in': 'Sign in with Apple' },
  google: { create: 'Create account with Google', 'sign-in': 'Sign in with Google' },
  passkey: { create: 'Create a passkey', 'sign-in': 'Sign in with a passkey' },
  email: { create: 'Create account with email', 'sign-in': 'Sign in with email' },
} as const satisfies Record<AuthProvider, Record<AuthIntent, string>>;

const providerButton = tv({
  slots: {
    root:
      'group w-full min-h-12 flex-row items-center justify-center border-2 px-5 py-3 ' +
      'transition-transform duration-fast active:translate-x-0.5 active:translate-y-0.5 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
      'motion-reduce:transition-none',
    content: 'min-w-0 flex-row items-center justify-center gap-3',
    icon: 'shrink-0',
    label: 'min-w-0 shrink text-center font-display text-type-label tracking-wide',
  },
  variants: {
    provider: {
      // Semantic text/background tokens invert with the active scheme: black/white by day, white/black at night.
      apple: { root: 'border-text bg-text', label: 'text-bg' },
      google: { root: 'border-concrete-300 bg-surface-raised', label: 'text-text' },
      passkey: { root: 'border-text-muted bg-surface-raised', label: 'text-text' },
      email: { root: 'border-text-muted bg-bg', label: 'text-text' },
    },
    disabled: {
      true: { root: 'cursor-not-allowed opacity-50 active:translate-x-0 active:translate-y-0' },
    },
  },
});

/** Props accepted by {@linkcode AuthProviderButton}. */
export interface AuthProviderButtonProps {
  /** Authentication provider rendered by {@linkcode AuthProviderButton}. */
  provider: AuthProvider;
  /** Account flow that selects the label in {@linkcode AuthProviderButton}. */
  intent: AuthIntent;
  /** Shows a spinner and prevents presses in {@linkcode AuthProviderButton}. */
  loading?: boolean;
  /** Prevents presses and visually dims {@linkcode AuthProviderButton}. */
  disabled?: boolean;
  /** Hides {@linkcode AuthProviderButton} when the provider is unavailable. Defaults to true. */
  supported?: boolean;
  /** Optional brand- or product-supplied mark shown by {@linkcode AuthProviderButton}. */
  icon?: ReactNode;
  /** Called when an enabled {@linkcode AuthProviderButton} is pressed. */
  onPress: () => void;
}

/**
 * Full-width authentication action with provider-specific, scheme-aware faces.
 * It owns presentation only; authentication remains with the caller.
 */
export function AuthProviderButton({
  provider,
  intent,
  loading = false,
  disabled = false,
  supported = true,
  icon,
  onPress,
}: AuthProviderButtonProps) {
  if (!supported) return null;

  const off = disabled || loading;
  const styles = providerButton({ provider, disabled: off });
  const label = AUTH_PROVIDER_LABELS[provider][intent];

  // TODO(assets): add packages/assets/apple-logo.svg and packages/assets/google-g-logo.svg;
  // until those brand-supplied files exist, Apple and Google intentionally remain text-only.
  return (
    <PressScale
      onPress={off ? undefined : onPress}
      aria-label={label}
      aria-disabled={off}
      accessibilityState={{ disabled: off }}
      className={styles.root()}
      outerClassName="w-full"
    >
      <View className={styles.content()}>
        {loading ? <ActivityIndicator size="small" /> : null}
        {!loading && icon ? (
          <View aria-hidden className={styles.icon()}>
            {icon}
          </View>
        ) : null}
        <Text className={styles.label()}>{label}</Text>
      </View>
    </PressScale>
  );
}
