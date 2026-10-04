'use client';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { BrandLogo } from '@acme/ui';
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
    <Footer className="border-t-2 border-structure/60 bg-surface-sunken">
      <View className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        {/* Brand */}
        <View className="max-w-xs gap-3">
          <View className="flex-row items-center gap-3">
            <BrandLogo size={88} />
            <TWText className="font-display text-xl tracking-tight text-primary">
              NYC-MON
            </TWText>
          </View>
          <TWText className="text-base font-semibold text-text">Every block has a legend.</TWText>
          <P className="text-sm leading-relaxed text-text-muted">
            One codebase for iOS, Android and the web, with screens shared
            through Solito and styled by one token system.
          </P>
        </View>

        {/* Columns */}
        <View className="flex-row flex-wrap gap-10 md:gap-16">
          <Nav aria-label="Pages" className="min-w-28 gap-2.5">
            <TWText className="text-sm font-semibold text-accent">
              Pages
            </TWText>
            {[...NAV_ITEMS, PROFILE].map((item) => (
              <Link key={item.href} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <Nav aria-label="Toolkit" className="min-w-28 gap-2.5">
            <TWText className="text-sm font-semibold text-accent">
              Toolkit
            </TWText>
            {TOOLKIT.map((item) => (
              <Link key={item.label} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <View className="min-w-28 gap-2.5">
            <TWText className="text-sm font-semibold text-accent">
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
      <View className="border-t border-structure/30">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <TWText className="text-xs text-text-muted">© NYC-MON</TWText>
          <TWText className="text-xs text-text-muted">MIT licensed. Make it yours.</TWText>
        </View>
      </View>
    </Footer>
  );
}
