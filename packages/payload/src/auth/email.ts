// Transactional email through Resend (DECISIONS #3). One sender for every
// Better Auth mail (ADR 0004 §5); the words live in ./templates.
import { Resend } from 'resend';
import type { AuthEnv } from './env';

export interface AuthMail {
  to: string;
  subject: string;
  text: string;
  /** HTML body. Every template supplies one; `text` is the fallback part. */
  html?: string;
}

export type SendAuthMail = (mail: AuthMail) => Promise<void>;

/**
 * Returns a sender, or `undefined` when Resend is not configured. Callers must
 * treat `undefined` as "this environment cannot send mail" and leave every
 * flow that depends on mail switched off.
 */
export function createAuthMailer(env: Pick<AuthEnv, 'resendApiKey' | 'emailFrom'>): SendAuthMail | undefined {
  const { resendApiKey, emailFrom } = env;
  if (resendApiKey === undefined || emailFrom === undefined) return undefined;

  const resend = new Resend(resendApiKey);

  return async ({ to, subject, text, html }) => {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      text,
      ...(html === undefined ? {} : { html }),
    });
    if (error) {
      throw new Error(`Resend refused the ${subject} mail: ${error.name}: ${error.message}`);
    }
  };
}
