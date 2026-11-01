'use client';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInstance } from '@acme/ui';

/**
 * §4 data layer defaults — one QueryClient per app, composed in each app's
 * providers. Server state lives HERE, never in Zustand.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,          // sensible default for slowly-changing data
        gcTime: 30 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false, // deliberate refresh via invalidation
      },
      mutations: { retry: 0 },       // mutations surface errors, never silently retry
    },
  });
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  // Stable per-tree instance (repo rule: no React useState).
  const client = useInstance(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
