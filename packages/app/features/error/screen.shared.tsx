'use client';
import { View } from '@acme/ui/tw';
import { Container, Heading, Text, Button } from '@acme/ui';

export interface ErrorScreenProps {
  /** 404 vs generic failure */
  kind?: 'not-found' | 'error';
  detail?: string;
  onGoHome?: () => void;
}

/** {@linkcode ErrorMessageBlock} props: `surface="night"` for an ink plate. Default page. */
export interface ErrorMessageBlockProps extends ErrorScreenProps {
  surface?: 'page' | 'night';
}

/** The code, the headline, the explanation and the way home. The web page lays it on a plate over a background. */
export function ErrorMessageBlock({ kind = 'not-found', detail, onGoHome, surface = 'page' }: ErrorMessageBlockProps) {
  const notFound = kind === 'not-found';
  // Explicit palette steps on the ink plate: themed tokens follow the page's
  // scheme. Measured in packages/theme/contrast.ts ('error message on ink plate').
  const night = surface === 'night';
  return (
    <View className="items-center gap-4">
      <Text className={`font-display text-display-xl ${night ? 'text-orange-500' : 'text-primary'}`}>
        {notFound ? '404' : '!'}
      </Text>
      <View className="items-center gap-1">
        <Heading level={1} size="display-sm" className={night ? 'text-center text-ink-50' : 'text-center'}>
          {notFound ? 'Page not found' : 'Something went wrong'}
        </Heading>
        <Text {...(night ? { className: 'text-center text-silver-200' } : { tone: 'muted' as const, className: 'text-center' })}>
          {detail ??
            (notFound
              ? 'The page you are looking for does not exist or has moved.'
              : 'An unexpected error occurred. Try again in a moment.')}
        </Text>
      </View>
      <Button title="Back to Home" onPress={onGoHome} />
    </View>
  );
}

/** ONE error page for Expo +not-found AND Next not-found/error (user rule —
 *  the same screen serves both, dvnt-monorepo style). */
export function ErrorScreen(props: ErrorScreenProps) {
  return (
    <View className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 items-center justify-center bg-surface p-6">
      <Container width="form">
        <ErrorMessageBlock {...props} />
      </Container>
    </View>
  );
}
