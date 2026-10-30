'use client';
import { type ReactNode, useState } from 'react';
import { useRouter } from '@payloadcms/ui';
import { BrandLogo, BrandWordmark, Button, Card, ErrorMessage, TextField } from '@acme/ui/admin';
import { View } from '@acme/ui/tw';
import { Aside, Form, Header, Heading, List, ListItem, Main, Page, Paragraph, Section, Text } from '@acme/ui/html';
import { consoleAuth } from './auth-client';
import { consoleCopy } from './copy';

export function ConsoleIcon() { return <BrandLogo size={28} />; }

const copy = consoleCopy.login;
const sections = ['overview', 'callers', 'consent', 'mons', 'models', 'content', 'audit', 'settings'] as const;

/** The console's section names set like stops on the station board (03-direction.md). */
function SectionBoard() {
  return (
    <List className="mt-8 border-t border-signage-white/25 [@media(max-height:820px)]:mt-5" aria-label="Console sections">
      {sections.map((key) => (
        <ListItem key={key} className="flex-row items-center gap-4 border-b border-signage-white/25 py-3 [@media(max-height:820px)]:py-2">
          <Text aria-hidden className="h-2 w-2 shrink-0 bg-signage-white" />
          <Text className="font-display text-base tracking-wide text-signage-white lg:text-lg">{consoleCopy.nav[key]}</Text>
        </ListItem>
      ))}
    </List>
  );
}

export function ConsoleLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setPending(true); setError(undefined);
    try {
      const response = await fetch('/payload-api/auth/sign-in/email', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) { setError("That email and password don't match. Check both and try again."); return; }
      router.push('/admin/overview');
    } catch { setError("Couldn't reach the server. Check your connection and try again."); }
    finally { setPending(false); }
  };
  const signInPasskey = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) { setError(copy.passkeyUnsupported); return; }
    setPending(true); setError(undefined);
    try {
      const result = await consoleAuth().signIn.passkey();
      if (result.error) {
        // A cancelled passkey prompt shows nothing (05-copy.md).
        if (/cancel|abort|notallowed/i.test(result.error.message ?? '')) return;
        setError(copy.passkeyError); return;
      }
      router.push('/admin/overview');
    } catch { setError(copy.passkeyError); }
    finally { setPending(false); }
  };
  return (
    <SignInFrame>
      <Form
        className="gap-4"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}
      >
        <Heading level={1} className="font-display text-2xl leading-[30px]">{copy.heading}</Heading>
        <TextField surface="daylit" label={copy.email} value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" autoComplete="email" required />
        <TextField surface="daylit" label={copy.password} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" required onSubmitEditing={() => void submit()} />
        {error ? <ErrorMessage surface="page" message={error} /> : null}
        <Button testID="login-submit" variant="cta" fullWidth title={pending ? 'Signing in…' : copy.submit} loading={pending} onPress={() => void submit()} />
        <Section aria-hidden className="h-px w-full bg-border" />
        <Button testID="login-passkey" variant="outline" fullWidth title={copy.passkey} disabled={pending} onPress={() => void signInPasskey()} />
      </Form>
    </SignInFrame>
  );
}

/**
 * A signed-in account with no staff role (03-direction.md, Sign in): the
 * sign-in frame with one line of why and a way out. Every console view
 * renders this instead of its data (views/Views.tsx `staffOnly`).
 */
export function ConsoleNotStaff() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    try { await consoleAuth().signOut(); } catch { /* a failed sign-out still lands on the login screen */ }
    router.push('/admin/login');
  };
  return (
    <SignInFrame>
      <Section className="gap-4" testID="console-not-staff">
        <Heading level={1} className="my-0 font-display text-2xl leading-[30px]">{copy.notStaffTitle}</Heading>
        <Paragraph className="my-0 text-base leading-relaxed text-text-secondary">{copy.notStaffBody}</Paragraph>
        <Button testID="not-staff-sign-out" variant="outline" fullWidth title={copy.notStaffSignOut} loading={pending} onPress={() => void signOut()} />
      </Section>
    </SignInFrame>
  );
}

/** The sign-in frame: the station board panel beside one page card. */
function SignInFrame({ children }: { children: ReactNode }) {
  return (
    <Page className="nycmon-console fixed inset-0 overflow-y-auto bg-bg font-sans text-text">
      {/*
        The Page scrolls; this row is as tall as its content (never less than
        the viewport), so the board panel paints behind its last line on a
        short window instead of stopping at the fold with the footer below it.
      */}
      <View className="min-h-full md:flex-row">
        {/* Compact brand band on narrow screens; the full board panel from md up. */}
        <Header className="gap-3 bg-signage-black px-6 py-8 md:hidden">
          <BrandWordmark height={32} />
          <Paragraph className="my-0 text-sm text-signage-white/70">{copy.heroHeading}</Paragraph>
        </Header>
        <Aside className="hidden w-2/5 flex-col bg-signage-black px-10 py-10 md:flex lg:w-[44%] lg:px-12 lg:py-12 xl:w-[46%]">
          <BrandWordmark height={40} />
          <Section className="my-auto gap-5 py-12 [@media(max-height:820px)]:py-8">
            <Heading level={2} className="my-0 font-display text-3xl leading-tight text-signage-white lg:text-4xl">{copy.heroHeading}</Heading>
            <Paragraph className="my-0 max-w-sm text-base leading-relaxed text-signage-white/70">{copy.heroBody}</Paragraph>
            <SectionBoard />
          </Section>
          <Paragraph className="my-0 text-sm text-signage-white/60">{copy.heroFoot}</Paragraph>
        </Aside>
        <Main className="flex-1 items-center justify-center p-6 md:p-10">
          <Section className="w-full max-w-[400px] [clip-path:polygon(20px_0,100%_0,100%_100%,0_100%,0_20px)]">
            <Card surface="page" size="lg" className="w-full">
              {children}
            </Card>
          </Section>
        </Main>
      </View>
    </Page>
  );
}
