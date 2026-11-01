import { HubScreen } from '@acme/app/features/hub/HubScreen.tsx';

/**
 * `/home`: HOME, the canon's first tab (the hub). It sits in `(tabs)` beside
 * Game and Caller, not in `(home)`, so no H-Lynk stage renders hidden under it;
 * the H-Lynk entry opens `(home)` itself.
 */
export default HubScreen;
