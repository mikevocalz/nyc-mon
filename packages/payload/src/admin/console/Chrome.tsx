'use client';
import { useState } from 'react';
import { useRouter } from '@payloadcms/ui';
import { BrandLogo, BrandWordmark, Button, Card, ErrorMessage, TextField } from '@acme/ui/admin';
import { Form, Heading, Main, Page } from '@acme/ui/html';
import { consoleCopy } from './copy';

export function ConsoleIcon() { return <BrandLogo size={28} />; }

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
  return <Page className="nycmon-console min-h-dvh items-center justify-center bg-bg p-4 text-text"><Main className="w-full max-w-md gap-6"><BrandWordmark height={32} /><Card surface="page"><Form className="gap-4"><Heading level={1}>{consoleCopy.login.heading}</Heading><TextField label={consoleCopy.login.email} value={email} onChangeText={setEmail} /><TextField label={consoleCopy.login.password} value={password} onChangeText={setPassword} secureTextEntry />{error ? <ErrorMessage message={error} /> : null}<Button title={pending ? 'Signing in…' : consoleCopy.login.submit} loading={pending} onPress={() => void submit()} /></Form></Card></Main></Page>;
}
