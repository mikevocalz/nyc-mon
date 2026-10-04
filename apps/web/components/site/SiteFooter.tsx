'use client';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { NAV_ITEMS, PROFILE } from './nav';

// The footer is a system map of the template, not decoration: every column
// states something true — the pages that exist, the tools that run, the
// stack underneath.
const TOOLKIT = [
  { label: 'Storybook', href: 'http://localhost:6006' },
  { label: 'Payload admin', href: '/admin' },
  { label: 'README', href: 'https://github.com' },
] as const;

const STACK = ['Expo SDK 57', 'Next.js 16', 'Solito 5', 'Uniwind 1', 'TanStack', 'Payload 4'] as const;

const footerLink =
  'text-sm text-text-muted transition-colors duration-fast hover:text-text ' +
  'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50';

export function SiteFooter() {
  const pathname = usePathname() ?? '/';
  if (pathname === '/' || pathname.startsWith('/spatial')) return null;

  return (
    <Footer className="border-t-2 border-border bg-surface-sunken">
      <View className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        {/* Brand */}
        <View className="max-w-xs gap-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-card">
              <TWText className="text-base font-bold text-on-primary">S</TWText>
            </View>
            <TWText className="font-display text-lg font-bold tracking-tight text-text">
              Starter
            </TWText>
          </View>
          <P className="text-sm leading-relaxed text-text-muted">
            One codebase for iOS, Android, and the web — screens shared through
            Solito, styled by one token system.
          </P>
        </View>

        {/* Columns */}
        <View className="flex-row flex-wrap gap-10 md:gap-16">
          <Nav aria-label="Pages" className="min-w-28 gap-2.5">
            <TWText className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Pages
            </TWText>
            {[...NAV_ITEMS, PROFILE].map((item) => (
              <Link key={item.href} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <Nav aria-label="Toolkit" className="min-w-28 gap-2.5">
            <TWText className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Toolkit
            </TWText>
            {TOOLKIT.map((item) => (
              <Link key={item.label} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <View className="min-w-28 gap-2.5">
            <TWText className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Stack
            </TWText>
            {STACK.map((item) => (
              <TWText key={item} className="text-sm text-text-muted">
                {item}
              </TWText>
            ))}
          </View>
        </View>
      </View>

      {/* Legal bar */}
      <View className="border-t-2 border-border">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <TWText className="text-xs text-text-muted">© NYC Mon</TWText>
          <TWText className="text-xs text-text-muted">MIT licensed — make it yours.</TWText>
        </View>
      </View>
    </Footer>
  );
}
