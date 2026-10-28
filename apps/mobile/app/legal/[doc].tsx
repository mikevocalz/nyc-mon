import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorScreen } from '@acme/app';
import { BackButton, SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { LEGAL_UI } from '@acme/app/features/legal/copy.ts';
import { LegalScreen, isLegalSlug } from '@acme/app/features/legal/LegalScreen.tsx';

/**
 * /legal/privacy, /legal/terms, /legal/childrens-privacy in the app: the same
 * documents as the site, with the kit's BackButton at the top left (drawn by
 * the screen, not the native header). Switching documents replaces the route,
 * so Back always returns to the screen that opened it. No slug opens Terms; a
 * slug that names no document gets the not-found screen rather than a
 * different document than the link promised.
 */
export default function LegalRoute() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const known = doc === undefined || isLegalSlug(doc);
  const slug = isLegalSlug(doc) ? doc : 'terms';
  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeArea edges={['top']} className="px-4 pt-2">
        <BackButton label={LEGAL_UI.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))} />
      </SafeArea>
      <View className="flex-1">
        {known ? <LegalScreen slug={slug} onOpen={(next) => router.setParams({ doc: next })} /> : <ErrorScreen kind="not-found" />}
      </View>
    </View>
  );
}
