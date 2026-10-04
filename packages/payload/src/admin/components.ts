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
  views: {
    // SPIKE (blocker X3): proves @acme/ui renders in a Payload root view.
    // Replaced by the real `overview` → OverviewView (08-handoff.md §3).
    overview: {
      Component: './admin/console/OverviewSpike#OverviewSpike',
      path: '/overview',
      exact: true,
    },
  },
};
