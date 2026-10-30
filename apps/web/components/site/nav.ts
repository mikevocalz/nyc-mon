import type { FooterLinkGroup, NavCta, NavItem } from '@acme/ui';
import { HOME_COPY } from '@acme/spatial/copy';

/** Product-site pages, the marketing map from BUILD_PROMPT §5 — not the app's tabs. */
const PAGES = [
  { label: 'Home', href: '/' },
  { label: 'The Story', href: '/story' },
  { label: 'The Mons', href: '/mons' },
  { label: 'The City', href: '/city' },
  { label: 'How it works', href: '/how-it-works' },
] as const;

/**
 * The site's one call to action, repo-wide (prompt pack §9, PS-003). The
 * header, the home hero and the hatch band all read it from here.
 */
export const WAITLIST_CTA = { label: 'Join the waitlist', href: '/get' } as const;

/** The header's one primary action. "Log in" returns as a text link once the app is public (PS-003). */
export const NAV_CTA: NavCta = WAITLIST_CTA;

/** The id of the content wrapper the header's skip link jumps to. */
export const CONTENT_ID = 'content';

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/** Header items with the current route marked. */
export const navItems = (pathname: string): NavItem[] =>
  PAGES.map((page) => ({ ...page, active: isActive(pathname, page.href) }));

/** Routes that draw no site header/footer: spatial's full-bleed city, and the auth screens' own chrome. */
const CHROMELESS = ['/spatial', '/sign-in'];
export const showsSiteChrome = (pathname: string) =>
  !CHROMELESS.some((route) => pathname.startsWith(route));

export const FOOTER_DESCRIPTION = HOME_COPY.intro;

export const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'The Story', href: '/story' },
      { label: 'The Mons', href: '/mons' },
      { label: 'The City', href: '/city' },
      { label: 'How it works', href: '/how-it-works' },
    ],
  },
  {
    title: 'Get NYC-MON',
    links: [
      { label: 'Walk the district', href: '/spatial' },
      WAITLIST_CTA,
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
    ],
  },
];
