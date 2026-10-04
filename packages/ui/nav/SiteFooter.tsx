'use client';

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { BrandWordmark } from '../brand/BrandWordmark';
import { districtTone, type ChartTone, type District } from '../district';
import { useAppForm } from '../form';
import { Footer, Heading, Link, List, ListItem, Nav, Paragraph } from '../primitives';
import { Text, View } from '../tw';
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

export interface SiteFooterProps {
  /**
   * NeonBlade layouts. minimal: one row. columns: brand plus link columns.
   * centered: everything on the centre line. mega: columns plus the
   * newsletter and a tall skyline. Default columns.
   */
  variant?: 'minimal' | 'columns' | 'centered' | 'mega';
  logo?: ReactNode;
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
  /** The skyline along the top edge, and the default accent. */
  district?: District;
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  /** Show the district skyline. Default true. */
  skyline?: boolean;
  renderLink?: (link: FooterLink, children: ReactNode, className: string) => ReactNode;
  className?: string;
}

const PRESETS: Record<string, ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    link: 'flex min-h-11 flex-col justify-center rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-0',
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

function Newsletter({
  placeholder, button, onSubmit, className,
}: { placeholder: string; button: string; onSubmit?: (email: string) => void | Promise<void>; className: string }) {
  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit?.(value.email.trim());
      formApi.reset();
    },
  });
  return (
    <View className={className}>
      <form.AppField
        name="email"
        validators={{ onBlur: ({ value }) => (EMAIL.test(value.trim()) ? undefined : 'Enter an email address, like name@example.com') }}
      >
        {(field) => (
          <field.TextField label="Block report by email" placeholder={placeholder} returnKeyType="send" onSubmitEditing={() => form.handleSubmit()} />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton title={button} />
      </form.AppForm>
    </View>
  );
}

/**
 * NeonBlade's Footer as the NYC-MON city edge: a district skyline standing on
 * a tone keyline, then the wordmark, the tagline, link columns in tone
 * headings, and an optional email sign-up on the kit's TanStack Form fields.
 */
export function SiteFooter({
  variant = 'columns',
  logo,
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
  district = 'midtown',
  color,
  skyline = true,
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
        {logo ?? <BrandWordmark height={variant === 'minimal' ? 28 : 44} />}
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
      {skyline ? <SkylineBand district={district} className={variant === 'mega' ? 'h-24 md:h-32' : 'h-12 md:h-16'} /> : null}
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
          <Newsletter
            placeholder={newsletterPlaceholder}
            button={newsletterButtonLabel}
            onSubmit={onNewsletterSubmit}
            className={`${s.newsletter()} ${variant === 'mega' ? 'md:w-full md:max-w-md' : ''}`}
          />
        ) : null}
      </View>
      {variant === 'minimal' ? null : (
        <View className={s.legal()}>
          <View className={s.legalInner()}>
            <Text className={s.legalText()}>{copyright}</Text>
            <Text className={s.legalText()}>{tagline}</Text>
          </View>
        </View>
      )}
    </Footer>
  );
}
