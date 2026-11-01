/** Payload always includes the document ID; explicitly request Better Auth's image field. */
export const CALLER_IDENTITY_SELECT = { image: true } as const;

/** Keep the canonical users.id, not a row number, username or Mon instance ID. */
export function callerIdentity(user: { id: string | number; image?: string | null }) {
  return {
    id: String(user.id),
    image: typeof user.image === 'string' ? user.image : null,
  };
}
