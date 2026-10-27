'use client';

import { Suspense } from 'react';
import { SignInScreen } from '@acme/app/features/onboarding/SignInScreen.tsx';
import { BrandWordmark } from '@acme/ui';
import { SignInBrandPanel } from '@acme/app/features/onboarding/SignInBrandPanel.tsx';
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
      <SignInBrandPanel className="hidden lg:flex" />
      <View className="flex-1">
        <View className="px-4 pt-4 lg:hidden">
          <BrandWordmark height={40} />
        </View>
        <Suspense>
          <SignInScreen />
        </Suspense>
      </View>
    </View>
  );
}
