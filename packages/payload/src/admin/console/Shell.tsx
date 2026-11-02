'use client';
import { type ReactNode, useEffect } from 'react';
import { useAuth, useConfig, usePathname, useRouter, useTheme } from '@payloadcms/ui';
import { BottomSheet, BrandWordmark, TabBar, Toaster, type TabBarTab } from '@acme/ui/admin';
import { Aside, Button, Heading, Link, List, ListItem, Main, Nav, Page, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
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

type NavSection = Exclude<keyof typeof consoleCopy.nav, 'more' | 'websitePages' | 'websiteMedia'>;
type WebsitePage = 'pages' | 'media';

const websitePages = [
  ['/admin/collections/site-pages', 'pages', 'websitePages'], ['/admin/collections/media', 'media', 'websiteMedia'],
] as const;

/** The Website item's own pages, set under it while the Website section is open. */
function WebsiteSubnav({ current, onNavigate, testPrefix }: { current?: WebsitePage; onNavigate?: () => void; testPrefix: string }) {
  return (
    <List aria-label={consoleCopy.nav.website} className="gap-1 border-l border-border ml-6 pl-2">
      {websitePages.map(([href, key, label]) => (
        <ListItem key={key}>
          <Link href={href} aria-current={key === current ? 'page' : undefined} onPress={onNavigate} className={subItem(key === current)} testID={`${testPrefix}-website-${key}`}>{consoleCopy.nav[label]}</Link>
        </ListItem>
      ))}
    </List>
  );
}

const subItem = (active: boolean) =>
  `flex min-h-11 flex-row items-center px-3 text-[14px] no-underline ${
    active ? 'font-semibold text-text bg-surface-sunken' : 'font-medium text-text-secondary hover:bg-surface-sunken hover:text-text'
  }`;

/**
 * The console's navigation: the sidebar from 840px, the brand strip and
 * bottom TabBar with its More sheet below. ConsoleShell renders it around the
 * console's own views; ConsoleEditorNav renders the same component in
 * Payload's Nav slot around the native Website editor views, so both halves of
 * the admin share one set of items, one active treatment and one sign-out.
 */
export function ConsoleNav({ section, websitePage }: { section: NavSection; websitePage?: WebsitePage }) {
  const router = useRouter();
  const {config} = useConfig();
  const {user} = useAuth();
  const websiteEnabled = config.collections.some(collection => collection.slug === 'site-pages') && ['ops', 'content'].includes(String(user?.role));
  const visibleLinks = links.filter(([,key]) => key !== 'website' || websiteEnabled);
  const visibleMoreLinks = moreLinks.filter(([,key]) => key !== 'website' || websiteEnabled);
  const moreOpen = useShellStore((state) => state.moreOpen);
  const setMoreOpen = useShellStore((state) => state.setMoreOpen);
  const signOut = async () => {
    try { await consoleAuth().signOut(); } catch { /* a failed sign-out still lands on the login screen */ }
    router.push('/admin/login');
  };
  // In the Website section the section item marks the section and the sub
  // item marks the page, so only one link per list says aria-current="page".
  const current = (key: NavSection) => key !== section ? undefined : key === 'website' && websitePage ? 'true' : 'page';
  const tabs: TabBarTab[] = [
    { key: 'overview', label: consoleCopy.nav.overview, href: '/admin/overview', icon: icon(Home, 'OverviewIcon'), active: section === 'overview' },
    { key: 'callers', label: consoleCopy.nav.callers, href: '/admin/callers', icon: icon(Users, 'CallersIcon'), active: section === 'callers' },
    { key: 'consent', label: consoleCopy.nav.consent, href: '/admin/consent', icon: icon(ShieldCheck, 'ConsentIcon'), active: section === 'consent' },
    { key: 'mons', label: consoleCopy.nav.mons, href: '/admin/mons', icon: icon(Box, 'MonsIcon'), active: section === 'mons' },
    { key: 'more', label: consoleCopy.nav.more, icon: icon(MoreHorizontal, 'MoreIcon'), onPress: () => setMoreOpen(true), active: visibleMoreLinks.some(([, key]) => key === section) },
  ];
  return (
    <>
      {/* Sidebar: 16rem from 840px, 20rem from 1200px (03-direction.md pane tokens). */}
      <Aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface-raised min-[840px]:flex min-[1200px]:w-80" testID="console-nav">
        {/* Plain blocks, not header/footer: inside an aside they are not landmarks, and the editor's Payload header is the page's one banner. */}
        <View className="border-b border-border px-5 py-5">
          <Link href="/admin/overview" aria-label={consoleCopy.shell.brandLabel} className="self-start no-underline">
            <BrandWordmark height={40} decorative />
          </Link>
        </View>
        <Nav aria-label="Console" className="flex-1 gap-1 overflow-y-auto px-3 py-4">
          <List className="gap-1">
            {visibleLinks.map(([href, key]) => (
              <ListItem key={key} className="gap-1">
                <Link href={href} aria-current={current(key)} className={navItem(key === section)} testID={`console-nav-${key}`}>{consoleCopy.nav[key]}</Link>
                {key === 'website' && section === 'website' ? <WebsiteSubnav current={websitePage} testPrefix="console-nav" /> : null}
              </ListItem>
            ))}
          </List>
        </Nav>
        <View className="border-t border-border px-3 py-3">
          <Button onPress={() => void signOut()} className={`${navItem(false)} w-full`} accessibilityLabel={consoleCopy.shell.signOut}>
            <Text className="text-[15px] font-medium">{consoleCopy.shell.signOut}</Text>
          </Button>
        </View>
      </Aside>
      {/* Brand strip below 840px; the bottom TabBar carries the nav there. A nav, not a header: in the editor Payload's own header is the page's banner. */}
      <Nav aria-label={consoleCopy.shell.brandLabel} className="flex-row items-center justify-between border-b border-border bg-surface-raised px-4 py-3 min-[840px]:hidden">
        <Link href="/admin/overview" aria-label={consoleCopy.shell.brandLabel} className="no-underline">
          <BrandWordmark height={26} decorative />
        </Link>
      </Nav>
      {/* The kit TabBar's own root is not a landmark on web, so this nav is. */}
      <Nav aria-label={consoleCopy.shell.sectionsLabel} className="fixed inset-x-0 bottom-0 z-40 min-[840px]:hidden" testID="console-tabbar">
        <TabBar tabs={tabs} tone="royal" semantics="navigation" />
      </Nav>
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} closeLabel="Close" title={consoleCopy.nav.more} scheme="system" testID="console-more-sheet">
        <Nav aria-label="More sections" className="gap-1 pb-4">
          <List className="gap-1">
            {visibleMoreLinks.map(([href, key]) => (
              <ListItem key={key} className="gap-1">
                <Link href={href} aria-current={current(key)} onPress={() => setMoreOpen(false)} className={navItem(key === section)} testID={`console-more-${key}`}>{consoleCopy.nav[key]}</Link>
                {key === 'website' && section === 'website' ? <WebsiteSubnav current={websitePage} onNavigate={() => setMoreOpen(false)} testPrefix="console-more" /> : null}
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
    </>
  );
}

const schemeClass = (appearance: string) => appearance === 'night' ? 'scheme-dark' : appearance === 'daylit' ? 'scheme-light' : '';

export function ConsoleShell({ section, heading, children }: { section: NavSection; heading: string; children: ReactNode }) {
  const appearance = useShellStore((state) => state.appearance);
  return (
    <Page className={`nycmon-console min-h-dvh bg-bg font-sans text-text ${schemeClass(appearance)}`} testID="console-root">
      <ConsoleNav section={section} />
      <Main className="flex-1 gap-6 px-4 pb-28 pt-6 min-[840px]:pb-10 min-[840px]:pl-[18rem] min-[840px]:pr-8 min-[840px]:pt-8 min-[1200px]:pl-[22rem]">
        <Heading level={1} className="font-display text-2xl leading-[30px]">{heading}</Heading>
        {children}
      </Main>
      <Toaster />
    </Page>
  );
}

/**
 * Payload's `admin.components.Nav` while the Website editor is on: the
 * console's own navigation around Payload's native list, edit, version and
 * upload views, so the editor keeps every Payload feature (drafts, preview,
 * publish, versions, restore) inside the console's frame. Its root is a
 * `.nycmon-console` element, so the console stylesheet applies; editor.css
 * places it in Payload's template grid and themes the views beside it.
 *
 * The console's appearance pin (Settings → Appearance) is carried over to
 * Payload's own theme, which the editor's colours key off (`html[data-theme]`).
 */
export function ConsoleEditorNav() {
  const pathname = usePathname() ?? '';
  const appearance = useShellStore((state) => state.appearance);
  const { autoMode, setTheme, theme } = useTheme();
  useEffect(() => {
    const wanted = appearance === 'night' ? 'dark' : appearance === 'daylit' ? 'light' : 'auto';
    if (wanted === 'auto' ? !autoMode : autoMode || theme !== wanted) setTheme(wanted);
  }, [appearance, autoMode, setTheme, theme]);
  const websitePage: WebsitePage = /\/collections\/media(\/|$)/.test(pathname) ? 'media' : 'pages';
  return (
    <View className={`nycmon-console nycmon-editor-nav z-40 font-sans text-text ${schemeClass(appearance)}`} testID="console-editor-nav">
      <ConsoleNav section="website" websitePage={websitePage} />
    </View>
  );
}

export function ConsoleNavFallback() { return <Nav aria-label="Console"><BrandWordmark height={32} /></Nav>; }
export function ConsoleLogo() { return <BrandWordmark height={40} />; }
