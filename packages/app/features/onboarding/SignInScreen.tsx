'use client';

import { useEffect, useRef, useState } from 'react';
import type { AuthError } from '@acme/auth';
import {
  AuthProviderButton,
  BackButton,
  Button,
  ErrorMessage,
  Heading,
  KeyboardAwareScroll,
  Text,
  TextField,
} from '@acme/ui';
import { Fingerprint, Mail } from '@acme/ui/icons';
import { Form } from '@acme/ui/primitives';
import { Pressable, View } from '@acme/ui/tw';
import { auth, isPasskeySupported } from './auth';
import { copy, type OnboardingCopyId } from './copy';
import { useOnboarding } from './onboarding.store';
import { OnboardingPanes, PANE_HEADING_CLASS } from './OnboardingPanes';
import { startSaveForNewAccount } from './save-store';
import { useSignInNav } from './sign-in-nav';
import { isSocialProviderSupported, startSocialSignIn, type SocialSignInProvider } from './social-sign-in';

type Mode = 'providers' | 'email' | 'verify' | 'reset' | 'reset_sent';
type PendingKind = 'email' | 'passkey' | SocialSignInProvider;

/** Server codes that mean "this Caller has not passed the birth-year gate". */
const AGE_GATE_CODES: ReadonlySet<string> = new Set(['GUARDIAN_CONSENT_REQUIRED', 'INVALID_BIRTH_YEAR', 'BIRTH_YEAR_REQUIRED']);

/** Provider-side codes a web redirect returns when the Caller closed the provider's page. */
const SOCIAL_CANCEL_CODES: ReadonlySet<string> = new Set(['access_denied', 'user_cancelled_authorize']);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function errorCopyId(error: AuthError, provider?: SocialSignInProvider): OnboardingCopyId | undefined {
  if (error.status === 0) return 'm03.error.offline';
  if (provider !== undefined && error.status < 500) return socialFailedCopyId(provider);
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

function socialFailedCopyId(provider: SocialSignInProvider): OnboardingCopyId {
  return provider === 'apple' ? 'm03.error.apple.failed' : 'm03.error.google.failed';
}

/**
 * M03 sign-in / create account. The create path is only reachable through
 * the birth-year gate (P1): without a stored answer this redirects to M04.
 * Apple comes first (App Store guideline 4.8), then Google, passkey and
 * email. Apple shows on iOS (native sheet) and web; Android has no Apple
 * sheet, so the row is hidden there. The passkey button renders only when
 * WebAuthn is available, and only in the sign-in intent (create-by-passkey
 * is an open question). A new Apple or Google account needs the M04 answer:
 * without it the server refuses and the Caller is routed to the gate. Every
 * failure maps to a copy-deck id; server text is never shown raw, and a
 * cancelled provider sheet shows nothing.
 */
export function SignInScreen() {
  const {
    intent,
    ageGatePath,
    homePath,
    signInPath,
    legalLinks,
    openLink,
    replace,
    back,
    inlineBack,
    socialReturn,
    socialURLs,
  } = useSignInNav();
  const ageAnswer = useOnboarding((s) => s.ageAnswer);
  const setSession = useOnboarding((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('providers');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingCopy, setPendingCopy] = useState<string | undefined>();
  const [pendingKind, setPendingKind] = useState<PendingKind | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [resent, setResent] = useState(false);
  /** True once the Caller starts another attempt; hides a web return error. */
  const [acted, setActed] = useState(false);
  const pending = pendingCopy !== undefined;

  useEffect(() => {
    if (intent === 'create' && ageAnswer === undefined) replace(ageGatePath);
  }, [intent, ageAnswer, replace, ageGatePath]);

  const fail = (raw: AuthError, provider?: SocialSignInProvider) => {
    setPendingCopy(undefined);
    setPendingKind(undefined);
    // Age-gate codes never surface their server text (m03.error.needs_age):
    // route to the gate silently. BIRTH_YEAR_REQUIRED is a new Apple or
    // Google identity with no M04 answer yet.
    if (raw.code !== undefined && AGE_GATE_CODES.has(raw.code)) {
      replace(ageGatePath);
      return;
    }
    setError(copy(errorCopyId(raw, provider) ?? 'm03.error.server'));
  };

  // The same landing as every other method. No server restore yet (Phase 3):
  // a signed-in device with no save would boot to `restore` and land back
  // here, so the local save starts, as sign-up does. It never touches an
  // existing save.
  const completeSignIn = () => {
    startSaveForNewAccount(Date.now());
    setSession(true);
    replace(homePath);
  };

  const signIn = async (kind: 'email' | 'passkey') => {
    setActed(true);
    setError(undefined);
    setPendingKind(kind);
    setPendingCopy(copy(kind === 'passkey' ? 'm03.provider.passkey.loading' : 'm03.email.loading'));
    const result =
      kind === 'passkey'
        ? await auth().signIn({ method: 'passkey' })
        : await auth().signIn({ method: 'email', email, password });
    if (!result.ok) {
      fail(result.error);
      return;
    }
    completeSignIn();
  };

  const signInSocial = async (provider: SocialSignInProvider) => {
    setActed(true);
    setError(undefined);
    setPendingKind(provider);
    setPendingCopy(copy(provider === 'apple' ? 'm03.provider.apple.loading' : 'm03.provider.google.loading'));
    const outcome = await startSocialSignIn(provider, {
      // Sent on both intents: a returning Caller ignores it, and a sign-in
      // that would create an account can only do so with the M04 answer.
      birthYear: ageAnswer?.birthYear,
      ...socialURLs(provider),
    });
    switch (outcome.kind) {
      case 'signed_in':
        completeSignIn();
        return;
      case 'redirecting':
        return; // web: the page is leaving for the provider
      case 'cancelled':
        setPendingCopy(undefined);
        setPendingKind(undefined);
        return;
      case 'failed':
        if (outcome.error !== undefined) {
          fail(outcome.error, provider);
          return;
        }
        setPendingCopy(undefined);
        setPendingKind(undefined);
        setError(copy(socialFailedCopyId(provider)));
        return;
      default: {
        const unreachable: never = outcome;
        return unreachable;
      }
    }
  };

  // Web: a failed round trip's message, derived from the URL until the Caller tries again.
  const returnCode = socialReturn?.error;
  const returnError =
    socialReturn !== undefined &&
    !acted &&
    returnCode !== undefined &&
    !SOCIAL_CANCEL_CODES.has(returnCode) &&
    !AGE_GATE_CODES.has(returnCode)
      ? copy(socialFailedCopyId(socialReturn.provider))
      : undefined;
  const shownError = error ?? returnError;

  // Web: the provider round trip came back to this screen.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (socialReturn === undefined || handledReturn.current) return;
    handledReturn.current = true;
    const code = socialReturn.error;
    if (code === undefined) {
      completeSignIn();
      return;
    }
    if (AGE_GATE_CODES.has(code)) replace(ageGatePath);
    // Any other code is shown as `returnError` below.
    // completeSignIn and the store setters are stable for this screen's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialReturn, replace, ageGatePath]);

  const submitEmail = async () => {
    setActed(true);
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
      setPendingKind('email');
      setPendingCopy(copy('m03.email.loading.create'));
      const result = await auth().signUp({
        email,
        password,
        name: email.split('@')[0] ?? email,
        birthYear: ageAnswer.birthYear,
      });
      setPendingCopy(undefined);
      setPendingKind(undefined);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      startSaveForNewAccount(Date.now());
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
    <KeyboardAwareScroll contentContainerClassName="grow">
      <OnboardingPanes
        tightTop
        stacked
        intro={
          <View className="gap-6">
            {/* M03's ‹ (03-direction). In the app it lives in the native stack
                header's left slot (apps/mobile/app/(auth)/sign-in.tsx); on web,
                which has no stack header, it is the screen's first row. */}
            {inlineBack ? (
              <View className="-ml-2 flex-row items-center" testID="m03-back">
                <BackButton label={copy('m03.back.a11y.label')} onPress={back} />
              </View>
            ) : null}
            <View className="gap-2">
              <Heading level={1} size="title" className={PANE_HEADING_CLASS}>{title}</Heading>
              {mode === 'providers' || mode === 'email' ? (
                <>
                  <Text>{copy(intent === 'create' ? 'm03.subtitle.create' : 'm03.subtitle.sign_in')}</Text>
                  <View className="self-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      tone="royal"
                      title={copy(intent === 'create' ? 'm03.switch.to_sign_in' : 'm03.switch.to_create')}
                      disabled={pending}
                      onPress={() => replace(intent === 'create' ? signInPath : ageGatePath)}
                    />
                  </View>
                </>
              ) : null}
            </View>
          </View>
        }
      >
        <Form className="flex-1 gap-6">
          {shownError !== undefined ? <ErrorMessage message={shownError} /> : null}
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
            <View className="gap-3">
              {isSocialProviderSupported('apple') ? (
                <AuthProviderButton
                  provider="apple"
                  intent={intent === 'create' ? 'create' : 'sign-in'}
                  label={copy(intent === 'create' ? 'm03.provider.apple.label.create' : 'm03.provider.apple.label.sign_in')}
                  loading={pending && pendingKind === 'apple'}
                  disabled={pending}
                  onPress={() => void signInSocial('apple')}
                />
              ) : null}
              {isSocialProviderSupported('google') ? (
                <AuthProviderButton
                  provider="google"
                  intent={intent === 'create' ? 'create' : 'sign-in'}
                  label={copy(intent === 'create' ? 'm03.provider.google.label.create' : 'm03.provider.google.label.sign_in')}
                  loading={pending && pendingKind === 'google'}
                  disabled={pending}
                  onPress={() => void signInSocial('google')}
                />
              ) : null}
              {intent === 'sign_in' && isPasskeySupported() ? (
                <AuthProviderButton
                  provider="passkey"
                  intent="sign-in"
                  label={copy('m03.provider.passkey.label.sign_in')}
                  icon={<Fingerprint className="size-5 text-text" />}
                  loading={pending && pendingKind === 'passkey'}
                  disabled={pending}
                  onPress={() => void signIn('passkey')}
                />
              ) : null}
              <AuthProviderButton
                provider="email"
                intent={intent === 'create' ? 'create' : 'sign-in'}
                label={copy('m03.provider.email.label')}
                icon={<Mail className="size-5 text-text" />}
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

          {legalLinks.length > 0 ? (
            <View className="mt-auto flex-row items-center justify-center gap-x-1 pb-2 pt-6">
              {legalLinks.map((link, i) => (
                <View key={link.id} className="flex-row items-center gap-x-1">
                  {i > 0 ? (
                    <Text variant="caption" className="text-text-muted" aria-hidden>
                      {'·'}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => openLink(link.href)}
                    className="px-2 py-1"
                    role="link"
                  >
                    <Text variant="caption" className="text-royal-600 underline">
                      {copy(`m03.legal.${link.id}` as OnboardingCopyId)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Form>
      </OnboardingPanes>
    </KeyboardAwareScroll>
  );
}
