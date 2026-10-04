'use client';
import type { ReactNode } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { Avatar, NavBar, SiteFooter, type FooterLink, type NavItem } from '@acme/ui';
import { AVATAR_URI, useProfile } from '@acme/app';
import { CONTENT_ID, FOOTER_DESCRIPTION, FOOTER_GROUPS, NAV_CTA, PROFILE, isActive, navItems, showsSiteChrome } from './nav';

// Client-side routing for the kit's links: solito's Link renders the anchor.
const navLink = (item: NavItem, children: ReactNode, className: string) => (
  <Link
    href={item.href ?? '/'}
    onClick={item.onPress}
    aria-current={item.active ? 'page' : undefined}
    className={className}
  >
    {children}
  </Link>
);

const footerLink = (link: FooterLink, children: ReactNode, className: string) => (
  <Link key={link.label} href={link.href ?? '/'} className={className}>
    {children}
  </Link>
);

/** The kit NavBar with this site's pages, the current route and the profile avatar. */
export function SiteNavBar() {
  const pathname = usePathname() ?? '/';
  const name = useProfile((s) => s.name);
  if (!showsSiteChrome(pathname)) return null;
  const profileActive = isActive(pathname, PROFILE.href);

  return (
    <NavBar
      items={navItems(pathname)}
      cta={NAV_CTA}
      skipTo={CONTENT_ID}
      district="midtown"
      renderLink={navLink}
      trailing={
        <Link
          href={PROFILE.href}
          aria-label="Your profile and settings"
          aria-current={profileActive ? 'page' : undefined}
          className={`rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            profileActive ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-ink-950' : 'hover:ring-2 hover:ring-silver-400'
          }`}
        >
          <Avatar name={name} imageUri={AVATAR_URI} size="md" />
        </Link>
      }
    />
  );
}

/** The kit SiteFooter with this site's page columns, the badge and Harlem's East River along the top. */
export function SiteFooterBar() {
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname)) return null;

  return (
    <SiteFooter
      variant="columns"
      mark="badge"
      district="harlem"
      scene="river-tide"
      description={FOOTER_DESCRIPTION}
      linkGroups={FOOTER_GROUPS}
      renderLink={footerLink}
    />
  );
}
