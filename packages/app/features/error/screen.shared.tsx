'use client';
import { View } from '@acme/ui/tw';
import { Container, Heading, Text, Button, SafeArea } from '@acme/ui';
import { errorCopy } from './copy';

export interface ErrorScreenProps {
  /** 404 vs generic failure */
  kind?: 'not-found' | 'error';
  detail?: string;
  onGoHome?: () => void;
  /** A quieter "Go back" under the home button, when there is a screen to return to. */
  onGoBack?: () => void;
}

/** {@linkcode ErrorMessageBlock} props: `surface="night"` for an ink plate. Default page. */
export interface ErrorMessageBlockProps extends ErrorScreenProps {
  surface?: 'page' | 'night';
}

/** The code, the headline, the explanation and the way home. The web page lays it on a plate over a background. */
export function ErrorMessageBlock({ kind = 'not-found', detail, onGoHome, onGoBack, surface = 'page' }: ErrorMessageBlockProps) {
  const notFound = kind === 'not-found';
  // Explicit palette steps on the ink plate: themed tokens follow the page's
  // scheme. Measured in packages/theme/contrast.ts ('error message on ink plate').
  const night = surface === 'night';
  return (
    <View className="items-center gap-4">
      <Text className={`font-display text-display-xl ${night ? 'text-orange-500' : 'text-primary'}`}>
        {errorCopy(notFound ? 'error.not_found.code' : 'error.failed.code')}
      </Text>
      <View className="items-center gap-1 md:gap-2">
        {/* The app page (tablet): one rung above the kit's display-sm step at md.
            The site's ink plate keeps the kit step. */}
        <Heading level={1} size="display-sm" className={night ? 'text-center text-ink-50' : 'text-center md:text-display-lg'}>
          {errorCopy(notFound ? 'error.not_found.title' : 'error.failed.title')}
        </Heading>
        <Text
          selectable
          {...(night
            ? { className: 'text-center text-silver-200' }
            : { tone: 'muted' as const, className: 'text-center md:text-lg' })}
        >
          {detail ?? errorCopy(notFound ? 'error.not_found.body' : 'error.failed.body')}
        </Text>
      </View>
      <View className="w-full items-center gap-2">
        <Button title={errorCopy('error.home')} onPress={onGoHome} />
        {onGoBack !== undefined ? (
          <Button variant="ghost" tone="royal" title={errorCopy('error.back')} onPress={onGoBack} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * ONE error page for Expo +not-found AND Next not-found/error (user rule —
 * the same screen serves both, dvnt-monorepo style). The app's page:
 *
 * - Phone (below md): the message centred in the form column.
 * - Tablet portrait (md+): top-aligned under the safe area, the column widened
 *   to content-detail, the heading one rung up.
 * - Landscape (md+): the same wider column, centred. No second pane: the only
 *   error art (the site's subway map and sign rain) runs on no native screen
 *   yet, and a crash or 404 page is the last place to add an unproven GPU scene.
 *
 * Outside the navigation shell (root `+not-found`), so no rail or header to clear.
 */
export function ErrorScreen(props: ErrorScreenProps) {
  return (
    <View className="min-h-screen w-full flex-1 bg-surface">
      <SafeArea className="flex-1" edges={['top', 'bottom']}>
        <View className="mx-auto w-full max-w-screen-2xl flex-1 items-center justify-center p-6 md:px-8 md:py-10 md:portrait:justify-start">
          <Container width="form" className="md:max-w-content-detail">
            <ErrorMessageBlock {...props} />
          </Container>
        </View>
      </SafeArea>
    </View>
  );
}
