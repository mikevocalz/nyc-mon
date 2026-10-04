// Daily SMS caps (ADR 0004 §6). Paid SMS draws "SMS pumping" fraud, so on top
// of Better Auth's per-IP rate limit each number and each Caller gets a small
// daily budget, counted in the verification table so it holds across
// serverless instances.
import { APIError } from 'better-auth/api';

export const MAX_SMS_PER_NUMBER_PER_DAY = 5;
export const MAX_SMS_PER_USER_PER_DAY = 10;

/** The verification-table calls the counter needs. */
export interface QuotaStore {
  findVerificationValue(identifier: string): Promise<{ value: string } | null>;
  createVerificationValue(data: { identifier: string; value: string; expiresAt: Date }): Promise<unknown>;
  updateVerificationByIdentifier(identifier: string, data: { value: string }): Promise<unknown>;
}

function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Counts one send against `key` for today, or throws 429 `SMS_LIMIT_REACHED`
 * when the day's budget is spent. Not atomic across concurrent requests; the
 * per-IP rate limit bounds the overshoot to a request or two.
 */
export async function consumeSmsQuota(store: QuotaStore, key: string, max: number, nowMs: number = Date.now()): Promise<void> {
  const identifier = `sms-quota:${key}:${utcDay(nowMs)}`;
  const existing = await store.findVerificationValue(identifier);
  const used = existing === null ? 0 : Number.parseInt(existing.value, 10) || 0;
  if (used >= max) {
    throw APIError.from('TOO_MANY_REQUESTS', {
      code: 'SMS_LIMIT_REACHED',
      message: 'Too many codes today. Try again tomorrow or use another way to sign in.',
    });
  }
  if (existing === null) {
    await store.createVerificationValue({ identifier, value: '1', expiresAt: new Date(nowMs + 2 * 86_400_000) });
  } else {
    await store.updateVerificationByIdentifier(identifier, { value: String(used + 1) });
  }
}
