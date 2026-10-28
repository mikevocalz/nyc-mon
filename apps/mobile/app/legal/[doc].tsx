import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ErrorScreen } from '@acme/app';
import { semantic } from '@acme/theme';
import { IconButton } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { LEGAL_UI } from '@acme/app/features/legal/copy.ts';
import { LegalScreen, isLegalSlug } from '@acme/app/features/legal/LegalScreen.tsx';

/**
 * /legal/privacy, /legal/terms, /legal/childrens-privacy in the app: the same
 * documents as the site, with ‹ in the native header's left slot. Switching
 * documents replaces the route, so ‹ always returns to the screen that opened it.
 * No slug opens the Terms; a slug that names no document gets the not-found
 * screen rather than a different document than the link promised.
 */
export default function LegalRoute() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const known = doc === undefined || isLegalSlug(doc);
  const slug = isLegalSlug(doc) ? doc : 'terms';
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: semantic.bg[scheme] },
          headerBackVisible: false,
          headerLeft: () => (
            <IconButton
              variant="ghost"
              tone="royal"
              aria-label={LEGAL_UI.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
              icon={<ChevronLeft size={26} />}
            />
          ),
        }}
      />
      {known ? (
        <LegalScreen slug={slug} onOpen={(next) => router.setParams({ doc: next })} />
      ) : (
        <ErrorScreen kind="not-found" />
      )}
    </>
  );
}
