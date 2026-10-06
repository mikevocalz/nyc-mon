// Typed client for the ops console endpoints (08-handoff.md §5). The result
// union mirrors `@acme/auth` so callers handle success and failure in one place.
import { z } from 'zod';
import type { ConsoleErrorCode } from './codes.ts';

export type { ConsoleErrorCode } from './codes.ts';

export type ConsoleResult<T> = { ok: true; data: T } | { ok: false; code: ConsoleErrorCode };

export interface ConsoleApiConfig {
  /** e.g. https://example.com/payload-api */
  baseUrl: string;
  /** Fetch implementation; defaults to global fetch. */
  fetch?: typeof fetch;
}

function endpoint(config: ConsoleApiConfig, path: string): string {
  return `${config.baseUrl}/console${path}`;
}

async function requestJson<T>(
  config: ConsoleApiConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<ConsoleResult<T>> {
  const doFetch = config.fetch ?? fetch;
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
  }
  const res = await doFetch(endpoint(config, path), init);
  const payload: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code =
      typeof payload === 'object' && payload !== null && 'code' in payload && typeof payload.code === 'string'
        ? (payload.code as ConsoleErrorCode)
        : ('UNKNOWN' as ConsoleErrorCode);
    return { ok: false, code };
  }
  return { ok: true, data: payload as T };
}

async function requestText(config: ConsoleApiConfig, path: string): Promise<ConsoleResult<string>> {
  const doFetch = config.fetch ?? fetch;
  const res = await doFetch(endpoint(config, path), {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
  });
  const text = await res.text();
  if (!res.ok) {
    let payload: unknown = {};
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }
    const code =
      typeof payload === 'object' && payload !== null && 'code' in payload && typeof payload.code === 'string'
        ? (payload.code as ConsoleErrorCode)
        : ('UNKNOWN' as ConsoleErrorCode);
    return { ok: false, code };
  }
  return { ok: true, data: text };
}

const RevealResponse = z.object({ value: z.unknown() });
const ScheduledResponse = z.object({ scheduledFor: z.string() });
const SignOutResponse = z.object({ sessionsEnded: z.number() });
const ResendResponse = z.object({ lastEmailSentAt: z.string() });
const DeleteConsentResponse = z.object({ receiptEventId: z.number().nullable() });
const DecideConsentResponse = z.object({ status: z.enum(['approved', 'denied']) });
const IntegrityRunResponse = z.object({ run: z.unknown() });
const StaffUserResponse = z.object({ user: z.unknown() });

function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  return schema.parse(payload);
}

export type RevealInput = {
  targetType: 'caller' | 'consent' | 'mon' | 'egg';
  targetId: string;
  field: string;
  reasonCode: string;
};

export function reveal(config: ConsoleApiConfig, input: RevealInput) {
  return requestJson<z.infer<typeof RevealResponse>>(config, 'POST', '/reveal', input).then((result) =>
    result.ok ? { ok: true as const, data: parse(RevealResponse, result.data) } : result,
  );
}

export type ScheduleDeletionInput = {
  reasonCode: string;
  confirmText: string;
  expectedUpdatedAt?: string;
};

export function scheduleCallerDeletion(config: ConsoleApiConfig, callerId: string, input: ScheduleDeletionInput) {
  return requestJson<z.infer<typeof ScheduledResponse>>(config, 'POST', `/callers/${callerId}/deletion`, input).then(
    (result) => (result.ok ? { ok: true as const, data: parse(ScheduledResponse, result.data) } : result),
  );
}

export function cancelCallerDeletion(config: ConsoleApiConfig, callerId: string, input: { expectedUpdatedAt?: string }) {
  return requestJson<Record<string, never>>(config, 'DELETE', `/callers/${callerId}/deletion`, input);
}

export function signOutCallerEverywhere(config: ConsoleApiConfig, callerId: string, input: { reasonCode: string }) {
  return requestJson<z.infer<typeof SignOutResponse>>(config, 'POST', `/callers/${callerId}/sign-out-everywhere`, input).then(
    (result) => (result.ok ? { ok: true as const, data: parse(SignOutResponse, result.data) } : result),
  );
}

export function resendConsentEmail(config: ConsoleApiConfig, consentId: string) {
  return requestJson<z.infer<typeof ResendResponse>>(config, 'POST', `/consents/${consentId}/resend`, {}).then(
    (result) => (result.ok ? { ok: true as const, data: parse(ResendResponse, result.data) } : result),
  );
}

export function deleteConsentRecord(
  config: ConsoleApiConfig,
  consentId: string,
  input: { reasonCode: string; confirmText: string },
) {
  return requestJson<z.infer<typeof DeleteConsentResponse>>(config, 'DELETE', `/consents/${consentId}`, input).then(
    (result) => (result.ok ? { ok: true as const, data: parse(DeleteConsentResponse, result.data) } : result),
  );
}

export function decideConsent(
  config: ConsoleApiConfig,
  consentId: string,
  input: { decision: 'approve' | 'deny'; reasonCode: string; expectedUpdatedAt?: string },
) {
  return requestJson<z.infer<typeof DecideConsentResponse>>(config, 'POST', `/consents/${consentId}/decision`, input).then(
    (result) => (result.ok ? { ok: true as const, data: parse(DecideConsentResponse, result.data) } : result),
  );
}

export function runIntegrityCheck(config: ConsoleApiConfig) {
  return requestJson<z.infer<typeof IntegrityRunResponse>>(config, 'POST', '/integrity/run').then((result) =>
    result.ok ? { ok: true as const, data: parse(IntegrityRunResponse, result.data) } : result,
  );
}

export type CreateStaffInput = { email: string; role: string };
export type UpdateStaffInput = { role: string };

export function createStaff(config: ConsoleApiConfig, input: CreateStaffInput) {
  return requestJson<z.infer<typeof StaffUserResponse>>(config, 'POST', '/staff', input).then((result) =>
    result.ok ? { ok: true as const, data: parse(StaffUserResponse, result.data) } : result,
  );
}

export function updateStaff(config: ConsoleApiConfig, staffId: string, input: UpdateStaffInput) {
  return requestJson<z.infer<typeof StaffUserResponse>>(config, 'PATCH', `/staff/${staffId}`, input).then((result) =>
    result.ok ? { ok: true as const, data: parse(StaffUserResponse, result.data) } : result,
  );
}

export function removeStaff(config: ConsoleApiConfig, staffId: string, input: { reasonCode: string }) {
  return requestJson<Record<string, never>>(config, 'DELETE', `/staff/${staffId}`, input);
}

export function exportAuditLog(config: ConsoleApiConfig, query?: Record<string, string>) {
  const params = query === undefined ? '' : `?${new URLSearchParams(query).toString()}`;
  return requestText(config, `/audit/export${params}`);
}
