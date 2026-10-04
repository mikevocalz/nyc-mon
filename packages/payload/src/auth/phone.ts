// Phone numbers and the COPPA phone gate (ADR 0004 §4 and §6; DECISIONS #19, #21).
import { isConsentRequired } from '@acme/core/sim';
import { parseBirthYear } from './age';

/** Countries SMS may go to. Both share NANP country code +1 (DECISIONS #19). */
export const SUPPORTED_SMS_COUNTRIES = ['US', 'CA'] as const;

/** One of {@link SUPPORTED_SMS_COUNTRIES}. */
export type SmsCountry = (typeof SUPPORTED_SMS_COUNTRIES)[number];

/**
 * `+1` area codes that belong to other NANP countries (Caribbean and Atlantic
 * members). They look domestic but bill internationally, which makes them the
 * usual SMS-pumping target. US territories (340, 670, 671, 684, 787, 939) are
 * the US and stay allowed.
 * Source: NANPA area code assignments, https://nationalnanpa.com/area_codes/index.html
 */
const NON_US_CA_NANP_AREA_CODES = new Set([
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664',
  '721', '758', '767', '784', '809', '829', '849', '868', '869', '876',
]);

/** Premium-rate (900) and toll-free codes; neither receives SMS from us. */
const BLOCKED_SERVICE_AREA_CODES = new Set(['900', '800', '833', '844', '855', '866', '877', '888']);

const NANP_E164 = /^\+1([2-9]\d{2})([2-9]\d{2})(\d{4})$/;

/**
 * True when `e164` is a US or Canadian number SMS may go to. Only `US` and
 * `CA` exist today, and both live on +1, so `countries` only switches SMS
 * off entirely when it lists neither.
 */
export function isAllowedSmsNumber(e164: string, countries: readonly SmsCountry[]): boolean {
  if (countries.length === 0) return false;
  const match = NANP_E164.exec(e164);
  if (match === null) return false;
  const areaCode = match[1];
  if (areaCode === undefined) return false;
  // N11 codes (211, 311 … 911) are service codes, never area codes.
  if (areaCode[1] === '1' && areaCode[2] === '1') return false;
  if (NON_US_CA_NANP_AREA_CODES.has(areaCode)) return false;
  if (BLOCKED_SERVICE_AREA_CODES.has(areaCode)) return false;
  return true;
}

/** Narrows a comma-separated env value to the supported countries. */
export function parseSmsCountries(raw: string | undefined): SmsCountry[] {
  if (raw === undefined) return [...SUPPORTED_SMS_COUNTRIES];
  return raw
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is SmsCountry => (SUPPORTED_SMS_COUNTRIES as readonly string[]).includes(entry));
}

/** The user fields the phone gate reads. */
export interface PhoneGateSubject {
  birthYear?: unknown;
  consentStatus?: unknown;
  phoneConsentAt?: unknown;
}

/**
 * The phone gate (ADR 0004 §4). Phone verification and SMS codes are allowed
 * only when the birth year is known and outside the consent range, and the
 * account either never needed consent or a guardian approved phone use again
 * after the Caller turned 13 (DECISIONS #21). Anything unknown fails.
 */
export function passesPhoneGate(user: PhoneGateSubject, nowMs: number): boolean {
  const currentYear = new Date(nowMs).getUTCFullYear();
  const birthYear = parseBirthYear(user.birthYear, currentYear);
  if (birthYear === undefined) return false;
  if (isConsentRequired({ birthYear, nowMs })) return false;
  switch (user.consentStatus) {
    case 'not-required':
      return true;
    case 'approved':
      return user.phoneConsentAt !== undefined && user.phoneConsentAt !== null && user.phoneConsentAt !== '';
    default:
      return false;
  }
}
