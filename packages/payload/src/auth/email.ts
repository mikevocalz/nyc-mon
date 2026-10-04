// Transactional email through Resend (DECISIONS #3). One sender for
// verification, password reset and guardian-consent mail.
import { Resend } from 'resend';
import type { AuthEnv } from './env';

export interface AuthMail {
  to: string;
  subject: string;
  text: string;
}

export type SendAuthMail = (mail: AuthMail) => Promise<void>;

/**
 * Returns a sender, or `undefined` when Resend is not configured. Callers must
 * treat `undefined` as "this environment cannot send mail" and leave every
 * flow that depends on mail switched off.
 */
export function createAuthMailer(env: AuthEnv): SendAuthMail | undefined {
  const { resendApiKey, emailFrom } = env;
  if (resendApiKey === undefined || emailFrom === undefined) return undefined;

  const resend = new Resend(resendApiKey);

  return async ({ to, subject, text }) => {
    const { error } = await resend.emails.send({ from: emailFrom, to, subject, text });
    if (error) {
      throw new Error(`Resend refused the ${subject} mail: ${error.name}: ${error.message}`);
    }
  };
}
