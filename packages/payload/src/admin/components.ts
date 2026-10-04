// Custom admin console seam (docs/adr/0003-admin-app-split.md).
//
// The NYC-MON admin is a custom console built from @acme/ui, the way DVNT
// replaces its dashboard (dvnt-monorepo packages/cms/src/payload.config.ts,
// admin.components) and MoyoLearn brands Logo/Icon. Its components register
// here and nowhere else, so payload.config.ts stays a list of collections.
//
// Component paths resolve against `admin.importMap.baseDir`, which is this
// package's src/ directory: './admin/console/ConsoleHome#ConsoleHome' points at
// packages/payload/src/admin/console/ConsoleHome.tsx. After any change, run
// `pnpm --filter admin-vite payload:importmap` or the admin renders a blank
// slot ("PayloadComponent not found").
//
// The payload-better-auth plugin spreads this object and then sets
// `views.login` and `logout.Button` itself (src/plugin/index.ts,
// injectAdminComponents). A branded login view goes through the plugin's
// `admin.loginViewComponent` option, not here, and `beforeLogin` entries never
// render while the plugin's login view replaces Payload's.
import type { Config } from 'payload';

type AdminComponents = NonNullable<NonNullable<Config['admin']>['components']>;

export const adminComponents: AdminComponents = {
  graphics: {
    Logo: './admin/console/Shell#ConsoleLogo',
    Icon: './admin/console/Chrome#ConsoleIcon',
  },
  Nav: './admin/console/Shell#ConsoleNavFallback',
  views: {
    dashboard: { Component: './admin/console/Redirects#DashboardRedirect' },
    account: { Component: './admin/console/Redirects#AccountRedirect' },
    overview: { Component: './admin/console/views/Views#OverviewView', path: '/overview', exact: true },
    callers: { Component: './admin/console/views/Views#CallersView', path: '/callers/:callerId?' },
    consent: { Component: './admin/console/views/Views#ConsentView', path: '/consent/:consentId?' },
    mons: { Component: './admin/console/views/Views#MonsView', path: '/mons/:monInstanceId?' },
    eggs: { Component: './admin/console/views/Views#MonsView', path: '/eggs/:eggId?' },
    integrity: { Component: './admin/console/views/Views#MonsView', path: '/integrity', exact: true },
    content: { Component: './admin/console/views/Views#ContentView', path: '/content/:rest*' },
    audit: { Component: './admin/console/views/Views#AuditView', path: '/audit/:eventId?' },
    settings: { Component: './admin/console/views/Views#SettingsView', path: '/settings/:rest*' },
  },
};
