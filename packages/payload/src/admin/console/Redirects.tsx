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
  params?: Promise<{ segments?: string[]; id?: string | number }> | { segments?: string[]; id?: string | number };
  /**
   * `req.server` reaches a custom list view as the `server` prop (the list's
   * serverProps carry no `initPageResult`); document views get both.
   */
  server?: AdminViewServerProps['server'];
}

export async function CollectionRedirect({ initPageResult, clientProps, params, server }: CollectionRedirectProps) {
  const routeParams = await params;
  const id = routeParams?.id ?? initPageResult?.docID;
  const base = clientProps?.to ?? '/admin/overview';
  const destination = base === '/admin/callers' && id !== undefined ? `${base}/${encodeURIComponent(id)}` : base;
  (initPageResult?.req.server ?? server)?.redirect(destination);
  return null;
}
