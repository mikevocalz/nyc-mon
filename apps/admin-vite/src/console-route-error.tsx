/**
 * The admin routes' error boundary. Without one, an error in a Payload view
 * reaches TanStack's default component ("Something went wrong!" plus the raw
 * error text, which for a failed query is the SQL).
 *
 * This state stays put until someone presses the button. Nothing in it
 * retries on a timer, on mount or on focus: an automatic retry on a view
 * that throws every time is a re-mount loop. Retry re-runs the route loader
 * (`router.invalidate()`), then clears the boundary.
 *
 * The cause goes to the console once per error, never onto the page.
 *
 * SOT: node_modules/@tanstack/router-core/dist/esm/route.d.ts (ErrorComponentProps)
 */
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BrandWordmark, Button, Card } from '@acme/ui/admin';
import { Heading, Link, Main, Page, Paragraph, Section } from '@acme/ui/html';

export const CONSOLE_ROUTE_ERROR_COPY = {
  heading: "This page didn't load",
  body: 'The server had a problem building this page. Nothing you entered was lost. Try again, or go back to the overview.',
  retry: 'Try again',
  home: 'Go to the overview',
} as const;

export function ConsoleRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error('[console] route error', error);
  }, [error]);
  const retry = () => {
    void router.invalidate().finally(reset);
  };
  return (
    <Page className="nycmon-console min-h-dvh bg-bg font-sans text-text" testID="console-route-error">
      <Main className="flex-1 items-center justify-center p-6">
        <Section className="w-full max-w-[440px] gap-6">
          <BrandWordmark height={32} />
          <Card surface="page" size="lg" className="w-full">
            <Section role="alert" className="gap-4">
              <Heading level={1} className="my-0 font-display text-2xl leading-[30px] text-text">{CONSOLE_ROUTE_ERROR_COPY.heading}</Heading>
              <Paragraph className="my-0 text-base leading-relaxed text-text-secondary">{CONSOLE_ROUTE_ERROR_COPY.body}</Paragraph>
              <Button testID="console-route-error-retry" variant="cta" fullWidth title={CONSOLE_ROUTE_ERROR_COPY.retry} onPress={retry} />
              <Link href="/admin/overview" className="self-start text-sm font-medium text-accent underline">{CONSOLE_ROUTE_ERROR_COPY.home}</Link>
            </Section>
          </Card>
        </Section>
      </Main>
    </Page>
  );
}
