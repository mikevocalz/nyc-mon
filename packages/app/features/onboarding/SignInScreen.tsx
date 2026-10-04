'use client';

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AuthError } from '@acme/auth';
import { Button, ErrorMessage, Heading, KeyboardAwareScroll, Text, TextField } from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { auth, isPasskeySupported } from './auth';
import { APP_HOME_PATH } from './boot';
import { copy, type OnboardingCopyId } from './copy';
import { useOnboarding } from './onboarding.store';

type Intent = 'create' | 'sign_in';
type Mode = 'providers' | 'email' | 'verify' | 'reset' | 'reset_sent';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function errorCopyId(error: AuthError): OnboardingCopyId | undefined {
  if (error.status === 0) return 'm03.error.offline';
  switch (error.code) {
    case 'INVALID_EMAIL':
      return 'm03.error.email.invalid';
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'm03.error.credentials';
    case 'PASSWORD_TOO_SHORT':
      return 'm03.error.password.too_short';
    case 'PASSWORD_TOO_LONG':
      return 'm03.error.password.too_long';
    case 'USER_ALREADY_EXISTS':
      return 'm03.error.account_exists';
    case 'EMAIL_NOT_VERIFIED':
      return 'm03.error.not_verified';
    case 'RESET_PASSWORD_DISABLED':
      return 'm03.reset.unavailable';
    default:
      return error.status >= 500 ? 'm03.error.server' : 'm03.error.server';
  }
}

/**
 * M03 sign-in / create account. The create path is only reachable through
 * the birth-year gate (P1): without a stored answer this redirects to M04.
 * Apple and Google buttons are held back until their native integrations
 * and brand assets land; the passkey button renders only when WebAuthn is
 * available, and only in the sign-in intent (create-by-passkey is an open
 * question). Every failure maps to a copy-deck id — server text is never
 * shown raw, and a cancelled provider sheet shows nothing.
 */
export function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent: Intent = params.intent === 'sign_in' ? 'sign_in' : 'create';
  const ageAnswer = useOnboarding((s) => s.ageAnswer);
  const setSession = useOnboarding((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('providers');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingCopy, setPendingCopy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [resent, setResent] = useState(false);
  const pending = pendingCopy !== undefined;

  useEffect(() => {
    if (intent === 'create' && ageAnswer === undefined) router.replace('/(auth)/age');
  }, [intent, ageAnswer, router]);

  const fail = (raw: AuthError) => {
    setPendingCopy(undefined);
    // GUARDIAN_CONSENT_REQUIRED / INVALID_BIRTH_YEAR must never surface their
    // server text (m03.error.needs_age): route back to the gate silently.
    if (raw.code === 'GUARDIAN_CONSENT_REQUIRED' || raw.code === 'INVALID_BIRTH_YEAR') {
      router.replace('/(auth)/age');
      return;
    }
    setError(copy(errorCopyId(raw) ?? 'm03.error.server'));
  };

  const signIn = async (kind: 'email' | 'passkey') => {
    setError(undefined);
    setPendingCopy(copy(kind === 'passkey' ? 'm03.provider.passkey.loading' : 'm03.email.loading'));
    const result =
      kind === 'passkey'
        ? await auth().signIn({ method: 'passkey' })
        : await auth().signIn({ method: 'email', email, password });
    if (!result.ok) {
      fail(result.error);
      return;
    }
    setSession(true);
    router.replace(APP_HOME_PATH);
  };

  const submitEmail = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      setError(copy('m03.error.email.invalid'));
      return;
    }
    if (intent === 'create') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(copy('m03.error.password.too_short'));
        return;
      }
      if (ageAnswer === undefined) return; // redirect is in flight
      setError(undefined);
      setPendingCopy(copy('m03.email.loading.create'));
      const result = await auth().signUp({
        email,
        password,
        name: email.split('@')[0] ?? email,
        birthYear: ageAnswer.birthYear,
      });
      setPendingCopy(undefined);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      // Verification gate: the server may or may not require the mail first.
      setMode('verify');
      return;
    }
    await signIn('email');
  };

  const sendReset = async () => {
    setPendingCopy(copy('m03.reset.submit'));
    const result = await auth().requestPasswordReset(email);
    setPendingCopy(undefined);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    setMode('reset_sent');
  };

  const resend = async () => {
    setPendingCopy(copy('m03.verify.resend'));
    await auth().resendVerification(email);
    setPendingCopy(undefined);
    setResent(true);
  };

  const title =
    mode === 'reset' || mode === 'reset_sent'
      ? copy('m03.reset.title')
      : mode === 'verify'
        ? copy('m03.verify.title')
        : copy(intent === 'create' ? 'm03.title.create' : 'm03.title.sign_in');

  return (
    <KeyboardAwareScroll>
      <View className="flex-1 px-4 py-6">
        <Form className="mx-auto w-full max-w-content-form gap-6">
          <View className="gap-2">
            <Heading level={1} size="title">{title}</Heading>
            {mode === 'providers' || mode === 'email' ? (
              <Text>{copy(intent === 'create' ? 'm03.subtitle.create' : 'm03.subtitle.sign_in')}</Text>
            ) : null}
          </View>
          {error !== undefined ? <ErrorMessage message={error} /> : null}
          {pendingCopy !== undefined ? <Text>{pendingCopy}</Text> : null}

          {mode === 'reset' || mode === 'reset_sent' ? (
            <View className="gap-4">
              <Text>{copy('m03.reset.body')}</Text>
              {mode === 'reset' ? (
                <Button
                  variant="cta"
                  size="lg"
                  fullWidth
                  title={copy('m03.reset.submit')}
                  disabled={pending || !EMAIL_PATTERN.test(email)}
                  onPress={() => void sendReset()}
                />
              ) : (
                <Text>{copy('m03.reset.sent')}</Text>
              )}
            </View>
          ) : mode === 'verify' ? (
            <View className="gap-4">
              <Text>{copy('m03.verify.body', { email })}</Text>
              {resent ? <Text>{copy('m03.verify.resent')}</Text> : null}
              <Button
                variant="outline"
                size="lg"
                fullWidth
                title={copy('m03.verify.resend')}
                disabled={pending}
                onPress={() => void resend()}
              />
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                title={copy('m03.verify.change_email')}
                disabled={pending}
                onPress={() => {
                  setMode('email');
                  setError(undefined);
                }}
              />
            </View>
          ) : (
            <View className="gap-6">
              {intent === 'sign_in' && isPasskeySupported() ? (
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  title={copy('m03.provider.passkey.label.sign_in')}
                  disabled={pending}
                  onPress={() => void signIn('passkey')}
                />
              ) : null}
              <Button
                variant={mode === 'email' ? 'ghost' : 'cta'}
                size="lg"
                fullWidth
                title={copy('m03.provider.email.label')}
                disabled={pending || mode === 'email'}
                onPress={() => {
                  setMode('email');
                  setError(undefined);
                }}
              />
              {mode === 'email' ? (
                <View className="gap-4">
                  <TextField
                    surface="daylit"
                    label={copy('m03.email.field.label')}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                  <TextField
                    surface="daylit"
                    label={copy('m03.password.field.label')}
                    hint={intent === 'create' ? copy('m03.password.field.hint.create') : undefined}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType={intent === 'create' ? 'newPassword' : 'password'}
                    onSubmitEditing={() => void submitEmail()}
                  />
                  <Button
                    variant="cta"
                    size="lg"
                    fullWidth
                    title={copy(intent === 'create' ? 'm03.email.submit.create' : 'm03.email.submit.sign_in')}
                    disabled={pending || !EMAIL_PATTERN.test(email) || password === ''}
                    onPress={() => void submitEmail()}
                  />
                  {intent === 'create' ? (
                    <Text variant="caption">{copy('m03.legal.notice.create')}</Text>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      title={copy('m03.password.forgot')}
                      disabled={pending}
                      onPress={() => {
                        setMode('reset');
                        setError(undefined);
                      }}
                    />
                  )}
                </View>
              ) : null}
            </View>
          )}
        </Form>
      </View>
    </KeyboardAwareScroll>
  );
}
