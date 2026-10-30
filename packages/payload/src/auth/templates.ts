// Every Better Auth email (ADR 0004 §5), plus the waitlist confirmation the
// site's sign-up endpoint sends (PS-001). Pure functions: input in, subject,
// HTML and text out. Copy rules: `Caller`, never "user"; no Mon speaks in
// mail; a link is always written out in the text part too.
import type { AuthMail } from './email';

/** A rendered mail without its recipient. */
export type MailContent = Omit<AuthMail, 'to'>;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface Layout {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  code?: string;
  footer?: string;
}

/* Brand tokens, dark scheme, inlined from packages/theme/theme.css (mail
   clients get no CSS import). The mail is the site's night surface: navy
   ground, orange CTA face, square corners, Space Grotesk. */
const NAVY = '#00041C'; // --color-surface, dark
const RAISED = '#0A1230'; // --color-surface-raised, dark
const TEXT = '#F8F8F8'; // --color-text, dark
const MUTED = '#BEC0C2'; // --color-text-muted, dark
const SUBTLE = '#858890'; // silver-700: the legal strip
const LINK = '#DFE0E1'; // silver-300: footer links
const ORANGE = '#FC7C00'; // --color-cta / orange-500
const ON_CTA = '#00041C'; // --color-on-cta, dark
const ORANGE_DEEP = '#A35100'; // orange-700: the CTA's depth edge
const HAIRLINE = '#25293D'; // ink-800: the footer's legal border
const LIT_WINDOW = '#FEBE80'; // orange-300: SkylineBand's lit windows
const ROYAL_SHADES = ['#003FB6', '#003193', '#002470'] as const; // royal-700/800/900
const SANS = "'Space Grotesk', Arial, Helvetica, sans-serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SITE_URL = 'https://nyc-mon.city';
// The site sans over Google Fonts; clients that strip <link> fall back to the
// system sans stack. display=swap so text never waits on the file.
const FONT_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&amp;display=swap">`;

/**
 * One skyline silhouette: height and width as fractions of the strip, the
 * royal shade step (0-2), and a lit window's top/left offsets in percent of
 * the building (t = 0 means unlit). Baked from `skylineProfile` in
 * packages/ui/nav/skyline-profile.ts — the same deterministic rows the site
 * header (midtown) and footer (harlem) draw, flattened so the mail needs no
 * runtime generation.
 */
type Building = readonly [height: number, width: number, shade: 0 | 1 | 2, litTopPct: number, litLeftPct: number];

const MIDTOWN_SKYLINE: readonly Building[] = [
  [0.408, 1.106, 2, 26, 66], [0.467, 1.365, 1, 25, 34], [0.386, 1.434, 0, 65, 41], [0.594, 1.359, 2, 0, 0],
  [0.899, 1.123, 1, 0, 0], [0.637, 1.14, 0, 0, 0], [0.536, 1.471, 0, 0, 0], [0.66, 1.157, 1, 23, 47],
  [0.46, 1.135, 1, 0, 0], [0.817, 1.377, 0, 67, 37], [0.369, 1.064, 2, 27, 59], [0.469, 1.199, 0, 0, 0],
  [0.427, 1.223, 2, 0, 0], [0.861, 1.354, 0, 46, 62], [0.725, 1.366, 0, 65, 69], [0.755, 1.041, 0, 48, 39],
  [0.611, 1.384, 0, 55, 37], [0.748, 1.5, 0, 61, 27], [0.573, 0.913, 1, 56, 31], [0.732, 1.322, 1, 69, 57],
  [0.751, 0.947, 2, 31, 25], [0.824, 0.914, 0, 0, 0], [0.376, 0.916, 0, 0, 0], [0.898, 1.032, 2, 24, 57],
  [0.39, 1.035, 2, 51, 44], [0.585, 0.952, 2, 58, 51], [0.387, 1.388, 2, 0, 0], [0.542, 0.985, 2, 29, 50],
  [0.446, 1.054, 1, 0, 0], [0.616, 0.975, 0, 34, 67], [0.717, 1.011, 2, 0, 0], [0.767, 1.358, 2, 0, 0],
  [0.631, 1.405, 0, 46, 58], [0.575, 0.909, 2, 41, 39], [0.88, 1.159, 2, 45, 68],
];

const HARLEM_SKYLINE: readonly Building[] = [
  [0.198, 1.084, 1, 26, 66], [0.332, 1.396, 2, 25, 34], [0.868, 1.085, 1, 65, 41], [0.926, 1.287, 1, 0, 0],
  [0.282, 1.337, 1, 0, 0], [0.428, 1.38, 0, 0, 0], [0.196, 1.135, 1, 0, 0], [0.184, 1.076, 2, 23, 47],
  [0.185, 1.074, 1, 0, 0], [0.278, 1.15, 1, 67, 37], [0.344, 1.011, 2, 27, 59], [0.411, 1.243, 0, 0, 0],
  [0.349, 1.078, 2, 0, 0], [0.382, 1.124, 0, 46, 62], [0.424, 1.144, 1, 65, 69], [0.818, 1.029, 2, 48, 39],
  [0.303, 1.365, 1, 55, 37], [0.227, 1.1, 0, 61, 27], [0.366, 1.2, 0, 56, 31], [0.812, 1.303, 2, 69, 57],
  [0.301, 1.311, 2, 31, 25], [0.216, 1.141, 2, 0, 0], [0.245, 1.204, 2, 0, 0], [0.89, 1.236, 1, 24, 57],
  [0.298, 1.336, 1, 51, 44], [0.223, 1.264, 2, 58, 51], [0.203, 1.123, 1, 0, 0], [0.243, 1.008, 0, 29, 50],
  [0.853, 1.327, 2, 0, 0], [0.93, 1.367, 1, 34, 67], [0.4, 1.325, 1, 0, 0], [0.234, 1.221, 0, 0, 0],
  [0.405, 1.052, 1, 46, 58], [0.368, 1.337, 2, 41, 39], [0.233, 1.074, 1, 45, 68], [0.391, 1.333, 1, 0, 0],
];

/**
 * The site's skyline strip as email-safe markup: one fixed table row of
 * bottom-aligned cells, each holding a solid royal block, a few carrying a
 * lit orange window. Same silhouettes as `SkylineBand`, no images.
 */
function skylineRow(profile: readonly Building[], stripPx: number): string {
  const total = profile.reduce((sum, [, width]) => sum + width, 0);
  const cells = profile
    .map(([height, width, shade, litTopPct, litLeftPct]) => {
      const h = Math.max(2, Math.round(height * stripPx));
      const window =
        litTopPct === 0
          ? ''
          : `<div style="width:3px;height:3px;background:${LIT_WINDOW};margin:${Math.max(2, Math.round((h * litTopPct) / 100))}px 0 0 ${litLeftPct}%;font-size:1px;line-height:1px;">&nbsp;</div>`;
      return `<td valign="bottom" width="${((width / total) * 100).toFixed(2)}%" style="font-size:0;line-height:0;padding:0;"><div style="height:${h}px;background:${ROYAL_SHADES[shade]};">${window}</div></td>`;
    })
    .join('');
  return `<table role="presentation" aria-hidden="true" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;"><tr>${cells}</tr></table>`;
}

const KEYLINE = `<tr><td height="4" style="height:4px;background:${ORANGE};font-size:0;line-height:0;padding:0;">&nbsp;</td></tr>`;

// The footer nav mirrors the product site's Explore column (apps/web nav.ts).
const FOOTER_NAV = [
  ['Home', '/'],
  ['The Story', '/story'],
  ['The Mons', '/mons'],
  ['The City', '/city'],
  ['How it works', '/how-it-works'],
]
  .map(([label, href]) => `<a href="${SITE_URL}${href}" style="font-family:${SANS};font-size:13px;line-height:20px;color:${LINK};text-decoration:none;">${label}</a>`)
  .join(`<span style="color:${SUBTLE};font-size:13px;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`);

function render({ subject, paragraphs, action, code, footer }: Layout): MailContent {
  const footerLine = footer ?? "If this wasn't you, you can ignore this email.";
  const html = [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no"><title>${escapeHtml(subject)}</title>${FONT_LINK}</head>`,
    `<body style="margin:0;padding:0;background-color:${NAVY};">`,
    // Inbox preview text: hidden in the body, quoted by mail clients under the subject.
    `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${NAVY};">${escapeHtml(paragraphs[0] ?? subject)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="background-color:${NAVY};"><tr><td align="center" style="padding:28px 12px;">`,
    `<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">`,
    // Site header: wordmark on navy, the orange keyline, Midtown's skyline.
    `<tr><td style="padding:4px 0 18px;"><a href="${SITE_URL}" style="text-decoration:none;"><span style="font-family:${SANS};font-size:28px;font-weight:700;letter-spacing:.05em;color:${ORANGE};text-transform:uppercase;">NYC-MON</span></a></td></tr>`,
    KEYLINE,
    `<tr><td style="padding:0;">${skylineRow(MIDTOWN_SKYLINE, 24)}</td></tr>`,
    `<tr><td style="padding:36px 0 8px;">`,
    ...paragraphs.map((p) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${TEXT};">${escapeHtml(p)}</p>`),
    code === undefined
      ? ''
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td style="background:${RAISED};border:2px solid ${HAIRLINE};padding:18px 24px;"><span style="font-family:${MONO};font-size:30px;font-weight:700;letter-spacing:.2em;color:${TEXT};">${escapeHtml(code)}</span></td></tr></table>`,
    action === undefined
      ? ''
      : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${ORANGE};color:${ON_CTA};font-family:${SANS};font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-bottom:4px solid ${ORANGE_DEEP};">${escapeHtml(action.label)}</a></td></tr></table><p style="margin:16px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};word-break:break-all;">${escapeHtml(action.url)}</p>`,
    `<p style="margin:24px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(footerLine)}</p>`,
    `</td></tr>`,
    // Site footer: Harlem's skyline, the keyline, tagline, nav, legal strip.
    `<tr><td style="padding-top:28px;">${skylineRow(HARLEM_SKYLINE, 40)}</td></tr>`,
    KEYLINE,
    `<tr><td style="padding:20px 0 6px;"><p style="margin:0 0 6px;font-family:${SANS};font-size:15px;font-weight:500;color:${TEXT};">Every block has a legend.</p></td></tr>`,
    `<tr><td style="padding:0 0 18px;">${FOOTER_NAV}</td></tr>`,
    `<tr><td style="padding:14px 0 0;border-top:2px solid ${HAIRLINE};"><p style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${SUBTLE};">© NYC-MON</p></td></tr>`,
    `</table>`,
    `<!--[if mso]></td></tr></table><![endif]-->`,
    `</td></tr></table></body></html>`,
  ].join('');
  const text = [
    ...paragraphs,
    ...(code === undefined ? [] : [code]),
    ...(action === undefined ? [] : [action.url]),
    footerLine,
  ].join('\n\n');
  return { subject, html, text };
}

export function verifyEmailMail(url: string): MailContent {
  return render({
    subject: 'Confirm your NYC-MON email',
    // `mail.verify.body` in docs/design/screens/M03/05-copy.md; the deck's
    // "didn't sign up" tail sits in the footer like every other notice's.
    paragraphs: ['Tap the link to confirm this address and finish setting up your NYC-MON account.'],
    action: { label: 'Confirm email', url },
    footer: "If you didn't sign up, you can ignore this email.",
  });
}

export function resetPasswordMail(url: string): MailContent {
  return render({
    subject: 'Reset your NYC-MON password',
    // `mail.reset.body` in docs/design/screens/M03/05-copy.md, split the same
    // way: what to do in the body, the "didn't ask" reassurance in the footer.
    paragraphs: ['Use this link to set a new password. It expires in one hour.'],
    action: { label: 'Set a new password', url },
    footer: "If you didn't ask for this, you can ignore it and your password stays the same.",
  });
}

export function changeEmailMail(newEmail: string, url: string): MailContent {
  return render({
    subject: 'Confirm your new NYC-MON email',
    paragraphs: [`Someone asked to move this NYC-MON account to ${newEmail}. Confirm to make the change.`],
    action: { label: 'Confirm the change', url },
    footer: "If you didn't ask for this, ignore this email and your address stays the same.",
  });
}

export function twoFactorCodeMail(code: string, minutes: number): MailContent {
  return render({
    subject: 'Your NYC-MON sign-in code',
    paragraphs: [`Enter this code to finish signing in. It works for ${minutes} minutes.`],
    code,
    footer: "If you didn't try to sign in, change your password.",
  });
}

/** Provider ids as Better Auth stores them, to the names Callers know. */
function providerName(providerId: string): string {
  switch (providerId) {
    case 'google':
      return 'Google';
    case 'apple':
      return 'Apple';
    case 'credential':
      return 'Email and password';
    default:
      return providerId;
  }
}

export function signInMethodAddedMail(providerId: string): MailContent {
  const name = providerName(providerId);
  return render({
    subject: `${name} sign-in was added to your NYC-MON account`,
    paragraphs: [`${name} can now sign in to your NYC-MON account.`],
    // The methods list in Settings is read-only; changing the password is
    // the remedy that ships (`settings.account.password.hint`).
    footer: "If you didn't do this, change your password.",
  });
}

export function signInMethodRemovedMail(providerId: string): MailContent {
  const name = providerName(providerId);
  return render({
    subject: `${name} sign-in was removed from your NYC-MON account`,
    paragraphs: [`${name} can no longer sign in to your NYC-MON account.`],
    footer: "If you didn't do this, change your password.",
  });
}

export function newSurfaceMail(surfaceLabel: string): MailContent {
  // `surfaceLabel` can start with a vowel ("Apple Vision Pro").
  const article = /^[aeiou]/i.test(surfaceLabel) ? 'an' : 'a';
  return render({
    subject: 'A new sign-in to your NYC-MON account',
    paragraphs: [`Your account was just signed in on ${article} ${surfaceLabel}. Your Mon is the same one on every screen.`],
    // No "Devices" list ships in Settings; a password change signs out the
    // other sessions, in the app's own words.
    footer: "If this wasn't you, change your password. Your other devices get signed out.",
  });
}

export function accountsMergedMail(movedMons: number): MailContent {
  const mons = movedMons === 1 ? '1 Mon' : `${movedMons} Mons`;
  return render({
    subject: 'Your NYC-MON accounts were joined',
    paragraphs: [`Two NYC-MON accounts were joined into one. ${mons} moved over, and nothing was deleted.`],
    // The support channel the legal pages name: replies reach a person.
    footer: "If you didn't do this, reply to this email and it reaches the team.",
  });
}

/**
 * Guardian consent request. Sent to the parent or guardian's email address for
 * an under-13 Caller (ADR 0001 § Age and consent). Plain text is the primary
 * part; HTML is supplied so mail clients render links.
 *
 * The yes/no links are placeholders until counsel chooses the consent method
 * (M05 B1); the endpoint uses whatever URLs the caller passes in.
 */
export function guardianConsentMail(consentId: number, days: number, baseURL: string): MailContent {
  const yesUrl = `${baseURL}/guardian-consent/${consentId}?decision=approve`;
  const noUrl = `${baseURL}/guardian-consent/${consentId}?decision=deny`;
  const noticeUrl = `${baseURL}/legal/childrens-privacy`;
  return render({
    subject: 'Your child asked to set up an NYC-MON account',
    paragraphs: [
      'Hi. Someone entered this email address in the NYC-MON app and asked you to approve an account for a child under 13.',
      'NYC-MON is a game set in New York. Players look after a creature called a Mon on their phone. The game calls players Callers.',
      `If you say yes, we keep your child's birth year, the Caller name they choose and their Mon's progress, so the game works on a new phone.`,
      "We show no ads based on what your child does, and the only notification is sent by the phone itself when an egg is ready.",
      "If you say no, we delete your email address and everything your child saved with us. In the game, their Mon goes to stay with one of the characters, so your child doesn't see it deleted.",
      `If you don't answer within ${days} days, we delete this request and your email address.`,
      `Yes, set up the account: ${yesUrl}`,
      `No thanks: ${noUrl}`,
      `Read our children's privacy notice: ${noticeUrl}`,
    ],
    footer: "You got this email because someone typed your address into NYC-MON. If you don't know who, you can ignore it and we'll delete it in {days} days.".replace(
      '{days}',
      String(days),
    ),
  });
}

/**
 * Waitlist confirmation (PS-001). `POST /v1/waitlist` sends it when an
 * address joins, and again on a repeat join: the endpoint answers `joined`
 * either way so it never says who has signed up, and the mail matches —
 * "you're on the list" is true in both cases.
 *
 * Voice is the site's, not an account notice: no counts, no scarcity. The
 * form promises "one email when the app is out, and no ads", so this mail
 * names itself the confirmation and the launch mail the only other one;
 * sending it must not quietly break the promise.
 */
export function waitlistJoinedMail(): MailContent {
  return render({
    subject: "You're on the NYC-MON waitlist",
    paragraphs: [
      'Someone entered this email address on the NYC-MON site and joined the waitlist.',
      "You're on the list. This is the confirmation email. One more comes when the app is out, and no ads.",
    ],
    action: { label: 'Visit nyc-mon.city', url: SITE_URL },
  });
}
