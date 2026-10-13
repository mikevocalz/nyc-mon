'use client';
import type { ReactNode } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BrandWordmark, NavBar, SiteFooter, type FooterLink, type NavItem } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { CONTENT_ID, FOOTER_DESCRIPTION, FOOTER_GROUPS, NAV_CTA, navItems, showsSiteChrome } from './nav';
import { sectionMarker } from '../home/sections';

// Client-side routing for the kit's links: solito's Link renders the anchor.
// The item label names the link, so the logo link reads "NYC-MON home" here
// and in the footer (WCAG 3.2.4) whatever mark it wraps.
const navLink = (item: NavItem, children: ReactNode, className: string) => (
  <Link
    href={item.href ?? '/'}
    aria-label={item.label}
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
      <BrandWordmark decorative height={66} />
    </View>
    <View className="hidden short:flex">
      <BrandWordmark decorative height={40} />
    </View>
  </>
);

/** The kit NavBar with the marketing pages and one CTA. The product site
 *  carries no auth (ADR 0003) — there is no avatar slot here. The links fold
 *  into the menu below `lg`: the full-height wordmark, five links and the
 *  waitlist CTA need about 900px. The waitlist is the site's primary action,
 *  so it wears the orange CTA face. The skyline strip shows from `md` and is
 *  dropped on phones, upright or sideways, where height is scarce. */
export function SiteNavBar() {
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname)) return null;

  return (
    <NavBar
      items={navItems(pathname)}
      cta={NAV_CTA}
      ctaTone="orange"
      skylineClassName="hidden h-5 md:flex short:hidden"
      skipTo={CONTENT_ID}
      district="midtown"
      logo={siteLogo}
      collapseBelow="lg"
      renderLink={navLink}
    />
  );
}

/**
 * The kit SiteFooter with this site's page columns, the badge and Harlem's
 * skyline along the top (PS-025): a static band, so the page ends on the city
 * without a second moving scene after the hatch, and no canvas code ships.
 */
export function SiteFooterBar() {
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname)) return null;

  return (
    <View {...sectionMarker('footer')} className="w-full">
    <SiteFooter
      variant="columns"
      mark="badge"
      district="harlem"
      scene="skyline"
      description={FOOTER_DESCRIPTION}
      linkGroups={FOOTER_GROUPS}
      renderLink={footerLink}
      containerClassName="max-w-screen-xl sm:px-6 lg:px-8"
    />
    </View>
  );
}
