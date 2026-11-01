// Thin route: the feature owns the screen (G03 game-control settings).
// Imported by path, not from the @acme/app index, so web never bundles the
// controller preview's renderer. Reached from the "Game controls" row in
// Settings.
import { ControlsSettingsScreen } from '@acme/app/features/game/controls-settings/ControlsSettingsScreen.tsx';

export default ControlsSettingsScreen;
