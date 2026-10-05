import { isConsentRequired } from '@acme/core/sim';
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload';
import type { PayloadRequest } from 'payload';
import config from '../../payload.config.ts';
import { sendMail } from '../../auth/options.ts';
import { escapeHtml, guardianConsentMail } from '../../auth/templates.ts';
import { GUARDIAN_CONSENTS_SLUG } from '../../collections/GuardianConsents.ts';
import {
  applyConsentDecision,
  consentBlock,
  expireConsentRecord,
  findConsentRecord,
  isConsentDecision,
} from './consent-decision.ts';
import { consoleCopy } from './copy.ts';
import { CONSENT_RETENTION_DAYS } from './features.ts';
import { withIdempotency } from './v1/idempotency.ts';

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
 * The caller is anonymous: no account exists yet for an under-13 child, so
 * `withIdempotency` runs with `scope: 'anonymous'` — the Idempotency-Key is
 * scoped by key + path only (ADR 0001 §1.4).
 */
export const handleCreateGuardianConsent = withIdempotency(createGuardianConsent, {
  scope: 'anonymous',
});

async function createGuardianConsent(request: Request): Promise<Response> {
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

// --- The parent's answer ---------------------------------------------------

const decisionCopy = consoleCopy.decision;

const DECISION_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  // An email answer link is single-use: never cached, never indexed.
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

/**
 * The page a parent lands on after answering the consent email. Same visual
 * language as the mail (`templates.ts` render): one centered column, the
 * wordmark, a heading and a paragraph — no scripts, no styling imports.
 */
function decisionPage(status: number, heading: string, body: string): Response {
  const html = [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>',
    `<title>${escapeHtml(heading)} · NYC-MON</title>`,
    '</head><body style="margin:0;padding:24px;font-family:system-ui,sans-serif;color:#111;background:#fff">',
    '<main style="max-width:480px;margin:0 auto;padding-top:96px">',
    '<p style="font-weight:700;letter-spacing:.04em">NYC-MON</p>',
    `<h1 style="font-size:22px;line-height:1.35;margin:24px 0 12px">${escapeHtml(heading)}</h1>`,
    `<p style="line-height:1.5">${escapeHtml(body)}</p>`,
    '</main></body></html>',
  ].join('');
  return new Response(html, { status, headers: DECISION_HEADERS });
}

/**
 * Handles `GET /guardian-consent/:id?decision=approve|deny` — the yes/no links
 * `guardianConsentMail` writes into the parent email. The caller is anonymous:
 * the URL itself is the capability (the standard contract for email decision
 * links), so the work runs through the local API with `overrideAccess` inside
 * one transaction and every outcome renders a page, never JSON.
 *
 * Approve flips `status` to `approved`. Deny flips it to `denied` and then
 * deletes the record — what the email promises and what `GuardianConsents`
 * documents — leaving `consent.denied` and `consent.deleted` in the audit
 * trail. A link past `expiresAt` is closed out the same way 16 CFR 312.5(c)(1)
 * requires (`expired`, then deleted), and a second click on an answered link
 * gets the "already used" page.
 */
export async function handleGuardianConsentDecision(request: Request, id: string): Promise<Response> {
  const decision = new URL(request.url).searchParams.get('decision');
  if (!isConsentDecision(decision)) {
    return decisionPage(400, decisionCopy.invalid.heading, decisionCopy.invalid.body);
  }
  // Postgres ids are serial integers; anything else can never name a record.
  if (!/^\d+$/.test(id)) {
    return decisionPage(404, decisionCopy.notFound.heading, decisionCopy.notFound.body);
  }

  const payload = await getPayload({ config });
  // Forward the request headers so the audit events keep the request id.
  const req = await createLocalReq({ req: { headers: request.headers } as Partial<PayloadRequest> }, payload);
  const ownTransaction = await initTransaction(req);
  try {
    const consent = await findConsentRecord(payload, req, id);
    if (consent === null) {
      if (ownTransaction) await killTransaction(req);
      return decisionPage(404, decisionCopy.notFound.heading, decisionCopy.notFound.body);
    }

    const block = consentBlock(consent);
    if (block === 'not-reviewable') {
      if (ownTransaction) await killTransaction(req);
      return decisionPage(200, decisionCopy.used.heading, decisionCopy.used.body);
    }
    if (block === 'expired') {
      await expireConsentRecord(payload, req, consent);
      if (ownTransaction) await commitTransaction(req);
      return decisionPage(
        410,
        decisionCopy.expired.heading,
        decisionCopy.expired.body.replace('{days}', String(CONSENT_RETENTION_DAYS)),
      );
    }

    await applyConsentDecision(payload, req, consent, decision);
    if (decision === 'deny') {
      await payload.delete({
        collection: GUARDIAN_CONSENTS_SLUG,
        id: consent.id as string | number,
        overrideAccess: true,
        req,
      });
    }
    if (ownTransaction) await commitTransaction(req);

    const answer = decision === 'approve' ? decisionCopy.approved : decisionCopy.denied;
    return decisionPage(200, answer.heading, answer.body);
  } catch (error) {
    if (ownTransaction) await killTransaction(req);
    payload.logger.error({ err: error, consentId: id }, '[guardian-consent] decision failed');
    return decisionPage(500, decisionCopy.error.heading, decisionCopy.error.body);
  }
}
