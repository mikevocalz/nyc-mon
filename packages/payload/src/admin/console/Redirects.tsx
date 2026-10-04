import type { AdminViewServerProps } from 'payload';

export function DashboardRedirect({ initPageResult }: AdminViewServerProps) {
  initPageResult.req.server?.redirect('/admin/overview');
  return null;
}

export function AccountRedirect({ initPageResult }: AdminViewServerProps) {
  initPageResult.req.server?.redirect('/admin/settings');
  return null;
}

interface CollectionRedirectProps {
  initPageResult?: AdminViewServerProps['initPageResult'];
  clientProps?: { to?: string };
  params?: Promise<{ segments?: string[]; id?: string }>;
}

export async function CollectionRedirect({ initPageResult, clientProps, params }: CollectionRedirectProps) {
  const routeParams = await params;
  const id = routeParams?.id ?? routeParams?.segments?.[0];
  const base = clientProps?.to ?? '/admin/overview';
  const destination = base === '/admin/callers' && id ? `${base}/${encodeURIComponent(id)}` : base;
  initPageResult?.req.server?.redirect(destination);
  return null;
}
