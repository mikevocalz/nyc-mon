import { Stack } from 'expo-router';
import { BackButton, SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { copy } from '@acme/app/features/onboarding/copy.ts';
import { SignInBrandPanel, SignInSkyline } from '@acme/app/features/onboarding/SignInBrandPanel.tsx';
import { SignInScreen } from '@acme/app/features/onboarding/SignInScreen.tsx';
import { useSignInNav } from '@acme/app/features/onboarding/sign-in-nav.ts';

/**
 * M03 in the app: the kit's BackButton at the top left (drawn by the screen,
 * not the native header, which wraps header items in the OS glass), and from
 * lg the brand panel beside the form, the same composition as the web page.
 */
export default function SignInRoute() {
  const { back } = useSignInNav();
  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeArea edges={['top']} className="px-4 pt-4">
        <BackButton label={copy('m03.back.a11y.label')} onPress={back} />
      </SafeArea>
      <View className="flex-1 lg:flex-row">
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
