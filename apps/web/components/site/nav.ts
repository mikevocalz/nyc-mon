import type { FooterLinkGroup, NavCta, NavItem } from '@acme/ui';
import { HOME_COPY } from '@acme/spatial/copy';

/** Product-site pages, the marketing map from BUILD_PROMPT §5 — not the app's tabs. */
const PAGES = [
  { label: 'Home', href: '/' },
  { label: 'The Story', href: '/story' },
  { label: 'The Mons', href: '/mons' },
  { label: 'The City', href: '/city' },
  { label: 'How it works', href: '/how-it-works' },
  // Last, so the site editor's saved link copy (keyed links.0 to links.4) still lines up with the first five.
  { label: 'Walk the city', href: '/city/walk' },
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

/** The longest page href the path sits under, so /city/walk marks "Walk the city" and not "The City" too. */
export const isActive = (pathname: string, href: string) => {
  const under = (h: string) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(`${h}/`));
  if (!under(href)) return false;
  return !PAGES.some((page) => page.href !== href && page.href.length > href.length && under(page.href));
};

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
      { label: 'Walk the city', href: '/city/walk' },
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
