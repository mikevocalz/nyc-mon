'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';
import { BrandWordmark } from '../brand/BrandWordmark';
import { districtTone, type ChartTone, type District } from '../district';
import { Header, Link, List, ListItem, Nav } from '../primitives';
import { useInstanceStore, useStore } from '../use-instance-store';
import { Pressable, Text, View } from '../tw';
import { SkylineBand } from './SkylineBand';
import { NeonChevron } from '../neon/NeonChevron';
import { dropdown as dropdownLook } from '../dropdown';

export interface NavItem {
  label: string;
  href?: string;
  /** Marks the current page (aria-current). */
  active?: boolean;
  onPress?: () => void;
  /** A dropdown of sub-pages. */
  children?: NavItem[];
}

/** The one primary action in a {@linkcode NavBar}, set apart from the page links. */
export type NavCta = Pick<NavItem, 'label' | 'href' | 'onPress'>;

export interface NavBarProps {
  items?: NavItem[];
  /** Left mark. Default: the NYC-MON wordmark. */
  logo?: ReactNode;
  /** Where the logo links. Default "/". */
  logoHref?: string;
  /** NeonBlade: "sticky" (default), "fixed", "floating" or "static". Sticky and fixed are web-only. */
  position?: 'sticky' | 'fixed' | 'floating' | 'static';
  /** NeonBlade: "solid" (default), "glass" or "transparent". */
  transparency?: 'solid' | 'glass' | 'transparent';
  /** Accent: a tone family or a NeonBlade preset. Default: the district's tone. */
  color?: ChartTone | 'cyan' | 'pink' | 'green';
  /** Skyline along the bottom edge, and the default accent. */
  district?: District;
  /** Show the district skyline under the bar. Default true. */
  skyline?: boolean;
  /** NeonBlade: where the links sit on wide screens. Default right. */
  navAlign?: 'left' | 'center' | 'right';
  /** Right of the links: an avatar, a button. Stays visible on phones. */
  trailing?: ReactNode;
  /**
   * The one primary action: an outlined tone button after the links on wide
   * screens, and the last row of the phone menu.
   */
  cta?: NavCta;
  /**
   * Web only: the id of the main content. Adds a "Skip to content" link as
   * the first focus stop, hidden until it is focused.
   */
  skipTo?: string;
  /** Label of the skip link. Default "Skip to content". */
  skipLabel?: string;
  /**
   * Render a link yourself (e.g. solito's Link for in-app routing). Default:
   * the semantic Link primitive (a real anchor on web).
   */
  renderLink?: (item: NavItem, children: ReactNode, className: string) => ReactNode;
  /** Accessible name of the primary nav. Default "Primary". */
  label?: string;
  className?: string;
}

const PRESETS: Record<string, ChartTone> = { cyan: 'carolina', pink: 'apple', green: 'leaf' };

const bar = tv({
  slots: {
    root: 'z-50 w-full',
    // z-10: dropdowns paint over the keyline and skyline that follow.
    inner: 'relative z-10 mx-auto w-full max-w-screen-2xl flex-row items-center gap-4 px-4 py-3 md:px-6',
    logo: 'rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    links: 'hidden flex-1 flex-row items-center gap-1 md:flex',
    // `flex`: on web the Link primitive is an inline anchor, so flex-row alone does nothing.
    link: 'flex min-h-11 flex-row items-center gap-1.5 px-3.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    linkText: 'text-sm font-semibold text-silver-200',
    linkIdle: 'hover:bg-ink-800',
    linkActive: '',
    linkActiveText: 'text-ink-950',
    trailing: 'flex-row items-center gap-3',
    toggle: 'h-11 w-11 items-center justify-center border-2 border-ink-700 md:hidden',
    toggleText: 'text-xl leading-none text-white',
    sheet: 'border-t-2 border-ink-800 bg-ink-950 px-3 pb-4 pt-2 md:hidden',
    sheetLink: 'flex min-h-12 flex-row items-center justify-between px-3 py-3',
    keyline: 'h-1 w-full',
    cta: 'flex min-h-11 flex-row items-center justify-center border-2 px-4 py-2 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    ctaText: 'text-sm font-semibold',
    skip: 'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:px-4 focus:py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
  },
  variants: {
    tone: {
      // CTA text uses the same tone steps as the footer's group titles on ink-950.
      orange: { linkActive: 'bg-orange-500', keyline: 'bg-orange-500', cta: 'border-orange-500', ctaText: 'text-orange-400', skip: 'bg-orange-500' },
      royal: { linkActive: 'bg-royal-500', keyline: 'bg-royal-500', linkActiveText: 'text-white', cta: 'border-royal-500', ctaText: 'text-royal-300', skip: 'bg-royal-500' },
      carolina: { linkActive: 'bg-carolina-500', keyline: 'bg-carolina-500', cta: 'border-carolina-500', ctaText: 'text-carolina-400', skip: 'bg-carolina-500' },
      leaf: { linkActive: 'bg-leaf-500', keyline: 'bg-leaf-500', cta: 'border-leaf-500', ctaText: 'text-leaf-400', skip: 'bg-leaf-500' },
      apple: { linkActive: 'bg-apple-500', keyline: 'bg-apple-500', linkActiveText: 'text-ink-950', cta: 'border-apple-500', ctaText: 'text-apple-400', skip: 'bg-apple-500' },
    },
    transparency: {
      solid: { root: 'bg-ink-950' },
      glass: { root: 'bg-ink-950/80 backdrop-blur-md' },
      transparent: { root: 'bg-transparent' },
    },
    position: {
      sticky: { root: 'sticky top-0' },
      fixed: { root: 'fixed inset-x-0 top-0' },
      floating: { root: 'mx-auto mt-3 max-w-screen-xl border-2 border-ink-800', inner: 'px-3 md:px-4' },
      static: { root: 'relative' },
    },
    navAlign: {
      left: { links: 'justify-start' },
      center: { links: 'justify-center' },
      right: { links: 'justify-end' },
    },
  },
});

/**
 * NeonBlade's NavBar as the NYC-MON site header: the wordmark, links on a
 * night bar, the current page set as a solid tone patch, a tone keyline and
 * the district skyline along the bottom edge. Dropdowns and the phone menu
 * open on press; state lives in a per-instance store.
 */
export function NavBar({
  items = [],
  logo,
  logoHref = '/',
  position = 'sticky',
  transparency = 'solid',
  color,
  district = 'midtown',
  skyline = true,
  navAlign = 'right',
  trailing,
  cta,
  skipTo,
  skipLabel = 'Skip to content',
  renderLink,
  label = 'Primary',
  className,
}: NavBarProps) {
  const tone: ChartTone = color ? (PRESETS[color] ?? (color as ChartTone)) : districtTone(district);
  const s = bar({ tone, transparency, position, navAlign });
  // The dropdown panel and rows are the kit's shared list (also Select's open list).
  const d = dropdownLook({ tone });
  const store = useInstanceStore(() => ({ sheet: false, dropdown: -1 }));
  const sheet = useStore(store, (st) => st.sheet);
  const dropdown = useStore(store, (st) => st.dropdown);
  const close = () => store.setState({ sheet: false, dropdown: -1 });
  const sheetId = `navbar-menu-${useId().replace(/:/g, '')}`;
  const open = sheet || dropdown >= 0;

  // Escape closes the phone menu or an open dropdown (web keyboards).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.setState({ sheet: false, dropdown: -1 });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, store]);

  const anchor = (item: NavItem, children: ReactNode, cls: string) =>
    renderLink ? (
      renderLink(item, children, cls)
    ) : (
      <Link href={item.href} aria-current={item.active ? 'page' : undefined} onPress={item.onPress} className={cls}>
        {children}
      </Link>
    );

  const linkClass = (item: NavItem) => twMerge(s.link(), item.active ? s.linkActive() : s.linkIdle());
  const textClass = (item: NavItem) => twMerge(s.linkText(), item.active ? s.linkActiveText() : '');

  return (
    <Header className={s.root({ className })}>
      {skipTo && Platform.OS === 'web' ? (
        <Link href={`#${skipTo}`} className={s.skip()}>
          <Text className={twMerge(s.linkText(), s.linkActiveText())}>{skipLabel}</Text>
        </Link>
      ) : null}
      <View className={s.inner()}>
        {anchor(
          { label: 'NYC-MON home', href: logoHref },
          logo ?? <BrandWordmark height={36} />,
          s.logo(),
        )}
        <Nav aria-label={label} className={s.links()}>
          <List className="flex-row items-center gap-1">
            {items.map((item, i) => (
              <ListItem key={`${item.label}-${i}`} className="relative">
                {item.children?.length ? (
                  <>
                    <Pressable
                      role="button"
                      aria-expanded={dropdown === i}
                      aria-haspopup="menu"
                      onPress={() => store.setState({ dropdown: dropdown === i ? -1 : i })}
                      className={linkClass(item)}
                    >
                      <Text className={textClass(item)}>{item.label}</Text>
                      <NeonChevron open={dropdown === i} tone={tone} size="sm" plain={!item.active} />
                    </Pressable>
                    {dropdown === i ? (
                      <List className={d.panel()}>
                        {item.children.map((child, c) => (
                          <ListItem key={`${child.label}-${c}`}>
                            {anchor(
                              child,
                              <Text className={twMerge(d.itemText(), child.active ? d.itemActiveText() : '')}>{child.label}</Text>,
                              twMerge(d.item(), child.active ? d.itemActive() : ''),
                            )}
                          </ListItem>
                        ))}
                      </List>
                    ) : null}
                  </>
                ) : (
                  anchor(item, <Text className={textClass(item)}>{item.label}</Text>, linkClass(item))
                )}
              </ListItem>
            ))}
          </List>
        </Nav>
        <View className={`${s.trailing()} ml-auto md:ml-0`}>
          {cta
            ? anchor(
                { ...cta, active: false },
                <Text className={s.ctaText()}>{cta.label}</Text>,
                twMerge(s.cta(), items.length ? 'hidden md:flex' : ''),
              )
            : null}
          {trailing}
          {items.length ? (
            <Pressable
              role="button"
              aria-label={sheet ? 'Close menu' : 'Open menu'}
              aria-expanded={sheet}
              aria-controls={sheetId}
              onPress={() => store.setState({ sheet: !sheet, dropdown: -1 })}
              className={s.toggle()}
            >
              <Text className={s.toggleText()}>{sheet ? '✕' : '☰'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {sheet ? (
        <Nav id={sheetId} aria-label={label} className={s.sheet()}>
          <List className="gap-1">
            {items.flatMap((item) => [item, ...(item.children ?? []).map((c) => ({ ...c, label: `${item.label}: ${c.label}` }))])
              .filter((item) => item.href || item.onPress)
              .map((item, i) => (
                <ListItem key={`${item.label}-${i}`}>
                  {anchor(
                    { ...item, onPress: () => { item.onPress?.(); close(); } },
                    <>
                      <Text className={twMerge(textClass(item), 'text-base')}>{item.label}</Text>
                      {item.active ? <Text className={textClass(item)}>●</Text> : null}
                    </>,
                    `${s.sheetLink()} ${item.active ? s.linkActive() : ''}`,
                  )}
                </ListItem>
              ))}
            {cta ? (
              <ListItem className="pt-2">
                {anchor(
                  { ...cta, active: false, onPress: () => { cta.onPress?.(); close(); } },
                  <Text className={twMerge(s.ctaText(), 'text-base')}>{cta.label}</Text>,
                  s.cta(),
                )}
              </ListItem>
            ) : null}
          </List>
        </Nav>
      ) : null}

      <View aria-hidden className={s.keyline()} />
      {skyline ? <SkylineBand district={district} className="h-5" /> : null}
    </Header>
  );
}
