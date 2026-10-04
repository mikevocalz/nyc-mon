import { passkeyClient } from '@better-auth/passkey/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { AuthResult } from './AuthResult.ts';
import { AUTH_BASE_PATH } from './paths.ts';
import type { SignInRequest } from './SignInRequest.ts';
import type { SignUpRequest } from './SignUpRequest.ts';
import { toAuthResult } from './toAuthResult.ts';

/** Options for {@link createAuth}. */
export interface CreateAuthOptions {
  /** Origin of the NYC-MON web app that serves `/payload-api/auth`, e.g. `https://nycmon.app`. */
  baseURL: string;
}

function buildClient(baseURL: string) {
  return createAuthClient({
    baseURL: `${baseURL}${AUTH_BASE_PATH}`,
    plugins: [
      passkeyClient(),
      inferAdditionalFields({
        user: { birthYear: { type: 'number', required: false } },
      }),
    ],
  });
}

/**
 * The auth surface apps import (ADR 0001). Apps never import Better Auth
 * directly. Every call resolves to an {@link AuthResult}; none throws on an
 * auth failure.
 */
export function createAuth({ baseURL }: CreateAuthOptions) {
  const client = buildClient(baseURL);

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

  return {
    signIn,
    signUp,
    signOut,
    /** React hook: the current session, or `null` when signed out. */
    useSession: client.useSession,
    /** Registers a passkey for the signed-in Caller. */
    addPasskey: async (): Promise<AuthResult> => toAuthResult(await client.passkey.addPasskey()),
  };
}

/** The object {@link createAuth} returns. */
export type Auth = ReturnType<typeof createAuth>;
