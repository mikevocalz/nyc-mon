'use client';

import { BrandLogo, SkylineDivider, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * M03's brand panel: wordmark, tagline and the skyline strip, drawn beside the
 * auth form on wide windows so the page carries the site language instead of
 * a bare form. Shared by the web page and the app route; each page decides
 * where it shows (`hidden lg:flex`), below lg it is the plain screen.
 */
export function SignInBrandPanel({ className = '' }: { className?: string }) {
  return (
    <View aria-hidden className={`flex-col justify-between overflow-hidden bg-ink-950 px-10 pb-0 pt-10 ${className}`}>
      <BrandLogo size={168} />
      <View className="gap-3">
        <View className="h-1 w-10 bg-orange-500" aria-hidden />
        <Text className="font-display text-2xl font-bold text-ink-50">Every block has a legend.</Text>
        <Text className="text-ink-300">Sign in and your Mon comes with you — the same egg, the same block.</Text>
        <SkylineDivider district="midtown" size="md" seed={5} className="-mx-10 mt-2 self-stretch" />
      </View>
    </View>
  );
}
