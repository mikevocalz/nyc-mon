// SMS for phone verification and two-factor codes (ADR 0004 §6).
// AWS SNS in production, a console sender for development. Everything that
// sends SMS goes through `SmsSender`, so tests and local runs never need AWS.
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { AuthEnv, SmsTransport } from './env';

/** One SMS to one E.164 number. */
export interface SmsMessage {
  /** Destination in E.164, e.g. `+12125550123`. */
  toE164: string;
  /** Plain text. Codes only; never a link, a name or a Mon. */
  body: string;
}

/** Sends one SMS. Resolves when the provider accepted it; rejects otherwise. */
export interface SmsSender {
  /** Which transport this sender uses. */
  readonly transport: SmsTransport;
  send(message: SmsMessage): Promise<void>;
}

/** `+12125550123` → `+1••••••0123`, so logs never hold a full number. */
export function maskPhoneNumber(e164: string): string {
  if (e164.length <= 6) return '•••';
  return `${e164.slice(0, 2)}${'•'.repeat(e164.length - 6)}${e164.slice(-4)}`;
}

/** Prints the message to the server log. Development and tests only. */
export function createConsoleSmsSender(
  log: (line: string) => void = (line) => {
    console.info(line);
  },
): SmsSender {
  return {
    transport: 'console',
    send: async ({ toE164, body }) => {
      log(`[sms] to=${maskPhoneNumber(toE164)} body=${JSON.stringify(body)}`);
    },
  };
}

/** Configuration for {@link createSnsSmsSender}. */
export interface SnsSmsConfig {
  region: string;
  /** Registered toll-free or 10DLC number. Optional; SNS picks one when absent. */
  originationNumber: string | undefined;
  /** For tests. Defaults to a client built from `region` and the AWS credential chain. */
  client?: Pick<SNSClient, 'send'>;
}

/**
 * Sends through AWS SNS `Publish` with a phone number target.
 * https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html
 */
export function createSnsSmsSender({ region, originationNumber, client }: SnsSmsConfig): SmsSender {
  // Credentials come from the default chain: AWS_ACCESS_KEY_ID /
  // AWS_SECRET_ACCESS_KEY, or a role from the Vercel AWS integration.
  const sns = client ?? new SNSClient({ region });
  return {
    transport: 'sns',
    send: async ({ toE164, body }) => {
      await sns.send(
        new PublishCommand({
          PhoneNumber: toE164,
          Message: body,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
            ...(originationNumber === undefined
              ? {}
              : { 'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: originationNumber } }),
          },
        }),
      );
    },
  };
}

/**
 * The sender for this environment, or `undefined` when SMS is not configured.
 * `undefined` means the phone-number plugin is not mounted and two-factor
 * codes go by email only.
 *
 * @throws {Error} when the console sender is selected in production, or SNS is
 *   selected without a region. Both fail the boot on purpose.
 */
export function createSmsSender(env: Pick<AuthEnv, 'sms' | 'isProduction'>): SmsSender | undefined {
  const { sms, isProduction } = env;
  if (sms === undefined) return undefined;
  switch (sms.transport) {
    case 'console':
      if (isProduction) {
        throw new Error('AUTH_SMS_TRANSPORT=console prints codes to the log and is refused in production.');
      }
      return createConsoleSmsSender();
    case 'sns':
      if (sms.awsRegion === undefined) {
        throw new Error('AUTH_SMS_TRANSPORT=sns needs AWS_REGION.');
      }
      return createSnsSmsSender({ region: sms.awsRegion, originationNumber: sms.originationNumber });
    default: {
      const unreachable: never = sms.transport;
      return unreachable;
    }
  }
}
