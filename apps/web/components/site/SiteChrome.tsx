'use client';
import type { ReactNode } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BrandWordmark, NavBar, SiteFooter, type FooterLink, type NavItem } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { CONTENT_ID, FOOTER_DESCRIPTION, FOOTER_GROUPS, NAV_CTA, navItems, showsSiteChrome } from './nav';
import { sectionMarker } from '../home/sections';

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

/**
 * The wordmark at full height, and shorter on a phone held sideways, where
 * the sticky header would otherwise take a third of the 390px-tall view.
 */
const siteLogo = (
  <>
    <View className="flex short:hidden">
      <BrandWordmark height={66} />
    </View>
    <View className="hidden short:flex">
      <BrandWordmark height={40} />
    </View>
  </>
);

/** The kit NavBar with the marketing pages and one CTA. The product site
 *  carries no auth (ADR 0003) — there is no avatar slot here. The links fold
 *  into the menu below `lg`: the full-height wordmark, five links and the
 *  waitlist CTA need about 900px. */
export function SiteNavBar() {
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname)) return null;

  return (
    <NavBar
      items={navItems(pathname)}
      cta={NAV_CTA}
      skipTo={CONTENT_ID}
      district="midtown"
      logo={siteLogo}
      collapseBelow="lg"
      renderLink={navLink}
    />
  );
}

/** The kit SiteFooter with this site's page columns, the badge and Harlem's East River along the top. */
export function SiteFooterBar() {
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname)) return null;

  return (
    <View {...sectionMarker('footer')} className="w-full">
    <SiteFooter
      variant="columns"
      mark="badge"
      district="harlem"
      scene="river-tide"
      description={FOOTER_DESCRIPTION}
      linkGroups={FOOTER_GROUPS}
      renderLink={footerLink}
    />
    </View>
  );
}
