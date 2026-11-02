'use client';
import { useRouter as useStackRouter } from 'expo-router';
import { useRouter } from 'solito/navigation';
import { ErrorScreen as Shared, type ErrorScreenProps } from './screen.shared';

export function ErrorScreen(props: Omit<ErrorScreenProps, 'onGoHome' | 'onGoBack'>) {
  const router = useRouter();
  const stack = useStackRouter();
  // "Go back" only when there is a screen to return to (a bad deep link has none).
  const canGoBack = stack.canGoBack();
  return (
    <Shared
      {...props}
      onGoHome={() => router.push('/')}
      onGoBack={canGoBack ? () => stack.back() : undefined}
    />
  );
}
