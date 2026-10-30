'use client';
import type { ReactNode } from 'react';
import { useAuth, useConfig, useRouter } from '@payloadcms/ui';
import { BottomSheet, BrandWordmark, TabBar, Toaster, type TabBarTab } from '@acme/ui/admin';
import { Aside, Button, Footer, Header, Heading, Link, List, ListItem, Main, Nav, Page, Section, Text } from '@acme/ui/html';
import { Box, Home, MoreHorizontal, ShieldCheck, Users } from '@acme/ui/icons';
import { consoleAuth } from './auth-client';
import { consoleCopy } from './copy';
import { useShellStore } from './stores';

const links = [
  ['/admin/overview', 'overview'], ['/admin/callers', 'callers'], ['/admin/consent', 'consent'],
  ['/admin/mons', 'mons'], ['/admin/models', 'models'], ['/admin/content', 'content'], ['/admin/collections/site-pages', 'website'], ['/admin/audit', 'audit'], ['/admin/settings', 'settings'],
] as const;

const moreLinks = [
  ['/admin/models', 'models'], ['/admin/content', 'content'], ['/admin/collections/site-pages', 'website'], ['/admin/audit', 'audit'], ['/admin/settings', 'settings'],
] as const;

const icon = (Icon: typeof Home, name: string) => {
  const TabIcon = ({ colorClass }: { colorClass: string }) => <Icon size={20} className={colorClass} aria-hidden />;
  TabIcon.displayName = name;
  return TabIcon;
};

/**
 * The active item is the one block the section owns: inverted ink on the
 * page's ink, with the console's corner notch cut out of the top right
 * (03-direction.md, "notch geometry on the active nav item"). The clip is
 * decorative; on platforms without clip-path the block stays square.
 */
const navItem = (active: boolean) =>
  `flex min-h-11 flex-row items-center gap-3 px-3 text-[15px] font-medium no-underline ${
    active
      ? 'bg-text text-bg [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]'
      : 'text-text-secondary hover:bg-surface-sunken hover:text-text'
  }`;

export function ConsoleShell({ section, heading, children }: { section: keyof typeof consoleCopy.nav; heading: string; children: ReactNode }) {
  const router = useRouter();
  const {config} = useConfig();
  const {user} = useAuth();
  const websiteEnabled = config.collections.some(collection => collection.slug === 'site-pages') && ['ops', 'content'].includes(String(user?.role));
  const visibleLinks = links.filter(([,key]) => key !== 'website' || websiteEnabled);
  const visibleMoreLinks = moreLinks.filter(([,key]) => key !== 'website' || websiteEnabled);
  const appearance = useShellStore((state) => state.appearance);
  const moreOpen = useShellStore((state) => state.moreOpen);
  const setMoreOpen = useShellStore((state) => state.setMoreOpen);
  const signOut = async () => {
    try { await consoleAuth().signOut(); } catch { /* a failed sign-out still lands on the login screen */ }
    router.push('/admin/login');
  };
  const tabs: TabBarTab[] = [
    { key: 'overview', label: consoleCopy.nav.overview, href: '/admin/overview', icon: icon(Home, 'OverviewIcon'), active: section === 'overview' },
    { key: 'callers', label: consoleCopy.nav.callers, href: '/admin/callers', icon: icon(Users, 'CallersIcon'), active: section === 'callers' },
    { key: 'consent', label: consoleCopy.nav.consent, href: '/admin/consent', icon: icon(ShieldCheck, 'ConsentIcon'), active: section === 'consent' },
    { key: 'mons', label: consoleCopy.nav.mons, href: '/admin/mons', icon: icon(Box, 'MonsIcon'), active: section === 'mons' },
    { key: 'more', label: consoleCopy.nav.more, icon: icon(MoreHorizontal, 'MoreIcon'), onPress: () => setMoreOpen(true), active: visibleMoreLinks.some(([, key]) => key === section) },
  ];
  return (
    <Page className={`nycmon-console min-h-dvh bg-bg font-sans text-text ${appearance === 'night' ? 'scheme-dark' : appearance === 'daylit' ? 'scheme-light' : ''}`} testID="console-root">
      {/* Sidebar: 16rem from 840px, 20rem from 1200px (03-direction.md pane tokens). */}
      <Aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface-raised min-[840px]:flex min-[1200px]:w-80" testID="console-nav">
        <Header className="border-b border-border px-5 py-5">
          <Link href="/admin/overview" aria-label={consoleCopy.shell.brandLabel} className="self-start no-underline">
            <BrandWordmark height={40} decorative />
          </Link>
        </Header>
        <Nav aria-label="Console" className="flex-1 gap-1 overflow-y-auto px-3 py-4">
          {visibleLinks.map(([href, key]) => <Link key={key} href={href} aria-current={key === section ? 'page' : undefined} className={navItem(key === section)} testID={`console-nav-${key}`}>{consoleCopy.nav[key]}</Link>)}
        </Nav>
        <Footer className="border-t border-border px-3 py-3">
          <Button onPress={() => void signOut()} className={`${navItem(false)} w-full`} accessibilityLabel={consoleCopy.shell.signOut}>
            <Text className="text-[15px] font-medium">{consoleCopy.shell.signOut}</Text>
          </Button>
        </Footer>
      </Aside>
      {/* Brand strip below 840px; the bottom TabBar carries the nav there. */}
      <Header className="flex-row items-center justify-between border-b border-border bg-surface-raised px-4 py-3 min-[840px]:hidden">
        <Link href="/admin/overview" aria-label={consoleCopy.shell.brandLabel} className="no-underline">
          <BrandWordmark height={26} decorative />
        </Link>
      </Header>
      <Main className="flex-1 gap-6 px-4 pb-28 pt-6 min-[840px]:pb-10 min-[840px]:pl-[18rem] min-[840px]:pr-8 min-[840px]:pt-8 min-[1200px]:pl-[22rem]">
        <Heading level={1} className="font-display text-2xl leading-[30px]">{heading}</Heading>
        {children}
      </Main>
      <Section className="fixed inset-x-0 bottom-0 z-40 min-[840px]:hidden" testID="console-tabbar">
        <TabBar tabs={tabs} tone="royal" semantics="navigation" />
      </Section>
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} closeLabel="Close" title={consoleCopy.nav.more} scheme="system" testID="console-more-sheet">
        <Nav aria-label="More sections" className="gap-1 pb-4">
          <List className="gap-1">
            {visibleMoreLinks.map(([href, key]) => (
              <ListItem key={key}>
                <Link href={href} aria-current={key === section ? 'page' : undefined} onPress={() => setMoreOpen(false)} className={navItem(key === section)} testID={`console-more-${key}`}>{consoleCopy.nav[key]}</Link>
              </ListItem>
            ))}
            <ListItem>
              <Button onPress={() => void signOut()} className={`${navItem(false)} w-full`} accessibilityLabel={consoleCopy.shell.signOut}>
                <Text className="text-[15px] font-medium">{consoleCopy.shell.signOut}</Text>
              </Button>
            </ListItem>
          </List>
        </Nav>
      </BottomSheet>
      <Toaster />
    </Page>
  );
}

export function ConsoleNavFallback() { return <Nav aria-label="Console"><BrandWordmark height={32} /></Nav>; }
export function ConsoleLogo() { return <BrandWordmark height={40} />; }
