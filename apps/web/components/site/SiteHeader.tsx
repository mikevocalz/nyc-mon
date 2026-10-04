'use client';
import { useEffect } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { create } from 'zustand';
import { Header, Nav, Pressable, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, BrandWordmark, MotionView, useHydrated } from '@acme/ui';
import { AVATAR_URI, useProfile } from '@acme/app';
import { NAV_ITEMS, PROFILE, useMobileMenu } from './nav';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);



// Scroll elevation — zustand always (repo rule).
const useScrolled = create<{ scrolled: boolean; set: (scrolled: boolean) => void }>((set) => ({
  scrolled: false,
  set: (scrolled) => set({ scrolled }),
}));

// Sliding active indicator (dvnt GlassHeader pattern): every desktop link
// self-measures against the Nav container; ONE absolutely-positioned bar
// springs to the active link's x/width instead of remounting per route.
const useNavMetrics = create<{
  metrics: Record<string, { x: number; width: number }>;
  measure: (href: string, x: number, width: number) => void;
}>((set) => ({
  metrics: {},
  measure: (href, x, width) =>
    set((s) =>
      s.metrics[href]?.x === x && s.metrics[href]?.width === width
        ? s
        : { metrics: { ...s.metrics, [href]: { x, width } } },
    ),
}));

const linkEls = new Map<string, HTMLElement>();

const measureAll = () => {
  for (const [href, el] of linkEls) {
    useNavMetrics.getState().measure(href, el.offsetLeft, el.offsetWidth);
  }
};

function DesktopNavLink({
  href, label, active, index,
}: {
  href: string; label: string; active: boolean; index: number;
}) {
  const hydrated = useHydrated();
  return (
    <MotionView
      initial={hydrated ? { y: -10 } : undefined}
      animate={hydrated ? { y: 0 } : undefined}
      transition={{ type: 'timing', duration: 260, ease: 'easeOut', delay: 120 + index * 50 }}
    >
      <Link
        href={href}
        ref={(el) => {
          if (el) {
            linkEls.set(href, el);
            useNavMetrics.getState().measure(href, el.offsetLeft, el.offsetWidth);
          } else {
            linkEls.delete(href);
          }
        }}
        aria-current={active ? 'page' : undefined}
        className={`rounded-none px-3.5 py-2 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          active ? 'bg-primary font-semibold text-on-primary' : 'text-text-muted hover:bg-surface-sunken hover:text-text'
        }`}
      >
        {label}
      </Link>
    </MotionView>
  );
}

function NavIndicator({ pathname }: { pathname: string }) {
  const hydrated = useHydrated();
  const metrics = useNavMetrics((s) => s.metrics);
  const activeItem = NAV_ITEMS.find((item) => isActive(pathname, item.href));
  const m = activeItem ? metrics[activeItem.href] : undefined;

  // Measurement-driven — meaningless during SSR and a hydration-mismatch
  // source; render client-side only.
  if (!hydrated) return null;
  return (
    <MotionView
      aria-hidden
      animate={{ x: m?.x ?? 0, width: m?.width ?? 0, opacity: m ? 1 : 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 180, mass: 0.6 }}
      className="absolute -bottom-3 left-0 h-[3px] w-0 rounded-none bg-accent"
    />
  );
}

function MobileNavLink({
  href, label, active, index, onNavigate,
}: {
  href: string; label: string; active: boolean; index: number; onNavigate: () => void;
}) {
  const hydrated = useHydrated();
  return (
    <MotionView
      initial={hydrated ? { x: -12 } : undefined}
      animate={hydrated ? { x: 0 } : undefined}
      transition={{ type: 'timing', duration: 200, ease: 'easeOut', delay: 60 + index * 40 }}
    >
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center justify-between rounded-none px-4 py-3.5 text-base font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          active ? 'bg-primary font-semibold text-on-primary' : 'text-text hover:bg-surface-sunken'
        }`}
      >
        {label}
        {active ? <TWText className="text-xs text-accent">●</TWText> : null}
      </Link>
    </MotionView>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { open, toggle, close } = useMobileMenu();
  const scrolled = useScrolled((s) => s.scrolled);
  const hydrated = useHydrated();
  const name = useProfile((s) => s.name);
  const handle = useProfile((s) => s.handle);
  const profileActive = isActive(pathname, PROFILE.href);
  const gridChrome = pathname === '/' || pathname.startsWith('/spatial');

  useEffect(() => {
    const onScroll = () => useScrolled.getState().set(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measureAll, { passive: true });
    // Re-measure once fonts settle — widths shift when the display/sans fonts load.
    document.fonts?.ready.then(measureAll).catch(() => {});
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measureAll);
    };
  }, []);

  if (gridChrome) return null;

  return (
    <Header
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-base motion-reduce:transition-none ${
        scrolled ? 'border-structure/50 bg-surface/95 shadow-card' : 'border-structure/30 bg-surface/80'
      }`}
    >
      {/* Load choreography: the bar settles first, then logo, then links. */}
      <MotionView
        key={hydrated ? 'ready' : 'ssr'}
        initial={hydrated ? { y: -16 } : undefined}
        animate={hydrated ? { y: 0 } : undefined}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        {/* Logo — left */}
        <Link
          href="/"
          onClick={close}
          aria-label="NYC-MON home"
          className="flex items-center gap-2.5 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <MotionView
            initial={hydrated ? { scale: 0.8 } : undefined}
            animate={hydrated ? { scale: 1 } : undefined}
            transition={{ type: 'spring', damping: 15, stiffness: 320, delay: 60 }}
          >
            {/* The wordmark carries the name, so no text label sits beside it. */}
            <BrandWordmark height={40} />
          </MotionView>
        </Link>

        {/* Nav + avatar — right */}
        <View className="flex-row items-center gap-3">
          <Nav aria-label="Primary" className="relative hidden flex-row items-center gap-1 md:flex">
            {NAV_ITEMS.map((item, index) => (
              <DesktopNavLink key={item.href} {...item} index={index} active={isActive(pathname, item.href)} />
            ))}
            <NavIndicator pathname={pathname} />
          </Nav>

          {/* Profile — a face, not a word; settings live inside */}
          <MotionView
            initial={hydrated ? { scale: 0.6 } : undefined}
            animate={hydrated ? { scale: 1 } : undefined}
            transition={{ type: 'spring', damping: 16, stiffness: 300, delay: 280 }}
          >
            <Link
              href={PROFILE.href}
              aria-label="Your profile and settings"
              aria-current={profileActive ? 'page' : undefined}
              className={`rounded-none transition-shadow duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                profileActive
                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
                  : 'hover:ring-2 hover:ring-border-strong'
              }`}
            >
              <Avatar name={name} imageUri={AVATAR_URI} size="md" />
            </Link>
          </MotionView>

          {/* Mobile menu button */}
          <Pressable
            role="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onPress={toggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-none border-2 border-border transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:opacity-80 md:hidden"
          >
            <TWText className="text-xl leading-none text-text">{open ? '✕' : '☰'}</TWText>
          </Pressable>
        </View>
      </MotionView>

      {/* Mobile menu — overlay sheet; never pushes page content.
          NOTE: no AnimatePresence here — Legend's presence wrapper freezes
          enter animations in this tree; conditional mount + entrance presets
          are the proven path (exit animation traded for reliability). */}
      {open ? (
        <>
          <MotionView
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 160 }}
            className="fixed inset-x-0 top-0 h-screen bg-ink-950/50 backdrop-blur-[2px] md:hidden"
          >
            <Pressable role="button" aria-label="Close menu" onPress={close} className="h-full w-full cursor-default" />
          </MotionView>
          <MotionView
            initial={{ y: -12 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 380 }}
            className="absolute inset-x-0 top-full rounded-none border-b-2 border-structure/50 bg-surface shadow-raised md:hidden"
          >
            {/* Identity row — profile anchors the menu; settings live inside it */}
            <MotionView
              initial={{ x: -12 }}
              animate={{ x: 0 }}
              transition={{ type: 'timing', duration: 200, ease: 'easeOut', delay: 20 }}
            >
              <Link
                href={PROFILE.href}
                onClick={close}
                aria-current={profileActive ? 'page' : undefined}
                className={`mx-3 mt-3 flex items-center gap-3 rounded-none px-3 py-3 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  profileActive ? 'bg-surface-sunken' : 'hover:bg-surface-sunken'
                }`}
              >
                <Avatar name={name} imageUri={AVATAR_URI} size="lg" />
                <View className="flex-1 gap-0.5">
                  <TWText className="text-base font-semibold text-text">{name}</TWText>
                  <TWText className="text-sm text-text-muted">{handle}, profile and settings</TWText>
                </View>
                <TWText className="text-lg text-text-muted">›</TWText>
              </Link>
            </MotionView>

            <View className="mx-6 my-2 h-px bg-border/60" />

            <Nav aria-label="Primary" id="mobile-menu" className="gap-1 px-3 pb-4">
              {NAV_ITEMS.map((item, index) => (
                <MobileNavLink
                  key={item.href}
                  {...item}
                  index={index}
                  active={isActive(pathname, item.href)}
                  onNavigate={close}
                />
              ))}
            </Nav>
          </MotionView>
        </>
      ) : null}
    </Header>
  );
}
