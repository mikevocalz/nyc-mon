import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthRequest, CodeChallengeMethod, exchangeCodeAsync, type DiscoveryDocument } from 'expo-auth-session';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { auth } from './auth';
import type { SocialSignInOptions, SocialSignInOutcome, SocialSignInProvider } from './social-sign-in.types';

export type { SocialSignInOptions, SocialSignInOutcome, SocialSignInProvider } from './social-sign-in.types';

// Android: closes the Custom Tab if the app was cold-started by the redirect.
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth clients of type iOS and Android. They are public identifiers,
 * not secrets; the server lists the same ids as accepted ID-token audiences
 * (GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID).
 */
const GOOGLE_CLIENT_ID =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

/**
 * The bundle id / package scheme. Google accepts it for both client types
 * (Android needs "Custom URI scheme" enabled on the client), and
 * apps/mobile/app.config.ts registers it next to `nycmon`.
 */
export const GOOGLE_REDIRECT_URI = 'com.nycmon.app:/oauthredirect';

const GOOGLE_DISCOVERY: DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Apple's native sheet exists on iOS only. Android has no Apple sheet, and
 * a browser round trip would leave the session cookie in the browser, so
 * the Apple row is hidden there. Google needs this platform's client id.
 */
export function isSocialProviderSupported(provider: SocialSignInProvider): boolean {
  if (provider === 'apple') return Platform.OS === 'ios';
  return (Platform.OS === 'ios' || Platform.OS === 'android') && GOOGLE_CLIENT_ID !== undefined && GOOGLE_CLIENT_ID !== '';
}

function isAppleCancel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
}

/** iOS: the system Sign in with Apple sheet, then Better Auth verifies the ID token. */
async function signInWithApple(birthYear: number | undefined): Promise<SocialSignInOutcome> {
  const nonce = randomUUID();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (error) {
    return isAppleCancel(error) ? { kind: 'cancelled' } : { kind: 'failed' };
  }
  if (credential.identityToken === null) return { kind: 'failed' };
  const given = credential.fullName?.givenName ?? undefined;
  const family = credential.fullName?.familyName ?? undefined;
  const result = await auth().signIn({
    method: 'id-token',
    provider: 'apple',
    token: credential.identityToken,
    nonce,
    ...(given === undefined && family === undefined
      ? {}
      : { name: { ...(given === undefined ? {} : { firstName: given }), ...(family === undefined ? {} : { lastName: family }) } }),
    ...(birthYear === undefined ? {} : { birthYear }),
  });
  return result.ok ? { kind: 'signed_in' } : { kind: 'failed', error: result.error };
}

/**
 * iOS and Android: Google's consent page in the system browser (PKCE, no
 * client secret on the device), the code exchanged here for an ID token,
 * then Better Auth verifies that token.
 */
async function signInWithGoogle(birthYear: number | undefined): Promise<SocialSignInOutcome> {
  if (GOOGLE_CLIENT_ID === undefined || GOOGLE_CLIENT_ID === '') return { kind: 'failed' };
  const nonce = randomUUID();
  const request = new AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    scopes: ['openid', 'email', 'profile'],
    usePKCE: true,
    codeChallengeMethod: CodeChallengeMethod.S256,
    extraParams: { nonce, prompt: 'select_account' },
  });
  let idToken: string | undefined;
  try {
    const response = await request.promptAsync(GOOGLE_DISCOVERY);
    if (response.type === 'cancel' || response.type === 'dismiss') return { kind: 'cancelled' };
    if (response.type !== 'success' || request.codeVerifier === undefined) return { kind: 'failed' };
    const code = response.params.code;
    if (code === undefined) return { kind: 'failed' };
    const tokens = await exchangeCodeAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        code,
        redirectUri: GOOGLE_REDIRECT_URI,
        extraParams: { code_verifier: request.codeVerifier },
      },
      GOOGLE_DISCOVERY,
    );
    idToken = tokens.idToken;
  } catch {
    return { kind: 'failed' };
  }
  if (idToken === undefined) return { kind: 'failed' };
  const result = await auth().signIn({
    method: 'id-token',
    provider: 'google',
    token: idToken,
    nonce,
    ...(birthYear === undefined ? {} : { birthYear }),
  });
  return result.ok ? { kind: 'signed_in' } : { kind: 'failed', error: result.error };
}

/** Native social sign-in. Never throws; the screen branches on the outcome. */
export async function startSocialSignIn(
  provider: SocialSignInProvider,
  { birthYear }: SocialSignInOptions,
): Promise<SocialSignInOutcome> {
  return provider === 'apple' ? signInWithApple(birthYear) : signInWithGoogle(birthYear);
}
