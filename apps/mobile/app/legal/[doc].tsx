import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { semantic } from '@acme/theme';
import { IconButton } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { LegalScreen, isLegalSlug } from '@acme/app/features/legal/LegalScreen.tsx';

/**
 * /legal/privacy, /legal/terms, /legal/childrens-privacy in the app: the same
 * documents as the site, with ‹ in the native header's left slot. Switching
 * documents replaces the route, so ‹ always returns to the screen that opened it.
 */
export default function LegalRoute() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
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
              aria-label="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
              icon={<ChevronLeft size={26} />}
            />
          ),
        }}
      />
      <LegalScreen slug={slug} onOpen={(next) => router.setParams({ doc: next })} />
    </>
  );
}
