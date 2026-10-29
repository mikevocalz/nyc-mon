import { SettingsGlass } from '@acme/app/features/settings/SettingsGlass.tsx';

/**
 * Settings from the H-Lynk menu, on the persistent 3D H-Lynk (the 2D page is
 * its reduced-motion / no-GPU fallback). Inside `(home)`, so the stage stays
 * mounted and nothing reloads.
 */
export default SettingsGlass;
