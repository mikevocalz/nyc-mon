import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { semantic } from '@acme/theme';
import { IconButton } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import { copy } from '@acme/app/features/onboarding/copy.ts';
import { SignInBrandPanel, SignInSkyline } from '@acme/app/features/onboarding/SignInBrandPanel.tsx';
import { SignInScreen } from '@acme/app/features/onboarding/SignInScreen.tsx';
import { useSignInNav } from '@acme/app/features/onboarding/sign-in-nav.ts';

/**
 * M03 in the app: the ‹ sits in the native stack header's left slot, and from
 * lg the brand panel sits beside the form, the same composition as the web
 * page (apps/web/app/(site)/sign-in/page.tsx).
 */
export default function SignInRoute() {
  const { back } = useSignInNav();
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return (
    <View className="flex-1 bg-bg">
    <View className="flex-1 lg:flex-row">
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
              aria-label={copy('m03.back.a11y.label')}
              onPress={back}
              icon={<ChevronLeft size={26} />}
            />
          ),
        }}
      />
      <SignInBrandPanel className="hidden lg:flex lg:w-1/2" />
      <View className="flex-1">
        <SignInScreen />
      </View>
    </View>
      {/* The city runs across the whole bottom edge, under both columns. */}
      <SignInSkyline className="hidden lg:flex" />
    </View>
  );
}
