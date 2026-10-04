'use client';
import type { ReactNode } from 'react';
import { BrandWordmark, Toaster } from '@acme/ui/admin';
import { Aside, Heading, Link, Main, Nav, Page } from '@acme/ui/html';
import { consoleCopy } from './copy';
import { useShellStore } from './stores';

const links = [
  ['/admin/overview', 'overview'], ['/admin/callers', 'callers'], ['/admin/consent', 'consent'],
  ['/admin/mons', 'mons'], ['/admin/content', 'content'], ['/admin/audit', 'audit'], ['/admin/settings', 'settings'],
] as const;

export function ConsoleShell({ section, heading, children }: { section: keyof typeof consoleCopy.nav; heading: string; children: ReactNode }) {
  const appearance = useShellStore((state) => state.appearance);
  return (
    <Page className={`nycmon-console min-h-dvh bg-bg text-text ${appearance === 'night' ? 'scheme-dark' : ''}`} testID="console-root">
      <Aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-border bg-surface-raised p-5 lg:flex" testID="console-nav">
        <BrandWordmark height={24} />
        <Nav aria-label="Console" className="mt-8 gap-2">
          {links.map(([href, key]) => <Link key={key} href={href} aria-current={key === section ? 'page' : undefined} className="min-h-11 px-3 py-2" testID={`console-nav-${key}`}>{consoleCopy.nav[key]}</Link>)}
        </Nav>
      </Aside>
      <Main className="mx-auto w-full max-w-6xl gap-6 p-4 lg:pl-64 lg:pr-8">
        <Heading level={1} className="font-display text-3xl">{heading}</Heading>
        {children}
      </Main>
      <Toaster />
    </Page>
  );
}

export function ConsoleNavFallback() { return <Nav aria-label="Console"><BrandWordmark height={24} /></Nav>; }
export function ConsoleLogo() { return <BrandWordmark height={32} />; }
