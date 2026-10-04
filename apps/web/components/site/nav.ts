import type { FooterLinkGroup, NavCta, NavItem } from '@acme/ui';
import { HOME_COPY } from '@acme/spatial/copy';

/** Header pages, in route parity with the mobile shell's tabs. */
const PAGES = [
  { label: 'Home', href: '/' },
  { label: 'Explore', href: '/explore' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Notifications', href: '/notifications' },
] as const;

/** Profile (settings live inside it) takes the avatar slot, not a text link. */
export const PROFILE = { label: 'Profile', href: '/profile' } as const;

/** The header's one primary action: the district in 3D. */
export const NAV_CTA: NavCta = { label: HOME_COPY.openCity, href: '/spatial' };

/** The id of the content wrapper the header's skip link jumps to. */
export const CONTENT_ID = 'content';

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/** Header items with the current route marked. */
export const navItems = (pathname: string): NavItem[] =>
  PAGES.map((page) => ({ ...page, active: isActive(pathname, page.href) }));

/** Home and Spatial draw their own full-bleed city; the site header and footer stay off them. */
export const showsSiteChrome = (pathname: string) => pathname !== '/' && !pathname.startsWith('/spatial');

export const FOOTER_DESCRIPTION = HOME_COPY.intro;

export const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    title: 'Play',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Explore', href: '/explore' },
      { label: 'Schedule', href: '/schedule' },
      { label: 'Spatial', href: '/spatial' },
    ],
  },
  {
    title: 'You',
    links: [
      { label: 'Profile', href: '/profile' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Settings', href: '/settings' },
    ],
  },
];
