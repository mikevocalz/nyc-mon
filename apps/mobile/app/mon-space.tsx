import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { LoadingSkeleton, SafeArea, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useMonStore } from '@acme/app/features/mon/mon.store.ts';
import { auth, AUTH_BASE_URL, APP_ORIGIN } from '@acme/app/features/onboarding/auth.ts';
import { copy } from '@acme/app/features/onboarding/copy.ts';
import { currentCareLinkTarget, saveIO, verifyCareLinkOwner } from '@acme/app/features/onboarding/save-store.ts';
import { careConsentAllowed } from '@acme/app/features/mon-space/care-surface-owner.ts';

/** Canonical widget/notification link to the existing companion care screen.
 * Unknown or removed Mon IDs leave the current selection alone.
 */
export default function MonSpaceLink() {
  const { monId } = useLocalSearchParams<{ monId?: string }>();
  const router = useRouter();
  const session = auth().useSession();
  const pending = session.isPending;
  const authUserId = session.data?.user.id ?? null;
  useEffect(() => {
    if (pending) return;
    let live = true;
    // A direct widget URL must not bypass auth/consent boot or open a save
    // retained from a different account. Verification happens at app root.
    const target = currentCareLinkTarget(authUserId);
    const open = () => {
      const checked = currentCareLinkTarget(authUserId);
      if (checked !== '/(home)') { router.replace(checked); return; }
      const save = saveIO.read();
      useMonStore.getState().hydrate();
      if (monId && save?.mons.some((mon) => mon.monInstanceId === monId)) useMonStore.getState().setActiveMon(monId);
      router.replace('/(home)');
    };
    if (target === '/(home)') open();
    else if (!authUserId || !careConsentAllowed(saveIO.read()) || target !== '/(auth)/sign-in?intent=sign-in') router.replace(target);
    else {
      // Keep the original Mon intent while a legacy save's server ownership
      // proof is pending. A failure/timeout routes safely to sign-in.
      void verifyCareLinkOwner(authUserId, {
        baseUrl: AUTH_BASE_URL, fetch, isCurrent: () => live,
        headers: Platform.OS === 'web' ? undefined : { origin: APP_ORIGIN },
      }).then((verified) => {
        if (!live) return;
        if (verified) open();
        else router.replace('/(auth)/sign-in?intent=sign-in');
      }).catch(() => { if (live) router.replace('/(auth)/sign-in?intent=sign-in'); });
    }
    return () => { live = false; };
  }, [monId, router, pending, authUserId]);
  return (
    <SafeArea className="flex-1 bg-bg">
      <View accessibilityRole="progressbar" accessibilityLabel={copy('settings.account.methods.loading')} accessibilityState={{ busy: true }} className="flex-1 justify-center gap-4 p-6">
        <Text>{copy('settings.account.methods.loading')}</Text>
        <LoadingSkeleton variant="card" />
      </View>
    </SafeArea>
  );
}
