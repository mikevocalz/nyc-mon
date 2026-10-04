'use client';
/**
 * The kit's adaptive split view (`@acme/ui/adaptive-panes`) bound to
 * expo-router: the detail pane renders the route under the layout (`<Slot />`)
 * and Android hardware Back asks the router whether the detail stack can pop.
 * Android and web use this; iOS uses expo-router's native SplitView.
 *
 * `paneControls` defaults to false here because the split layout mounts its
 * own PaneToggles in its header.
 *
 * The statics are the kit's own marker components, so `SplitView.Column` keeps
 * the identity the host matches children against.
 */
import { Slot, router } from 'expo-router';
import { SplitView as KitSplitView, type SplitViewProps } from '@acme/ui/adaptive-panes';
import './pane-storage';

function routerCanGoBack(): boolean {
  return router.canGoBack();
}

function RoutedSplitView({ detail, canGoBack, paneControls, ...props }: SplitViewProps) {
  return (
    <KitSplitView
      {...props}
      detail={detail ?? <Slot />}
      canGoBack={canGoBack ?? routerCanGoBack}
      paneControls={paneControls ?? false}
    />
  );
}

export const SplitView = Object.assign(RoutedSplitView, {
  Column: KitSplitView.Column,
  Inspector: KitSplitView.Inspector,
});
