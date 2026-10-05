'use client';

import { Suspense } from 'react';
import { SignInScreen } from '@acme/app/features/onboarding/SignInScreen.tsx';
import { BrandWordmark, SkylineDivider, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * M03 sign-in / create account (intent via `?intent=`). On wide screens the
 * auth card sits beside a brand panel — wordmark, tagline, and the
 * skyline strip — so the page carries the site language instead of a bare
 * form on white. Below `lg` it is the plain screen, matching the app.
 */
export default function SignInPage() {
  return (
    <View className="grid min-h-[100dvh] auto-rows-fr flex-1 bg-bg lg:grid-cols-2">
      <View
        aria-hidden
        className="hidden flex-col justify-between overflow-hidden bg-ink-950 px-10 pb-0 pt-10 lg:flex"
      >
        <BrandWordmark height={32} />
        <View className="gap-3">
          <View className="h-1 w-10 bg-orange-500" aria-hidden />
          <Text className="font-display text-2xl font-bold text-ink-50">
            Every block has a legend.
          </Text>
          <Text className="text-ink-300">
            Sign in and your Mon comes with you — the same egg, the same block.
          </Text>
          <SkylineDivider district="midtown" size="md" seed={5} className="-mx-10 mt-2 w-[calc(100%+5rem)]" />
        </View>
      </View>
      <View className="flex-1">
        <Suspense>
          <SignInScreen />
        </Suspense>
      </View>
    </View>
  );
}
