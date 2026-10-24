'use client';
// The Alexa+ linking pages (ADR 0016), drawn with the kit the console uses:
// Lil' Ratti beside the brand wordmark over a kit Card, kit TextFields and
// Buttons, and the app's sign-in copy (packages/app/features/onboarding/copy.ts, M03).
// pages.ts verifies the signed `oauth_query` on the server and hands each page
// its data; these components only collect input and talk to Better Auth. The
// provider's client plugin (`oauthProviderClient`) attaches the signed query to
// every POST, so sign-in, passkey, TOTP and consent all continue the same
// authorization request.
import { creatureArt } from '@acme/assets/creatures';
import { AuthProviderButton, BrandWordmark, Button, Card, ErrorMessage, Heading, Image, type ImageProps, TextField } from '@acme/ui/admin';
import { Form, List, ListItem, Main, Output, Page, Paragraph, Section } from '@acme/ui/html';
import { Fingerprint } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';
import { type ReactNode, useEffect } from 'react';
import { useLinkConsentStore, useLinkSignInStore } from './link-store';
import type { LinkPageData } from './pages';

export { LINK_PAGE_HEADERS } from './link-page-headers';

/** Better Auth's mount on admin-vite (auth/options.ts PAYLOAD_API_ROUTE + AUTH_BASE_PATH). */
const AUTH_PATH = '/payload-api/auth';

/** What each scope lets the app do, in the Caller's words. */
export const SCOPE_COPY: Readonly<Record<string, string>> = {
  'mcp:caller': 'Check on your Mons and look after them for you.',
  'mcp:care': 'See how your Mons are doing.',
  offline_access: 'Stay linked until you unlink it.',
};

const COPY = {
  signIn: {
    heading: 'Sign in to link NYC-MON',
    body: (client: string, passkey: boolean) =>
      `${passkey ? 'Use your passkey, or sign in with your email and password below.' : 'Sign in with your email and password.'} Linking NYC-MON to ${client} is for adults (18+).`,
    passkey: 'Sign in with a passkey',
    amazon: 'Continue with Amazon',
    amazonLoading: 'Opening Amazon…',
    emailHeading: 'Sign in with email',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    loading: 'Signing you in…',
    code: 'Code from your authenticator app',
    verify: 'Verify code',
    verifying: 'Checking your code…',
  },
  consent: {
    heading: (client: string) => `Link NYC-MON to ${client}?`,
    body: (client: string) => `${client} will be able to:`,
    note: 'You can unlink any time in the Alexa app.',
    link: 'Link',
    linking: 'Linking…',
    cancel: 'Cancel',
  },
  refused: {
    heading: 'NYC-MON on Alexa is for adults',
    body: 'Only accounts for people 18 and over can link NYC-MON to Alexa. You can still play NYC-MON in the app.',
    help: 'If the birth year on this account is wrong, contact NYC-MON support.',
    back: (client: string) => `Back to ${client}`,
  },
  expired: {
    heading: 'This link has expired',
    body: 'Go back to the Alexa app and start linking NYC-MON again.',
  },
  error: {
    passkey: "That passkey didn't work. Try again, or sign in with your email.",
    amazon: "That Amazon account isn't linked to NYC-MON yet. Link Amazon from NYC-MON Settings first, or sign in another way.",
    credentials: "That email and password don't match. Check both, or reset your password.",
    code: "That code didn't work. Check your authenticator app and try again.",
    adultsOnly: 'NYC-MON on Alexa is for adults (18+) only.',
    expired: 'This request has expired. Start again from the Alexa app.',
    offline: "You're offline. Connect to the internet to sign in.",
    server: 'Something broke on our end. Try again in a minute.',
  },
} as const;

let client: ReturnType<typeof makeClient> | undefined;
function makeClient() {
  return createAuthClient({
    baseURL: `${window.location.origin}${AUTH_PATH}`,
    plugins: [passkeyClient(), oauthProviderClient()],
  });
}
function authClient() {
  if (client === undefined) client = makeClient();
  return client;
}

/** The provider answers a continued authorization with `{ redirect: true, url }`. */
function continueUrl(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const url = (data as { url?: unknown }).url;
  return typeof url === 'string' ? url : undefined;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * The starter character. Nobody is signed in yet, so the page cannot know which
 * Mon the person has; it shows Lil' Ratti for NYC-MON, as the signed-out
 * simulator does (web-sim App.tsx SignedOutMon). A 44 KB still, not the 34 MB
 * GLB: three.js stays out of the admin bundle (08-handoff.md P3).
 */
const STARTER_ART = creatureArt('lil-ratti');

function StarterStill() {
  // Sized like HomeLayout's renderStill: a box at the art's own aspect, the
  // kit Image filling it unframed so the transparent render sits on the page.
  return (
    <View className="w-20 shrink-0 self-center lg:w-64" style={{ aspectRatio: STARTER_ART.width / STARTER_ART.height }}>
      <Image src={STARTER_ART.source as ImageProps['src']} alt={STARTER_ART.alt} fill framed={false} unoptimized className="h-full w-full" />
    </View>
  );
}

function LinkFrame({ intro, aside, children }: { intro?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  // Same frame as the console sign-in (admin/console/Chrome.tsx ConsoleLogin),
  // following the device's light or dark setting. Lil' Ratti stands above the
  // column on a phone and beside it from lg up. With an `aside` (the sign-in
  // page's provider buttons) the buttons and the Card sit side by side from lg
  // up, so the page fits a 1280x800 window without scrolling.
  return (
    // The console root class and the device light/dark scheme sit on a wrapping
    // View; Page keeps the console sign-in's own layout classes.
    <View className="nycmon-console [color-scheme:light_dark]">
    <Page className="min-h-dvh items-center justify-center bg-bg p-4 text-text">
      <Main className="w-full max-w-md gap-4 lg:max-w-6xl lg:flex-row lg:items-center lg:justify-center lg:gap-10">
        <StarterStill />
        <View className={aside === undefined ? 'w-full max-w-md gap-4' : 'w-full max-w-md gap-4 lg:max-w-3xl'}>
          <BrandWordmark height={32} />
          {intro}
          <View className="gap-4 lg:flex-row lg:items-start lg:gap-6">
            {aside !== undefined ? <Section className="gap-3 lg:flex-1">{aside}</Section> : null}
            <View className="lg:flex-1">
              <Card variant="notch" district="megacity" notchSides={['top']}>
                <Section className="gap-3">{children}</Section>
              </Card>
            </View>
          </View>
        </View>
      </Main>
    </Page>
    </View>
  );
}

function Status({ message }: { message: string | undefined }) {
  return (
    <Output aria-live="polite">
      <ErrorMessage message={message} />
    </Output>
  );
}

function SignInPage({ clientName, amazonEnabled }: { clientName: string; amazonEnabled: boolean }) {
  const copy = COPY.signIn;
  const { email, password, code, needsCode, pending, error, passkeySupported } = useLinkSignInStore();
  const { setEmail, setPassword, setCode, setNeedsCode, setPending, setError, setPasskeySupported, reset } = useLinkSignInStore();

  // Decided after hydration so the server and first client render agree.
  useEffect(() => {
    reset();
    setPasskeySupported(typeof globalThis.PublicKeyCredential !== 'undefined');
  }, [reset, setPasskeySupported]);

  async function run(kind: 'amazon' | 'email' | 'passkey' | 'code', failure: string): Promise<void> {
    setError(undefined);
    setPending(kind);
    try {
      const auth = authClient();
      const result =
        kind === 'amazon'
          ? await auth.signIn.social({
              provider: 'amazon',
              // Preserve the provider-signed Alexa oauth_query across the LWA round trip.
              callbackURL: window.location.href,
            })
          : kind === 'passkey'
          ? await auth.signIn.passkey()
          : kind === 'code'
          ? await auth.$fetch('/two-factor/verify-totp', { method: 'POST', body: { code: code.trim() } })
          : await auth.signIn.email({ email: email.trim(), password });
      const data: unknown = result.data;
      if (typeof data === 'object' && data !== null && (data as { twoFactorRedirect?: unknown }).twoFactorRedirect === true) {
        setNeedsCode(true);
        return;
      }
      const url = continueUrl(data);
      if (url !== undefined) {
        window.location.assign(url);
        return;
      }
      setError(result.error ? failure : COPY.error.expired);
    } catch {
      setError(isOffline() ? COPY.error.offline : COPY.error.server);
    } finally {
      setPending(undefined);
    }
  }

  return (
    <LinkFrame
      intro={
        // Same order as M03 SignInScreen: heading and intro on the page, then
        // the provider buttons on the page surface, then the email form.
        <Section className="gap-2">
          <Heading level={1} size="title" className="my-0">{copy.heading}</Heading>
          <Paragraph className="my-0 text-base text-text">{copy.body(clientName, passkeySupported && !needsCode)}</Paragraph>
        </Section>
      }
      aside={
        needsCode || !(amazonEnabled || passkeySupported) ? undefined : (
          <>
              {amazonEnabled ? (
                <AuthProviderButton
                  provider="amazon"
                  intent="sign-in"
                  label={COPY.signIn.amazon}
                  loading={pending === 'amazon'}
                  disabled={pending !== undefined}
                  onPress={() => void run('amazon', COPY.error.amazon)}
                />
              ) : null}
              {passkeySupported ? (
                <AuthProviderButton
                  provider="passkey"
                  intent="sign-in"
                  label={copy.passkey}
                  icon={<Fingerprint className="size-5 text-text" />}
                  loading={pending === 'passkey'}
                  disabled={pending !== undefined}
                  onPress={() => void run('passkey', COPY.error.passkey)}
                />
              ) : null}
          </>
        )
      }
    >
      <Heading level={2} size="title" className="my-0">{copy.emailHeading}</Heading>
      <Form className="gap-4" noValidate onSubmit={(event) => event.preventDefault()}>
        {needsCode ? (
          <TextField label={copy.code} value={code} onChangeText={setCode} />
        ) : (
          <>
            <TextField label={copy.email} value={email} onChangeText={setEmail} />
            <TextField label={copy.password} value={password} onChangeText={setPassword} secureTextEntry />
          </>
        )}
        <Status message={error} />
        {needsCode ? (
          <Button
            title={pending === 'code' ? copy.verifying : copy.verify}
            variant="cta"
            size="lg"
            fullWidth
            loading={pending === 'code'}
            disabled={pending !== undefined}
            onPress={() => void run('code', COPY.error.code)}
          />
        ) : (
          <Button
            title={pending === 'email' ? copy.loading : copy.submit}
            variant="cta"
            size="lg"
            fullWidth
            loading={pending === 'email'}
            disabled={pending !== undefined}
            onPress={() => void run('email', COPY.error.credentials)}
          />
        )}
      </Form>
    </LinkFrame>
  );
}

function ConsentPage({ clientName, scopes }: { clientName: string; scopes: string[] }) {
  const copy = COPY.consent;
  const { pending, error, setPending, setError, reset } = useLinkConsentStore();
  useEffect(() => {
    reset();
  }, [reset]);
  const shown = scopes.filter((scope) => SCOPE_COPY[scope] !== undefined);

  async function answer(accept: boolean): Promise<void> {
    setError(undefined);
    setPending(accept ? 'link' : 'cancel');
    try {
      const result = await authClient().$fetch('/oauth2/consent', { method: 'POST', body: { accept } });
      const url = continueUrl(result.data);
      if (url !== undefined) {
        window.location.assign(url);
        return;
      }
      const status = (result.error as { status?: number } | null)?.status;
      setError(status === 403 ? COPY.error.adultsOnly : COPY.error.expired);
    } catch {
      setError(isOffline() ? COPY.error.offline : COPY.error.server);
    } finally {
      setPending(undefined);
    }
  }

  return (
    <LinkFrame>
      <Heading level={1} size="title" className="my-0">{copy.heading(clientName)}</Heading>
      <Paragraph className="my-0 text-base text-text">{copy.body(clientName)}</Paragraph>
      <List className="m-0 gap-2 pl-5">
        {shown.map((scope) => (
          <ListItem key={scope} className="text-base text-text">
            {SCOPE_COPY[scope]}
          </ListItem>
        ))}
      </List>
      <Paragraph className="my-0 text-sm text-text-muted">{copy.note}</Paragraph>
      <Status message={error} />
      <Button
        title={pending === 'link' ? copy.linking : copy.link}
        variant="cta"
        size="lg"
        fullWidth
        loading={pending === 'link'}
        disabled={pending !== undefined}
        onPress={() => void answer(true)}
      />
      <Button title={copy.cancel} variant="outline" size="lg" fullWidth disabled={pending !== undefined} onPress={() => void answer(false)} />
    </LinkFrame>
  );
}

function RefusedPage({ clientName, backHref }: { clientName: string | undefined; backHref: string | undefined }) {
  const copy = COPY.refused;
  return (
    <LinkFrame>
      <Heading level={1} size="title" className="my-0">{copy.heading}</Heading>
      <Paragraph className="my-0 text-base text-text">{copy.body}</Paragraph>
      <Paragraph className="my-0 text-sm text-text-muted">{copy.help}</Paragraph>
      {backHref !== undefined ? (
        <Button title={copy.back(clientName ?? 'Alexa')} variant="cta" size="lg" fullWidth onPress={() => window.location.assign(backHref)} />
      ) : null}
    </LinkFrame>
  );
}

function ExpiredPage() {
  return (
    <LinkFrame>
      <Heading level={1} size="title" className="my-0">{COPY.expired.heading}</Heading>
      <Paragraph className="my-0 text-base text-text">{COPY.expired.body}</Paragraph>
    </LinkFrame>
  );
}

/** Renders whichever linking page `data` (from pages.ts `loadLinkPage`) describes. */
export function LinkPage({ data }: { data: LinkPageData }) {
  switch (data.kind) {
    case 'sign-in':
      return <SignInPage clientName={data.clientName} amazonEnabled={data.amazonEnabled} />;
    case 'consent':
      return <ConsentPage clientName={data.clientName} scopes={data.scopes} />;
    case 'refused':
      return <RefusedPage clientName={data.clientName} backHref={data.backHref} />;
    case 'expired':
      return <ExpiredPage />;
  }
}
