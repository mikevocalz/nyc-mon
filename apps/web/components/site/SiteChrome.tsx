'use client';
import type { ReactNode } from 'react';
import { copyTree } from '@acme/content/site-content-bindings';
import { blockImage, sectionFor, type SitePage } from '@acme/content/site-content';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BrandWordmark, Image, NavBar, SiteFooter, type FooterLink, type NavItem } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { siteHref } from '../../lib/site-href';
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
export function SiteNavBar({ content }: { content?: SitePage | null } = {}) {
  const header = sectionFor(content, 'header');
  const logo = blockImage(header?.content.find(block => block.blockType === 'image' && block.slot === 'logo'));
  const logoAt = (height: number) => logo ? <Image src={logo.src} alt={logo.alt} width={Math.round(height * logo.width / logo.height)} height={height} unoptimized contentFit="contain" /> : null;
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname) || header?.hidden) return null;

  return (
    <NavBar
      items={copyTree(navItems(pathname), header, 'links')}
      cta={copyTree(NAV_CTA, header, 'cta')}
      ctaTone="royal"
      skylineClassName="hidden h-5 md:flex short:hidden"
      skipTo={CONTENT_ID}
      district="midtown"
      logo={logo ? <><View className="flex short:hidden">{logoAt(66)}</View><View className="hidden short:flex">{logoAt(40)}</View></> : siteLogo}
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
export function SiteFooterBar({ content }: { content?: SitePage | null } = {}) {
  const footer = sectionFor(content, 'footer');
  const logo = blockImage(footer?.content.find(block => block.blockType === 'image' && block.slot === 'logo'));
  const copy = copyTree({description: FOOTER_DESCRIPTION, tagline: 'Every block has a legend.', copyright: '© NYC-MON', logoHref: '/', groups: FOOTER_GROUPS}, footer);
  const pathname = usePathname() ?? '/';
  if (!showsSiteChrome(pathname) || footer?.hidden) return null;

  return (
    <View {...sectionMarker('footer')} className="w-full">
    <SiteFooter
      variant="columns"
      mark="badge"
      logoHref={siteHref(copy.logoHref)}
      logo={logo ? <Image src={logo.src} alt={logo.alt} width={Math.round(100 * logo.width / logo.height)} height={100} unoptimized contentFit="contain" /> : undefined}
      tagline={copy.tagline}
      copyright={copy.copyright}
      district="harlem"
      scene="skyline"
      description={copy.description}
      linkGroups={copy.groups}
      renderLink={footerLink}
      containerClassName="max-w-screen-xl sm:px-6 lg:px-8"
    />
    </View>
  );
}
