import { isConsentRequired } from '@acme/core/sim';
import { getPayload } from 'payload';
import config from '../../payload.config.ts';
import { sendMail } from '../../auth/options.ts';
import { guardianConsentMail } from '../../auth/templates.ts';
import { CONSENT_RETENTION_DAYS } from './features.ts';

interface ParsedBody {
  parentEmail: string;
  birthYear: number;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@') && value.length <= 254;
}

function parseBody(body: unknown): ParsedBody | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be an object.' };
  }
  const record = body as Record<string, unknown>;
  const parentEmail = record.parentEmail;
  const birthYear = record.birthYear;
  if (!isValidEmail(parentEmail)) {
    return { error: 'parentEmail must be a valid email address.' };
  }
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) {
    return { error: 'birthYear must be an integer.' };
  }
  return { parentEmail: parentEmail.trim(), birthYear };
}

/**
 * Handles `POST /v1/guardian-consents` from the mobile app. Creates a pending
 * guardian-consent record, sends the parent email when a mailer is configured,
 * and returns the record id and expiry.
 *
 * The caller is anonymous: no account exists yet for an under-13 child.
 */
export async function handleCreateGuardianConsent(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { parentEmail, birthYear } = parsed;
  const nowMs = Date.now();
  const currentYear = new Date(nowMs).getUTCFullYear();
  if (birthYear < 1900 || birthYear > currentYear) {
    return Response.json({ error: 'birthYear is not a plausible year.' }, { status: 400 });
  }
  if (!isConsentRequired({ birthYear, nowMs })) {
    return Response.json({ error: 'This birth year does not need guardian consent.' }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const expiresAt = new Date(nowMs + CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const consent = await payload.create({
    collection: 'guardian-consents',
    data: {
      parentEmail,
      birthYear,
      status: 'pending',
      expiresAt,
      emailsSent: 0,
      parentRequest: 'none',
    },
    overrideAccess: true,
  });

  const consentId = (consent as unknown as Record<string, unknown>).id;
  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:5174';

  if (sendMail !== undefined) {
    try {
      await sendMail({
        to: parentEmail,
        ...guardianConsentMail(Number(consentId), CONSENT_RETENTION_DAYS, baseURL),
      });
      await payload.update({
        collection: 'guardian-consents',
        id: consentId as string | number,
        data: { emailsSent: 1, lastEmailSentAt: new Date().toISOString() },
        overrideAccess: true,
      });
    } catch (error) {
      payload.logger.error({ err: error }, '[guardian-consent] failed to send parent email');
    }
  } else {
    payload.logger.warn('[guardian-consent] no mail sender configured; consent record created but email not sent');
  }

  return Response.json({
    id: consentId,
    status: 'pending',
    expiresAt,
  });
}
