/**
 * Every string on the legal pages (W06): privacy, terms and the children's
 * privacy notice. All `voice: "ui"` — plain language, honest about first-release
 * scope. Facts follow the product's real rules: the age gate, the guardian-
 * consent email flow and the "no behavioural ads" promise in
 * packages/payload/src/auth (ADR 0001, COPPA).
 */

/** A paragraph with one inline link: `before`, the link, then `after`. */
export interface LegalLinkParagraph {
  before: string;
  link: { label: string; href: string };
  after: string;
}

export type LegalParagraph = string | LegalLinkParagraph;

export interface LegalSection {
  /** Anchor id — also the aria-labelledby target of the section wrapper. */
  id: string;
  title: string;
  body: readonly LegalParagraph[];
}

export interface LegalDocument {
  eyebrow: string;
  title: string;
  /** The "Last updated" line, rendered verbatim. */
  updated: string;
  /** One-line summary, also used for the route's meta description. */
  description: string;
  sections: readonly LegalSection[];
}

const UPDATED = 'Last updated: 2026';

const privacy: LegalDocument = {
  eyebrow: 'Legal',
  title: 'Privacy notice',
  updated: UPDATED,
  description: 'What NYC-MON collects, what it never does, and how to reach us.',
  sections: [
    {
      id: 'w06-privacy-scope',
      title: 'What this covers',
      body: [
        'This notice covers the NYC-MON companion app and this product site. NYC-MON is a game set in New York: you look after a creature called a Mon, and the game calls you a Caller.',
        'The first release is a phone app. When headsets and other surfaces arrive, this notice will say so before they ask you for anything new.',
      ],
    },
    {
      id: 'w06-privacy-collect',
      title: 'What we collect',
      body: [
        'An account needs three things: your email address, the Caller name you pick, and the birth year you enter at the age gate. The birth year is the only age question — we do not ask for a full date of birth.',
        'We also keep your Mon and your Mon\u2019s progress, so your companion is the same one on every screen and survives a new phone.',
      ],
    },
    {
      id: 'w06-privacy-never',
      title: 'What we never do',
      body: [
        'No behavioural ads. We do not track what you do to sell it to advertisers, and we do not let ad networks watch you inside NYC-MON.',
        'We do not sell your data to anyone, and we do not share it for marketing. If that ever changes, this page changes first and we tell you.',
      ],
    },
    {
      id: 'w06-privacy-notifications',
      title: 'Notifications',
      body: [
        'The only notification the first release sends is the one your own phone schedules: a chirp when an egg is ready. It is set on the device and nothing leaves the phone to make it happen.',
        'There is no marketing push channel. Account emails go only to the address you gave us, and only when something needs your answer — like a sign-in or a consent request.',
      ],
    },
    {
      id: 'w06-privacy-device',
      title: 'On your device',
      body: [
        'The app keeps what it needs to run — your session, your district pick and your Mon — in storage on the device. Clearing the app\u2019s data removes it; your account copy stays until you delete it.',
      ],
    },
    {
      id: 'w06-privacy-rights',
      title: 'Your data, your call',
      body: [
        'You can review the email, Caller name and birth year on your account, ask for a copy of your data, or delete the account outright. Deleting the account removes its personal data; your Mon moves into Dr. Santoro\u2019s care.',
        {
          before: 'Parents reviewing a child\u2019s account use the ',
          link: { label: 'children\u2019s privacy notice', href: '/legal/childrens-privacy' },
          after: ', which lists what a parent can see and remove.',
        },
      ],
    },
    {
      id: 'w06-privacy-contact',
      title: 'Talk to us',
      body: [
        'Questions, exports and deletion requests: reply to any email NYC-MON sends you and it reaches a person, or use the support address shown in the app.',
      ],
    },
  ],
};

const terms: LegalDocument = {
  eyebrow: 'Legal',
  title: 'Terms of use',
  updated: UPDATED,
  description: 'The rules for using the NYC-MON app and this site.',
  sections: [
    {
      id: 'w06-terms-service',
      title: 'The service',
      body: [
        'NYC-MON is a companion app set in New York plus this product site. You care for a Mon on an H-Lynk Core through feeding, rest and play, and the site tells you about the world.',
        'The first release is the phone app and this site. Features named on the site but not yet in the app — the headset districts, store listings — are coming, not promised on a date.',
      ],
    },
    {
      id: 'w06-terms-account',
      title: 'Your account',
      body: [
        'An account holds your email, your Caller name and your birth year. Give real answers at the age gate: callers under 13 need a parent or guardian\u2019s emailed consent before an account exists.',
        'Keep your sign-in to yourself. What happens on your account is yours, so tell us quickly if a device isn\u2019t.',
      ],
    },
    {
      id: 'w06-terms-use',
      title: 'Fair use',
      body: [
        'Play, explore, name your Mon and enjoy the city. Don\u2019t break the service for other Callers: no scraping the API, no interfering with the game\u2019s traffic, no impersonating the team, and nothing unlawful.',
        'We can suspend an account that abuses the service. We\u2019d rather not — the block is big enough for everyone.',
      ],
    },
    {
      id: 'w06-terms-ip',
      title: 'What\u2019s whose',
      body: [
        'The Mons, the H-Lynk, the Bloodlines, the districts and the NYC-MON world are ours. The name you give your Mon is yours — we claim no rights over it.',
        'Don\u2019t sell NYC-MON art or characters as your own work. Fan pages and screenshots shared for love of the game are fine.',
      ],
    },
    {
      id: 'w06-terms-warranty',
      title: 'No warranty',
      body: [
        'NYC-MON is provided as is. It\u2019s a young service in its first release: it may have bugs, downtime or missing features, and we don\u2019t promise otherwise. When something breaks, the fix is honest work, not fine print.',
      ],
    },
    {
      id: 'w06-terms-liability',
      title: 'Liability',
      body: [
        'To the extent the law allows, NYC-MON isn\u2019t liable for indirect or incidental losses from using or being unable to use the service — including lost progress if a device fails before your account syncs.',
        'Nothing here limits liability that can\u2019t lawfully be limited.',
      ],
    },
    {
      id: 'w06-terms-law',
      title: 'Governing law',
      body: [
        'These terms are governed by the laws of the State of New York, where the city is. Disputes go to the state or federal courts sitting in New York.',
      ],
    },
    {
      id: 'w06-terms-changes',
      title: 'Changes and contact',
      body: [
        'If these terms change in a way that matters, we say so here and by email before it takes effect. Questions: reply to any NYC-MON email or use the support address in the app.',
      ],
    },
  ],
};

const childrens: LegalDocument = {
  eyebrow: 'Legal',
  title: 'Children\u2019s privacy',
  updated: UPDATED,
  description: 'How NYC-MON handles accounts for Callers under 13 (COPPA).',
  sections: [
    {
      id: 'w06-coppa-who',
      title: 'Who this is for',
      body: [
        'This notice is for parents and guardians. It explains what happens when a child under 13 wants an NYC-MON account, under the Children\u2019s Online Privacy Protection Rule (16 CFR Part 312).',
      ],
    },
    {
      id: 'w06-coppa-gate',
      title: 'The age gate',
      body: [
        'Before an account can be created, the app asks for a birth year — a year only, not a full date of birth. A year that means the Caller is under 13 starts the consent path instead of an account.',
      ],
    },
    {
      id: 'w06-coppa-consent',
      title: 'Your consent, by email',
      body: [
        'There is no under-13 account without a parent or guardian\u2019s yes. The child enters your email address, and we send you one message explaining what the account holds, with approve and decline links.',
        'Say no, or never answer, and we delete your address and everything saved with the request. In the game the child\u2019s Mon goes to stay with Dr. Santoro, so they never see that Mon deleted.',
      ],
    },
    {
      id: 'w06-coppa-kept',
      title: 'What we keep for a child',
      body: [
        'With your consent, the account keeps the same three things as any Caller\u2019s: the consenting email, the Caller name the child picks and the birth year, plus their Mon and that Mon\u2019s progress. Nothing else is asked of a child.',
      ],
    },
    {
      id: 'w06-coppa-review',
      title: 'What you can do',
      body: [
        'You can review what the account holds, withdraw consent, or ask for the account and its data to be deleted. Reply to your consent email from the address we wrote to, and the request reaches the team.',
      ],
    },
    {
      id: 'w06-coppa-ads',
      title: 'No ads to children',
      body: [
        'Children see no advertising in NYC-MON — not behavioural, not contextual, not ever. The one notification the game sends is scheduled by the phone itself when an egg is ready.',
      ],
    },
    {
      id: 'w06-coppa-contact',
      title: 'Talk to us',
      body: [
        'Anything about your child\u2019s account: reply to the consent email, or use the support address shown in the app. If you believe a child has an account without your consent, tell us and we will delete it.',
      ],
    },
  ],
};

export const LEGAL_COPY = { privacy, terms, childrens } as const;
