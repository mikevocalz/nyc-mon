import type { FooterLinkGroup, NavCta, NavItem } from '@acme/ui';
import { HOME_COPY } from '@acme/spatial/copy';

/** Product-site pages, the marketing map from BUILD_PROMPT §5 — not the app's tabs. */
const PAGES = [
  { label: 'Home', href: '/' },
  { label: 'The Mons', href: '/mons' },
  { label: 'The City', href: '/city' },
  { label: 'How it works', href: '/how-it-works' },
] as const;

/** The header's one primary action: sign in. */
export const NAV_CTA: NavCta = { label: 'Log in', href: '/sign-in?intent=sign_in' };

/** The id of the content wrapper the header's skip link jumps to. */
export const CONTENT_ID = 'content';

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/** Header items with the current route marked. */
export const navItems = (pathname: string): NavItem[] =>
  PAGES.map((page) => ({ ...page, active: isActive(pathname, page.href) }));

/** Spatial draws its own full-bleed city; the site header and footer stay off it. */
export const showsSiteChrome = (pathname: string) => !pathname.startsWith('/spatial');

export const FOOTER_DESCRIPTION = HOME_COPY.intro;

export const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'The Mons', href: '/mons' },
      { label: 'The City', href: '/city' },
      { label: 'How it works', href: '/how-it-works' },
    ],
  },
  {
    title: 'Get NYC-MON',
    links: [
      { label: 'Walk the district', href: '/spatial' },
      { label: 'Join the waitlist', href: '/get' },
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
    ],
  },
];
