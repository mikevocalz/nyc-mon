'use client';

import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';
import { BrandWordmark } from '../brand/BrandWordmark';
import { districtTone, type ChartTone, type District } from '../district';
import { Header, Link, List, ListItem, Nav } from '../primitives';
import { useInstanceStore, useStore } from '../use-instance-store';
import { Pressable, Text, View } from '../tw';
import { SkylineBand } from './SkylineBand';
import { NeonChevron } from '../neon/NeonChevron';

export interface NavItem {
  label: string;
  href?: string;
  /** Marks the current page (aria-current). */
  active?: boolean;
  onPress?: () => void;
  /** A dropdown of sub-pages. */
  children?: NavItem[];
}

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
  /** Right of the links: an avatar, a button. */
  trailing?: ReactNode;
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
    menu: 'absolute top-full z-50 mt-1 min-w-48 border-2 border-ink-700 bg-ink-950 py-1',
    menuLink: 'flex min-h-11 flex-col justify-center px-4 py-2 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    trailing: 'flex-row items-center gap-3',
    toggle: 'h-11 w-11 items-center justify-center border-2 border-ink-700 md:hidden',
    toggleText: 'text-xl leading-none text-white',
    sheet: 'border-t-2 border-ink-800 bg-ink-950 px-3 pb-4 pt-2 md:hidden',
    sheetLink: 'flex min-h-12 flex-row items-center justify-between px-3 py-3',
    keyline: 'h-1 w-full',
  },
  variants: {
    tone: {
      orange: { linkActive: 'bg-orange-500', keyline: 'bg-orange-500' },
      royal: { linkActive: 'bg-royal-500', keyline: 'bg-royal-500', linkActiveText: 'text-white' },
      carolina: { linkActive: 'bg-carolina-500', keyline: 'bg-carolina-500' },
      leaf: { linkActive: 'bg-leaf-500', keyline: 'bg-leaf-500' },
      apple: { linkActive: 'bg-apple-500', keyline: 'bg-apple-500', linkActiveText: 'text-white' },
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
  renderLink,
  label = 'Primary',
  className,
}: NavBarProps) {
  const tone: ChartTone = color ? (PRESETS[color] ?? (color as ChartTone)) : districtTone(district);
  const s = bar({ tone, transparency, position, navAlign });
  const store = useInstanceStore(() => ({ sheet: false, dropdown: -1 }));
  const sheet = useStore(store, (st) => st.sheet);
  const dropdown = useStore(store, (st) => st.dropdown);
  const close = () => store.setState({ sheet: false, dropdown: -1 });

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
                      <List className={s.menu()}>
                        {item.children.map((child, c) => (
                          <ListItem key={`${child.label}-${c}`}>
                            {anchor(child, <Text className={textClass(child)}>{child.label}</Text>, `${s.menuLink()} ${child.active ? s.linkActive() : ''}`)}
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
          {trailing}
          {items.length ? (
            <Pressable
              role="button"
              aria-label={sheet ? 'Close menu' : 'Open menu'}
              aria-expanded={sheet}
              onPress={() => store.setState({ sheet: !sheet, dropdown: -1 })}
              className={s.toggle()}
            >
              <Text className={s.toggleText()}>{sheet ? '✕' : '☰'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {sheet ? (
        <Nav aria-label={label} className={s.sheet()}>
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
          </List>
        </Nav>
      ) : null}

      <View aria-hidden className={s.keyline()} />
      {skyline ? <SkylineBand district={district} className="h-5" /> : null}
    </Header>
  );
}
