import { passkeyClient } from '@better-auth/passkey/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { AuthResult } from './AuthResult.ts';
import type { AuthDataResult, LinkedAccount } from './LinkedAccount.ts';
import { AUTH_BASE_PATH } from './paths.ts';
import type { SignInRequest, SocialProvider } from './SignInRequest.ts';
import type { SignUpRequest } from './SignUpRequest.ts';
import { toAuthResult } from './toAuthResult.ts';

/** Options for {@link createAuth}. */
export interface CreateAuthOptions {
  /** Origin of apps/admin-vite, the host that serves `/payload-api/auth` (docs/adr/0003-admin-app-split.md). */
  baseURL: string;
  /** Native only: the Origin header to send ({@link APP_ORIGIN}). Browsers set their own. */
  appOrigin?: string;
}

function buildClient(baseURL: string, appOrigin: string | undefined) {
  return createAuthClient({
    baseURL: `${baseURL}${AUTH_BASE_PATH}`,
    ...(appOrigin === undefined ? {} : { fetchOptions: { headers: { origin: appOrigin } } }),
    plugins: [
      passkeyClient(),
      inferAdditionalFields({
        user: { birthYear: { type: 'number', required: false } },
      }),
    ],
  });
}

/**
 * The M04 answer, sent as `additionalData` so the server can create an
 * Apple or Google account (packages/payload/src/auth/social-age.ts).
 */
function birthYearData(birthYear: number | undefined): { additionalData?: { birthYear: number } } {
  return birthYear === undefined ? {} : { additionalData: { birthYear } };
}

/**
 * The auth surface apps import (ADR 0001). Apps never import Better Auth
 * directly. Every call resolves to an {@link AuthResult}; none throws on an
 * auth failure.
 */
export function createAuth({ baseURL, appOrigin }: CreateAuthOptions) {
  const client = buildClient(baseURL, appOrigin);

  async function signIn(request: SignInRequest): Promise<AuthResult> {
    switch (request.method) {
      case 'email':
        return toAuthResult(
          await client.signIn.email({ email: request.email, password: request.password }),
        );
      case 'passkey':
        return toAuthResult(await client.signIn.passkey());
      case 'social':
        return toAuthResult(
          await client.signIn.social({
            provider: request.provider,
            callbackURL: request.callbackURL,
            ...(request.errorCallbackURL === undefined ? {} : { errorCallbackURL: request.errorCallbackURL }),
            ...birthYearData(request.birthYear),
          }),
        );
      case 'id-token':
        return toAuthResult(
          await client.signIn.social({
            provider: request.provider,
            idToken: {
              token: request.token,
              ...(request.nonce === undefined ? {} : { nonce: request.nonce }),
              ...(request.accessToken === undefined ? {} : { accessToken: request.accessToken }),
              ...(request.name === undefined ? {} : { user: { name: request.name } }),
            },
            ...birthYearData(request.birthYear),
          }),
        );
      default: {
        const unreachable: never = request;
        return unreachable;
      }
    }
  }

  async function signUp(request: SignUpRequest): Promise<AuthResult> {
    return toAuthResult(
      await client.signUp.email({
        email: request.email,
        password: request.password,
        name: request.name,
        birthYear: request.birthYear,
        callbackURL: request.callbackURL,
      }),
    );
  }

  async function signOut(): Promise<AuthResult> {
    return toAuthResult(await client.signOut());
  }

  /** Explicitly links a social identity to the already signed-in Caller. */
  async function linkSocial(provider: SocialProvider, callbackURL: string): Promise<AuthResult> {
    return toAuthResult(await client.linkSocial({ provider, callbackURL }));
  }

  /** M03 "Forgot password?": always resolves ok on the client so the answer never reveals whether the email exists. */
  async function requestPasswordReset(email: string): Promise<AuthResult> {
    return toAuthResult(await client.requestPasswordReset({ email }));
  }

  /** M03 verify view: resends the verification mail. Throttled server-side. */
  async function resendVerification(email: string): Promise<AuthResult> {
    return toAuthResult(await client.sendVerificationEmail({ email }));
  }

  /**
   * M20: deletes the signed-in Caller's account (Better Auth `/delete-user`).
   * The server moves their Mons into the sanctuary first. A session older
   * than Better Auth's fresh age (one day) is refused with
   * `SESSION_EXPIRED`; the Caller signs in again and retries.
   */
  async function deleteAccount(): Promise<AuthResult> {
    return toAuthResult(await client.deleteUser({}));
  }

  /**
   * M20: the sign-in methods linked to the signed-in Caller (`/list-accounts`).
   * Dates arrive as strings over JSON; anything without a provider id is dropped.
   */
  async function listAccounts(): Promise<AuthDataResult<LinkedAccount[]>> {
    const response = await client.listAccounts();
    if (response.error !== null) {
      const failed = toAuthResult(response);
      return failed.ok ? { ok: true, data: [] } : failed;
    }
    const rows: unknown[] = Array.isArray(response.data) ? response.data : [];
    const accounts: LinkedAccount[] = [];
    for (const row of rows) {
      if (typeof row !== 'object' || row === null) continue;
      const { id, providerId, createdAt } = row as Record<string, unknown>;
      if (typeof providerId !== 'string') continue;
      accounts.push({
        id: String(id),
        providerId,
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : typeof createdAt === 'string' ? createdAt : undefined,
      });
    }
    return { ok: true, data: accounts };
  }

  /**
   * M20: starts an email change (`/change-email`). The server mails the
   * current address first; the email changes only once the link is opened.
   */
  async function changeEmail(newEmail: string, callbackURL?: string): Promise<AuthResult> {
    return toAuthResult(await client.changeEmail({ newEmail, ...(callbackURL === undefined ? {} : { callbackURL }) }));
  }

  /**
   * M20: changes the password of an email-and-password account
   * (`/change-password`). Other devices are signed out.
   */
  async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    return toAuthResult(await client.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }));
  }

  return {
    signIn,
    signUp,
    signOut,
    deleteAccount,
    listAccounts,
    changeEmail,
    changePassword,
    linkSocial,
    requestPasswordReset,
    resendVerification,
    /** React hook: the current session, or `null` when signed out. */
    useSession: client.useSession,
    /** Registers a passkey for the signed-in Caller. */
    addPasskey: async (): Promise<AuthResult> => toAuthResult(await client.passkey.addPasskey()),
  };
}

/** The object {@link createAuth} returns. */
export type Auth = ReturnType<typeof createAuth>;
