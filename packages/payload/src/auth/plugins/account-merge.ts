// Joining two Caller accounts (ADR 0004 §3; DECISIONS #18).
//
// Better Auth links providers to one user but has no way to join two users,
// so this plugin does it: a code started on account A, claimed by a fresh
// sign-in on account B, confirmed again on A, then one Payload transaction
// that moves everything B owns to the survivor. A Mon is never duplicated or
// deleted (Laws 6 and 8): eggs and Mons keep their ids and only change owner.
// Both starters stay, and Home asks which one is active (DECISIONS #18).
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import type { CollectionSlug, Payload, PayloadRequest } from 'payload';
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload';
import * as z from 'zod';
import type { SendAuthMail } from '../email';
import { accountsMergedMail } from '../templates';
import { assertFreshSession } from './fresh';
import {
  checkMergeEligibility,
  MERGE_CODE_ALPHABET,
  MERGE_CODE_LENGTH,
  type MergeCandidate,
  type MergeRefusal,
  normaliseMergeCode,
  planAccounts,
  survivingBirthYear,
} from './merge-rules';

const MERGE_TTL_MS = 10 * 60 * 1000;
const IDENTIFIER_PREFIX = 'merge:';

/** Collections whose rows carry a Caller's `callerId` and move on merge. Eggs before Mons: the Mon hook checks its egg's owner. */
const OWNED_COLLECTIONS = ['eggs', 'mon-instances'] as const;

const MergeStateSchema = z.object({
  starterId: z.string(),
  survivor: z.enum(['starter', 'claimer']),
  claimerId: z.string().nullable(),
});
type MergeState = z.infer<typeof MergeStateSchema>;

function randomMergeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(MERGE_CODE_LENGTH));
  return Array.from(bytes, (byte) => MERGE_CODE_ALPHABET[byte % MERGE_CODE_ALPHABET.length]).join('');
}

function refuse(code: MergeRefusal | 'MERGE_CODE_INVALID', message: string): APIError {
  return APIError.from(code === 'MERGE_CODE_INVALID' ? 'BAD_REQUEST' : 'FORBIDDEN', { code, message });
}

const REFUSAL_MESSAGES: Record<MergeRefusal, string> = {
  MERGE_SAME_ACCOUNT: 'Sign in with your other account to claim this code.',
  MERGE_CONSENT_ACCOUNT: 'Accounts set up with a parent or guardian can’t be joined here. Contact support.',
  MERGE_BIRTH_YEAR_MISMATCH: 'These accounts have different birth years, so they can’t be joined. Contact support.',
  MERGE_PROVIDER_CONFLICT: 'Both accounts use the same sign-in service. Remove it from one account first.',
};

function toCandidate(doc: Record<string, unknown>): MergeCandidate {
  return {
    id: String(doc.id),
    birthYear: typeof doc.birthYear === 'number' ? doc.birthYear : null,
    consentStatus: typeof doc.consentStatus === 'string' ? doc.consentStatus : null,
  };
}

/** What moved, for the confirm response and the notice email. */
export interface MergeResult {
  survivorId: string;
  mergedId: string;
  monInstanceIds: string[];
  eggIds: string[];
  movedAccounts: number;
  movedPasskeys: number;
}

async function findAll(payload: Payload, req: PayloadRequest, collection: CollectionSlug, field: string, value: string) {
  const { docs } = await payload.find({
    collection,
    where: { [field]: { equals: value } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return docs as unknown as Record<string, unknown>[];
}

function idOf(doc: Record<string, unknown>): string {
  return String(doc.id);
}

/**
 * Moves everything `mergedId` owns to `survivorId` in one transaction, then
 * deletes the merged user. Exported for tests against a live Payload.
 */
export async function transferAccount(payload: Payload, survivorId: string, mergedId: string): Promise<MergeResult> {
  const survivorDoc = (await payload.findByID({ collection: 'users', id: survivorId, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
  const req = await createLocalReq({ user: { ...survivorDoc, collection: 'users' } as never }, payload);
  const ownTransaction = await initTransaction(req);
  try {
    const mergedDoc = (await payload.findByID({ collection: 'users', id: mergedId, depth: 0, overrideAccess: true, req })) as unknown as Record<string, unknown>;
    const survivor = toCandidate(survivorDoc);
    const merged = toCandidate(mergedDoc);
    const refusal = checkMergeEligibility(survivor, merged);
    if (refusal !== undefined) throw refuse(refusal, REFUSAL_MESSAGES[refusal]);

    const survivorAccounts = await findAll(payload, req, 'accounts', 'user', survivorId);
    const mergedAccounts = await findAll(payload, req, 'accounts', 'user', mergedId);
    const plan = planAccounts(
      survivorAccounts.map((row) => ({ id: idOf(row), providerId: String(row.providerId) })),
      mergedAccounts.map((row) => ({ id: idOf(row), providerId: String(row.providerId) })),
    );
    if (plan.conflicts.length > 0) throw refuse('MERGE_PROVIDER_CONFLICT', REFUSAL_MESSAGES.MERGE_PROVIDER_CONFLICT);

    for (const id of plan.move) {
      await payload.update({ collection: 'accounts', id, data: { user: Number(survivorId) }, overrideAccess: true, req });
    }
    for (const id of plan.drop) {
      await payload.delete({ collection: 'accounts', id, overrideAccess: true, req });
    }

    const passkeys = payload.collections.passkeys === undefined ? [] : await findAll(payload, req, 'passkeys', 'user', mergedId);
    for (const row of passkeys) {
      await payload.update({ collection: 'passkeys', id: idOf(row), data: { user: Number(survivorId) }, overrideAccess: true, req });
    }
    if (payload.collections.twoFactors !== undefined) {
      // The survivor keeps its own second factor; the merged one's secret goes.
      await payload.delete({ collection: 'twoFactors', where: { user: { equals: mergedId } }, overrideAccess: true, req });
    }
    await payload.delete({ collection: 'sessions', where: { user: { equals: mergedId } }, overrideAccess: true, req });

    const moved: Record<(typeof OWNED_COLLECTIONS)[number], string[]> = { eggs: [], 'mon-instances': [] };
    for (const collection of OWNED_COLLECTIONS) {
      if (payload.collections[collection] === undefined) continue;
      const rows = await findAll(payload, req, collection, 'callerId', mergedId);
      for (const row of rows) {
        // Owner only. Ids, care and history stay as they are (Laws 6 and 8).
        await payload.update({ collection, id: idOf(row), data: { callerId: survivorId }, overrideAccess: true, req });
        moved[collection].push(String(collection === 'eggs' ? row.eggId : row.monInstanceId));
      }
    }

    const survivorMons = payload.collections['mon-instances'] === undefined ? [] : await findAll(payload, req, 'mon-instances', 'callerId', survivorId);
    const birthYear = survivingBirthYear(survivor, merged);
    await payload.update({
      collection: 'users',
      id: survivorId,
      data: {
        ...(birthYear === undefined ? {} : { birthYear }),
        // Two or more Mons after a merge: Home asks which one is active (DECISIONS #18).
        ...(survivorMons.length > 1 ? { activeMonInstanceId: null } : {}),
      },
      overrideAccess: true,
      req,
    });
    await payload.delete({ collection: 'users', id: mergedId, overrideAccess: true, req });

    if (ownTransaction) await commitTransaction(req);
    return {
      survivorId,
      mergedId,
      monInstanceIds: moved['mon-instances'],
      eggIds: moved.eggs,
      movedAccounts: plan.move.length,
      movedPasskeys: passkeys.length,
    };
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    throw error;
  }
}

/** Options for {@link accountMerge}. */
export interface AccountMergeOptions {
  payload: Payload;
  /** Sends the notice to both addresses; `undefined` skips it (logged). */
  sendMail: SendAuthMail | undefined;
}

export function accountMerge({ payload, sendMail }: AccountMergeOptions) {
  async function readState(ctx: { context: { internalAdapter: { findVerificationValue: (id: string) => Promise<{ value: string; expiresAt: Date } | null> } } }, code: string) {
    const row = await ctx.context.internalAdapter.findVerificationValue(`${IDENTIFIER_PREFIX}${code}`);
    if (!row || row.expiresAt < new Date()) throw refuse('MERGE_CODE_INVALID', 'This code has expired. Start again.');
    const parsed = MergeStateSchema.safeParse(JSON.parse(row.value));
    if (!parsed.success) throw refuse('MERGE_CODE_INVALID', 'This code has expired. Start again.');
    return parsed.data;
  }

  return {
    id: 'nycmon-account-merge',
    endpoints: {
      /** POST `/merge/start` — account A opens a merge and gets a code. */
      startAccountMerge: createAuthEndpoint(
        '/merge/start',
        {
          method: 'POST',
          use: [sessionMiddleware],
          body: z.object({ survivor: z.enum(['this-account', 'other-account']) }),
        },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          assertFreshSession(session);
          const code = randomMergeCode();
          const state: MergeState = {
            starterId: String(user.id),
            survivor: ctx.body.survivor === 'this-account' ? 'starter' : 'claimer',
            claimerId: null,
          };
          const expiresAt = new Date(Date.now() + MERGE_TTL_MS);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${IDENTIFIER_PREFIX}${code}`,
            value: JSON.stringify(state),
            expiresAt,
          });
          return ctx.json({ code, expiresAt: expiresAt.toISOString() });
        },
      ),
      /** POST `/merge/claim` — account B, freshly signed in, claims the code and sees what will move. */
      claimAccountMerge: createAuthEndpoint(
        '/merge/claim',
        { method: 'POST', use: [sessionMiddleware], body: z.object({ code: z.string().min(1).max(32) }) },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          assertFreshSession(session);
          const code = normaliseMergeCode(ctx.body.code);
          const state = await readState(ctx, code);
          if (state.claimerId !== null && state.claimerId !== String(user.id)) {
            throw refuse('MERGE_CODE_INVALID', 'This code has already been used.');
          }
          const starter = (await payload.findByID({ collection: 'users', id: state.starterId, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
          const claimer = (await payload.findByID({ collection: 'users', id: String(user.id), depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
          const refusal = checkMergeEligibility(toCandidate(starter), toCandidate(claimer));
          if (refusal !== undefined) throw refuse(refusal, REFUSAL_MESSAGES[refusal]);
          await ctx.context.internalAdapter.updateVerificationByIdentifier(`${IDENTIFIER_PREFIX}${code}`, {
            value: JSON.stringify({ ...state, claimerId: String(user.id) } satisfies MergeState),
          });
          const mergedId = state.survivor === 'starter' ? String(user.id) : state.starterId;
          const mons = payload.collections['mon-instances'] === undefined ? 0 : (await payload.count({ collection: 'mon-instances', where: { callerId: { equals: mergedId } }, overrideAccess: true })).totalDocs;
          const eggs = payload.collections.eggs === undefined ? 0 : (await payload.count({ collection: 'eggs', where: { callerId: { equals: mergedId }, hatched: { equals: false } }, overrideAccess: true })).totalDocs;
          const methods = (await payload.count({ collection: 'accounts', where: { user: { equals: mergedId } }, overrideAccess: true })).totalDocs;
          return ctx.json({ moves: { mons, eggs, signInMethods: methods }, survivor: state.survivor === 'starter' ? 'other-account' : 'this-account' });
        },
      ),
      /** POST `/merge/confirm` — account A confirms; everything moves in one transaction. */
      confirmAccountMerge: createAuthEndpoint(
        '/merge/confirm',
        { method: 'POST', use: [sessionMiddleware], body: z.object({ code: z.string().min(1).max(32) }) },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          assertFreshSession(session);
          const code = normaliseMergeCode(ctx.body.code);
          const state = await readState(ctx, code);
          if (state.starterId !== String(user.id)) throw refuse('MERGE_CODE_INVALID', 'Confirm on the account that started this.');
          if (state.claimerId === null) throw refuse('MERGE_CODE_INVALID', 'Sign in with your other account and enter the code first.');
          // Single use: whoever consumes the row first runs the merge.
          const consumed = await ctx.context.internalAdapter.consumeVerificationValue(`${IDENTIFIER_PREFIX}${code}`);
          if (!consumed) throw refuse('MERGE_CODE_INVALID', 'This code has already been used.');
          const survivorId = state.survivor === 'starter' ? state.starterId : state.claimerId;
          const mergedId = state.survivor === 'starter' ? state.claimerId : state.starterId;
          const emails = await Promise.all(
            [survivorId, mergedId].map(async (id) => {
              const doc = (await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
              return typeof doc.email === 'string' ? doc.email : undefined;
            }),
          );
          const result = await transferAccount(payload, survivorId, mergedId);
          const notice = accountsMergedMail(result.monInstanceIds.length);
          if (sendMail === undefined) {
            ctx.context.logger.warn('[auth] account merge notice skipped: no mail sender');
          } else {
            for (const to of new Set(emails.filter((email): email is string => email !== undefined))) {
              ctx.context.runInBackground(sendMail({ to, ...notice }).catch((error: unknown) => {
                ctx.context.logger.error('[auth] account merge notice failed', error);
              }));
            }
          }
          return ctx.json(result);
        },
      ),
    },
    rateLimit: [{ pathMatcher: (path: string) => path.startsWith('/merge/'), window: 60, max: 5 }],
  } satisfies BetterAuthPlugin;
}
