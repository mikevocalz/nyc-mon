// Age gate for Apple and Google sign-ups (ADR 0001, §1.5). An identity from
// either provider carries no birth year, so a new account is only created
// when the client sends the answer the Caller gave on M04. The same
// under-13 rule as email sign-up then applies in `user.create.before`.

/** Social providers that can create an account and therefore need the gate. */
export const AGE_GATED_SOCIAL_PROVIDERS = ['apple', 'google'] as const;

export type AgeGatedSocialProvider = (typeof AGE_GATED_SOCIAL_PROVIDERS)[number];

/** Error code a client maps to "send the Caller to the birth-year gate". */
export const BIRTH_YEAR_REQUIRED = 'BIRTH_YEAR_REQUIRED';

/** Key under `additionalData` (client) and the OAuth server context (state). */
export const SOCIAL_BIRTH_YEAR_KEY = 'birthYear';

export function isAgeGatedSocialProvider(value: unknown): value is AgeGatedSocialProvider {
  return typeof value === 'string' && (AGE_GATED_SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Which social provider, if any, a `user.create` call is coming from.
 * `/sign-in/social` is the ID-token branch (native Apple); `/callback/:id`
 * finishes the redirect flow (web, and Google on native).
 */
export function socialProviderForCreate(
  path: string | undefined,
  body: unknown,
  params: unknown,
): AgeGatedSocialProvider | undefined {
  if (path === undefined) return undefined;
  if (path === '/sign-in/social') {
    const provider = readField(body, 'provider');
    return isAgeGatedSocialProvider(provider) ? provider : undefined;
  }
  if (path.startsWith('/callback/')) {
    const fromParams = readField(params, 'id');
    const id = typeof fromParams === 'string' ? fromParams : path.slice('/callback/'.length);
    return isAgeGatedSocialProvider(id) ? id : undefined;
  }
  return undefined;
}

/** The raw birth year a client attached to a social sign-in, before validation. */
export function birthYearFromAdditionalData(body: unknown): unknown {
  return readField(readField(body, 'additionalData'), SOCIAL_BIRTH_YEAR_KEY);
}

function readField(record: unknown, field: string): unknown {
  return typeof record === 'object' && record !== null && field in record
    ? (record as Record<string, unknown>)[field]
    : undefined;
}
