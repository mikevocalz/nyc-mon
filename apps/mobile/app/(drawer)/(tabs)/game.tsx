// Thin route: the feature owns the screen. GameTab opens the lobby first and
// mounts GameScreen once START has resumed (directive §3). The route passes
// tab focus so leaving the tab cancels held input (review finding M19).
import { useIsFocused } from 'expo-router';
import { GameTab } from '@acme/app/features/game/GameTab.tsx';

export default function GameRoute() {
  return <GameTab focused={useIsFocused()} />;
}
