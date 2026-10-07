'use client';

import { lazy, Suspense, type ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { BrandLogo } from '../brand/BrandLogo';
import { BrandWordmark } from '../brand/BrandWordmark';
import { districtTone, type ChartTone, type District } from '../district';
import { Footer, Heading, Link, List, ListItem, Nav, Paragraph } from '../primitives';
import { Text, View } from '../tw';
import { brand as brandColors } from '@acme/theme';
import { LazyScene } from '../backgrounds/LazyScene';
import { SkylineBand } from './SkylineBand';

export interface FooterLink {
  label: string;
  href?: string;
  onPress?: () => void;
  /** Opens in a new tab on web. */
  external?: boolean;
}

export interface FooterLinkGroup {
  title: string;
  links: FooterLink[];
}

export interface FooterSocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

/** The top band of {@linkcode SiteFooter}. @see {@linkcode SiteFooterProps.scene} */
export type FooterScene = 'river-tide' | 'skyline' | 'none';

export interface SiteFooterProps {
  /**
   * NeonBlade layouts. minimal: one row. columns: brand plus link columns.
   * centered: everything on the centre line. mega: columns plus the
   * newsletter and a tall skyline. Default columns.
   */
  variant?: 'minimal' | 'columns' | 'centered' | 'mega';
  logo?: ReactNode;
  /**
   * Which repo logo to show when `logo` is not set: the wordmark lettering or
   * the round badge. Both are shown as supplied, with "NYC-MON" as their
   * accessible name, so no text label sits beside them. Default "wordmark".
   */
  mark?: 'wordmark' | 'badge';
  logoHref?: string;
  /** Under the logo. Default "Every block has a legend." */
  tagline?: string;
  description?: string;
  linkGroups?: FooterLinkGroup[];
  /** Flat links for minimal and centered. */
  navLinks?: FooterLink[];
  socialLinks?: FooterSocialLink[];
  /** Default "© NYC-MON". */
  copyright?: string;
  /** Email sign-up (TanStack Form). Default: on for mega. */
  showNewsletter?: boolean;
  newsletterPlaceholder?: string;
  newsletterButtonLabel?: string;
  onNewsletterSubmit?: (email: string) => void | Promise<void>;
  /**
   * The district the top band shows, and the default accent. Default harlem:
   * the East River under the uptown shore.
   */
  district?: District;
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  /**
   * The band along the top edge.
   * - `river-tide`: the district's river at night ({@linkcode RiverTide}), a
   *   canvas that mounts as the footer scrolls near and pauses off screen.
   * - `skyline`: the flat district skyline ({@linkcode SkylineBand}), plain
   *   views that render on the server and cost nothing.
   * - `none`: just the keyline.
   * The band keeps its height before the canvas draws, so nothing shifts.
   * @default 'river-tide'
   */
  scene?: FooterScene;
  renderLink?: (link: FooterLink, children: ReactNode, className: string) => ReactNode;
  className?: string;
}

const PRESETS: Record<string, ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };
// The river needs room for the far shore and a few swells; minimal stays slim.
const TIDE_HEIGHT: Record<NonNullable<SiteFooterProps['variant']>, string> = {
  minimal: 'h-20 md:h-24',
  columns: 'h-32 md:h-44',
  centered: 'h-32 md:h-44',
  mega: 'h-44 md:h-64',
};
// The sign-up form is code-split: it brings the kit's TanStack Form fields
// (and through them Reanimated), and only the mega variant or an explicit
// showNewsletter renders it. The other footers ship none of that.
const Newsletter = lazy(() => import('./SiteFooterNewsletter'));
// The river is a canvas: split out too, so a footer with `scene="skyline"` or
// `"none"` ships none of it, and a river-tide footer loads it only once
// LazyScene sees the footer coming.
const RiverTide = lazy(() => import('../backgrounds/RiverTide').then((m) => ({ default: m.RiverTide })));

const foot = tv({
  slots: {
    root: 'w-full bg-ink-950',
    keyline: 'h-1 w-full',
    inner: 'mx-auto w-full max-w-screen-2xl gap-10 px-4 py-10 md:px-6',
    brand: 'max-w-sm gap-3',
    tagline: 'font-display text-lg text-white',
    description: 'my-0 text-sm leading-relaxed text-silver-400',
    columns: 'flex-row flex-wrap gap-x-12 gap-y-8',
    groupTitle: 'my-0 font-display text-sm',
    link: 'flex min-h-11 flex-col justify-center rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-6',
    linkText: 'text-sm text-silver-300 hover:text-white',
    social: 'h-11 w-11 items-center justify-center border-2 border-ink-700 hover:bg-ink-800',
    legal: 'border-t-2 border-ink-800',
    legalInner: 'mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-6',
    legalText: 'text-xs text-silver-500',
    newsletter: 'max-w-md gap-3',
  },
  variants: {
    tone: {
      orange: { keyline: 'bg-orange-500', groupTitle: 'text-orange-400' },
      royal: { keyline: 'bg-royal-500', groupTitle: 'text-royal-300' },
      carolina: { keyline: 'bg-carolina-500', groupTitle: 'text-carolina-400' },
      leaf: { keyline: 'bg-leaf-500', groupTitle: 'text-leaf-400' },
      apple: { keyline: 'bg-apple-500', groupTitle: 'text-apple-400' },
    },
    variant: {
      minimal: { inner: 'flex-row flex-wrap items-center justify-between gap-6 py-6', brand: 'flex-row items-center gap-4' },
      columns: { inner: 'md:flex-row md:justify-between' },
      centered: { inner: 'items-center', brand: 'items-center', description: 'text-center', columns: 'justify-center' },
      mega: { inner: 'md:flex-row md:flex-wrap md:justify-between' },
    },
  },
});

/**
 * NeonBlade's Footer as the NYC-MON city edge: the district's river at night
 * (or its skyline) over a tone keyline, then the wordmark, the tagline, link columns in tone
 * headings, and an optional email sign-up on the kit's TanStack Form fields.
 */
export function SiteFooter({
  variant = 'columns',
  logo,
  mark = 'wordmark',
  logoHref = '/',
  tagline = 'Every block has a legend.',
  description,
  linkGroups = [],
  navLinks = [],
  socialLinks = [],
  copyright = '© NYC-MON',
  showNewsletter,
  newsletterPlaceholder = 'name@example.com',
  newsletterButtonLabel = 'Get the report',
  onNewsletterSubmit,
  district = 'harlem',
  color,
  scene = 'river-tide',
  renderLink,
  className,
}: SiteFooterProps) {
  const tone: ChartTone = color ? (PRESETS[color] ?? (color as ChartTone)) : districtTone(district);
  const s = foot({ tone, variant });
  const newsletter = showNewsletter ?? variant === 'mega';
  const flat = variant === 'minimal' || variant === 'centered';

  const anchor = (link: FooterLink, i: number) => {
    const children = <Text className={s.linkText()}>{link.label}</Text>;
    return renderLink ? (
      renderLink(link, children, s.link())
    ) : (
      <Link
        key={`${link.label}-${i}`}
        href={link.href}
        onPress={link.onPress}
        className={s.link()}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
      >
        {children}
      </Link>
    );
  };

  const brand = (
    <View className={s.brand()}>
      <Link href={logoHref} aria-label="NYC-MON home" className={s.link()}>
        {logo ??
          (mark === 'badge' ? (
            <BrandLogo size={variant === 'minimal' ? 72 : 112} />
          ) : (
            <BrandWordmark height={variant === 'minimal' ? 28 : 44} />
          ))}
      </Link>
      {variant === 'minimal' ? null : <Text className={s.tagline()}>{tagline}</Text>}
      {description && variant !== 'minimal' ? <Paragraph className={s.description()}>{description}</Paragraph> : null}
      {socialLinks.length && variant !== 'minimal' ? (
        <List className="flex-row gap-2">
          {socialLinks.map((social) => (
            <ListItem key={social.label}>
              <Link href={social.href} aria-label={social.label} className={s.social()}>
                {social.icon}
              </Link>
            </ListItem>
          ))}
        </List>
      ) : null}
    </View>
  );

  return (
    <Footer className={s.root({ className })}>
      {scene === 'river-tide' ? (
        <LazyScene className={TIDE_HEIGHT[variant]} placeholderColor={brandColors.night}>
          {({ paused }) => (
            // Shore raised to mid-band so the district skyline keeps its height in a short strip; calmer swell.
            <Suspense fallback={null}>
              <RiverTide district={district} horizon={0.5} bands={5} amplitude={0.8} origin="bottom-left" paused={paused} className="flex-1" />
            </Suspense>
          )}
        </LazyScene>
      ) : null}
      {scene === 'skyline' ? <SkylineBand district={district} className={variant === 'mega' ? 'h-24 md:h-32' : 'h-12 md:h-16'} /> : null}
      <View aria-hidden className={s.keyline()} />
      <View className={s.inner()}>
        {brand}
        {flat ? (
          <Nav aria-label="Footer">
            <List className={`flex-row flex-wrap gap-x-6 gap-y-1 ${variant === 'centered' ? 'justify-center' : ''}`}>
              {navLinks.map((link, i) => (
                <ListItem key={`${link.label}-${i}`}>{anchor(link, i)}</ListItem>
              ))}
            </List>
          </Nav>
        ) : (
          <View className={s.columns()}>
            {linkGroups.map((group) => (
              <Nav key={group.title} aria-label={group.title} className="min-w-32 gap-2">
                <Heading level={2} className={s.groupTitle()}>{group.title}</Heading>
                <List className="gap-1">
                  {group.links.map((link, i) => (
                    <ListItem key={`${link.label}-${i}`}>{anchor(link, i)}</ListItem>
                  ))}
                </List>
              </Nav>
            ))}
          </View>
        )}
        {newsletter ? (
          <Suspense fallback={null}>
            <Newsletter
              placeholder={newsletterPlaceholder}
              button={newsletterButtonLabel}
              onSubmit={onNewsletterSubmit}
              className={`${s.newsletter()} ${variant === 'mega' ? 'md:w-full md:max-w-md' : ''}`}
            />
          </Suspense>
        ) : null}
      </View>
      {variant === 'minimal' ? null : (
        <View className={s.legal()}>
          <View className={s.legalInner()}>
            <Text className={s.legalText()}>{copyright}</Text>
          </View>
        </View>
      )}
    </Footer>
  );
}
