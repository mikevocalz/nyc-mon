'use client';
import type { ReactNode } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BrandWordmark, Image, NavBar, SiteFooter, type FooterLink, type NavItem } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { siteHref } from '../../lib/site-href';
import { CONTENT_ID, isActive, showsSiteChrome } from './nav';
import { chromeContent } from './cms';
import type { PageProps } from '../cms/PageContent';
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
export function SiteNavBar({ page, previewPath }: PageProps & { previewPath?: string } = {}) {
  const content = chromeContent(page);
  const currentPath = usePathname() ?? '/';
  const pathname = previewPath ?? currentPath;
  if (!showsSiteChrome(pathname)) return null;

  return (
    <NavBar
      items={content.header.items.map((item) => ({ ...item, active: isActive(pathname, item.href) }))}
      cta={content.header.cta}
      ctaTone="royal"
      skylineClassName="hidden h-5 md:flex short:hidden"
      skipTo={CONTENT_ID}
      district="midtown"
      logo={content.headerLogo ? <Image src={content.headerLogo.src} alt={content.headerLogo.alt} width={Math.round(content.headerLogo.width / content.headerLogo.height * 66)} height={66} unoptimized framed={false} /> : siteLogo}
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
export function SiteFooterBar({ page, previewPath }: PageProps & { previewPath?: string } = {}) {
  const content = chromeContent(page);
  const currentPath = usePathname() ?? '/';
  const pathname = previewPath ?? currentPath;
  if (!showsSiteChrome(pathname)) return null;

  return (
    <View {...sectionMarker('footer')} className="w-full">
    <SiteFooter
      variant="columns"
      mark="badge"
      logoHref={siteHref('/')}
      district="harlem"
      scene="skyline"
      logo={content.footerLogo ? <Image src={content.footerLogo.src} alt={content.footerLogo.alt} width={128} height={Math.round(content.footerLogo.height / content.footerLogo.width * 128)} unoptimized framed={false} /> : undefined}
      tagline={content.footer.tagline}
      copyright={content.footer.copyright}
      description={content.footer.description}
      linkGroups={content.footer.groups}
      renderLink={footerLink}
      containerClassName="max-w-screen-xl sm:px-6 lg:px-8"
    />
    </View>
  );
}
