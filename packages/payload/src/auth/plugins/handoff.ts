// Phone → tablet handoff (ADR 0004 §9; DECISIONS #20).
//
// Better Auth's `/one-time-token/verify` signs the second device into the
// *same* session the token was minted from (`one-time-token/index.mjs`,
// lines 78–86 in better-auth 1.7.7), so the devices list would show one entry
// and revoking the tablet would sign the phone out. This plugin redeems the
// token into a new session instead; `options.ts` disables the stock verify path.
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import { isSurface, type Surface } from '../surface';

/** The prefix the one-time-token plugin stores its tokens under. */
const OTT_IDENTIFIER_PREFIX = 'one-time-token:';

/** SHA-256, base64url without padding. The OTT plugin's `custom-hasher` and the redeem step share it. */
export async function hashHandoffToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('base64url');
}

/** Surfaces a handoff may sign in; a handoff never creates an admin session. */
const HANDOFF_SURFACES = ['tablet', 'phone', 'web'] as const satisfies readonly Surface[];

const redeemBody = z.object({
  token: z.string().min(16).max(256),
  surface: z.enum(HANDOFF_SURFACES),
});

export function handoff() {
  return {
    id: 'nycmon-handoff',
    endpoints: {
      /**
       * POST `/handoff/redeem` — consumes a one-time token minted on the phone
       * and signs this device in with its own session.
       */
      redeemHandoffToken: createAuthEndpoint(
        '/handoff/redeem',
        { method: 'POST', body: redeemBody },
        async (ctx) => {
          const { token, surface } = ctx.body;
          const stored = await hashHandoffToken(token);
          // Single use: the row is deleted as it is read.
          const verification = await ctx.context.internalAdapter.consumeVerificationValue(
            `${OTT_IDENTIFIER_PREFIX}${stored}`,
          );
          if (!verification || verification.expiresAt < new Date()) {
            throw APIError.from('BAD_REQUEST', { code: 'INVALID_HANDOFF_TOKEN', message: 'This code has expired.' });
          }
          const source = await ctx.context.internalAdapter.findSession(verification.value);
          if (!source || source.session.expiresAt < new Date()) {
            throw APIError.from('BAD_REQUEST', { code: 'INVALID_HANDOFF_TOKEN', message: 'This code has expired.' });
          }
          if (!isSurface(surface)) {
            throw APIError.from('BAD_REQUEST', { code: 'INVALID_SURFACE', message: 'Unknown surface.' });
          }
          const session = await ctx.context.internalAdapter.createSession(source.user.id, false, { surface });
          if (!session) {
            throw APIError.from('INTERNAL_SERVER_ERROR', { code: 'FAILED_TO_CREATE_SESSION', message: 'Try again.' });
          }
          await setSessionCookie(ctx, { session, user: source.user });
          return ctx.json({ token: session.token, user: { id: source.user.id } });
        },
      ),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === '/handoff/redeem', window: 60, max: 10 }],
  } satisfies BetterAuthPlugin;
}
