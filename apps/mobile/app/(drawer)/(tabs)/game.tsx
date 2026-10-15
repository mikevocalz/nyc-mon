// Thin route: the feature owns the screen. PR 1 of #29 (native shell) may move
// this into the canon HOME | GAME | H-LYNK | MONS | CALLER tab set.
// Imported by path, not from the @acme/app index, so web never bundles the renderer.
import { GameScreen } from '@acme/app/features/game/GameScreen.tsx';

export default GameScreen;
