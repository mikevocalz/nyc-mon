'use client';
// The Alexa+ linking pages (ADR 0016), drawn with the kit the console uses:
// the brand wordmark over a kit Card, kit TextFields and Buttons, and the
// app's sign-in copy (packages/app/features/onboarding/copy.ts, M03).
// pages.ts verifies the signed `oauth_query` on the server and hands each page
// its data; these components only collect input and talk to Better Auth. The
// provider's client plugin (`oauthProviderClient`) attaches the signed query to
// every POST, so sign-in, passkey, TOTP and consent all continue the same
// authorization request.
import { AuthProviderButton, BrandWordmark, Button, Card, ErrorMessage, Heading, TextField } from '@acme/ui/admin';
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

function LinkFrame({ lead, children }: { lead?: ReactNode; children: ReactNode }) {
  // Same frame as the console sign-in (admin/console/Chrome.tsx ConsoleLogin),
  // following the device's light or dark setting.
  return (
    // The console root class and the device light/dark scheme sit on a wrapping
    // View; Page keeps the console sign-in's own layout classes.
    <View className="nycmon-console [color-scheme:light_dark]">
    <Page className="min-h-dvh items-center justify-center bg-bg p-4 text-text">
      <Main className="w-full max-w-md gap-6">
        <BrandWordmark height={32} />
        {lead}
        <Card variant="notch" district="megacity" notchSides={['top']}>
          <Section className="gap-3">{children}</Section>
        </Card>
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

function SignInPage({ clientName }: { clientName: string }) {
  const copy = COPY.signIn;
  const { email, password, code, needsCode, pending, error, passkeySupported } = useLinkSignInStore();
  const { setEmail, setPassword, setCode, setNeedsCode, setPending, setError, setPasskeySupported, reset } = useLinkSignInStore();

  // Decided after hydration so the server and first client render agree.
  useEffect(() => {
    reset();
    setPasskeySupported(typeof globalThis.PublicKeyCredential !== 'undefined');
  }, [reset, setPasskeySupported]);

  async function run(kind: 'email' | 'passkey' | 'code', failure: string): Promise<void> {
    setError(undefined);
    setPending(kind);
    try {
      const auth = authClient();
      const result =
        kind === 'passkey'
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
      lead={
        // Same order as M03 SignInScreen: heading and intro on the page, then
        // the provider buttons on the page surface, then the email form.
        <Section className="gap-3">
          <Heading level={1}>{copy.heading}</Heading>
          <Paragraph className="my-0 text-base text-text">{copy.body(clientName, passkeySupported && !needsCode)}</Paragraph>
          {passkeySupported && !needsCode ? (
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
        </Section>
      }
    >
      <Heading level={2}>{copy.emailHeading}</Heading>
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
      <Heading level={1}>{copy.heading(clientName)}</Heading>
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
      <Heading level={1}>{copy.heading}</Heading>
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
      <Heading level={1}>{COPY.expired.heading}</Heading>
      <Paragraph className="my-0 text-base text-text">{COPY.expired.body}</Paragraph>
    </LinkFrame>
  );
}

/** Renders whichever linking page `data` (from pages.ts `loadLinkPage`) describes. */
export function LinkPage({ data }: { data: LinkPageData }) {
  switch (data.kind) {
    case 'sign-in':
      return <SignInPage clientName={data.clientName} />;
    case 'consent':
      return <ConsentPage clientName={data.clientName} scopes={data.scopes} />;
    case 'refused':
      return <RefusedPage clientName={data.clientName} backHref={data.backHref} />;
    case 'expired':
      return <ExpiredPage />;
  }
}
