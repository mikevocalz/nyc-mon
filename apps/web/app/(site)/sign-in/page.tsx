'use client';

import { Suspense } from 'react';
import { SignInScreen } from '@acme/app/features/onboarding/SignInScreen.tsx';

// Suspense: the web sign-in reads ?intent= through useSearchParams, which
// Next wants behind a boundary on a statically rendered page.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
