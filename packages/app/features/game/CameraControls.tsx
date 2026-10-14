// Visible, labelled alternatives to every camera gesture (WCAG 2.5.1 pointer
// gestures: drag, pinch and twist each have a single-tap equivalent). Same
// CameraCommand -> moveCityCamera path as the accessibility actions on the
// world view, so the three input routes cannot drift apart.
//
// Structure refs (Mobbin, structure only): Tripadvisor 3D map
// (https://mobbin.com/screens/19f3c852-67e1-4d0c-8161-312ad653c3b8) and
// Mindtrip map (https://mobbin.com/screens/0fde4920-4094-4ee6-81f9-48bf5826a617)
// stack round camera actions on one edge; Tolan's 3D world
// (https://mobbin.com/screens/9074f01e-a68c-481c-8307-20db0f86afd4) keeps its
// single recentre action low on the trailing side.
import { IconButton } from '@acme/ui';
import { ChevronDown, ChevronLeft, ChevronRight, Compass, Minus, Navigation, Plus, Redo2, Undo2 } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import { useStore } from 'zustand';
import { commandToAction, headingDegrees, type CameraCommand } from './camera-input.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from './game-session.ts';
import type { GameHudLayout } from './hud-layout.ts';

const run = (command: CameraCommand) => {
  const { camera, move } = gameCameraStore.getState();
  move(commandToAction(command, camera));
};

/** Harlem tone: the bundled tile is Harlem, so the HUD takes that district's control colour. */
const DISTRICT = 'harlem' as const;

function CompassButton() {
  // Whole degrees only, so a drag re-renders this one button at most ~360 times a turn, not per event.
  const heading = useStore(gameCameraStore, (s) => Math.round(headingDegrees(s.camera)));
  return (
    <IconButton
      district={DISTRICT}
      aria-label={heading === 0 ? 'Reset view. Facing north' : `Reset view. Facing ${heading} degrees from north`}
      // Computed: the needle counter-rotates by the live heading so it keeps pointing north.
      icon={<View style={{ transform: [{ rotate: `${-heading}deg` }] }}><Compass size={22} /></View>}
      onPress={() => run('reset')}
    />
  );
}

export function CameraControls({ layout }: { layout: Pick<GameHudLayout, 'controls' | 'movePad'> }) {
  const movePadOpen = useStore(gameScreenStore, (s) => s.movePadOpen);
  const { controls, movePad } = layout;
  const flexDirection = controls.axis === 'vertical' ? 'flex-col' : 'flex-row';
  return (
    <>
      <View
        role="toolbar"
        aria-label="Camera"
        className={`absolute gap-2 ${flexDirection}`}
        // Computed: position comes from resolveGameHudLayout (hinge-safe region).
        style={{ left: controls.x, top: controls.y }}
      >
        <IconButton district={DISTRICT} aria-label="Zoom in" icon={<Plus size={22} />} onPress={() => run('zoomIn')} />
        <IconButton district={DISTRICT} aria-label="Zoom out" icon={<Minus size={22} />} onPress={() => run('zoomOut')} />
        <IconButton district={DISTRICT} aria-label="Turn view left" icon={<Undo2 size={22} />} onPress={() => run('rotateLeft')} />
        <IconButton district={DISTRICT} aria-label="Turn view right" icon={<Redo2 size={22} />} onPress={() => run('rotateRight')} />
        <CompassButton />
        <IconButton
          district={DISTRICT}
          variant="outline"
          aria-label={movePadOpen ? 'Hide move buttons' : 'Show move buttons'}
          icon={<Navigation size={22} />}
          onPress={gameScreenActions.toggleMovePad}
        />
      </View>
      {movePadOpen && movePad ? (
        <View
          role="toolbar"
          aria-label="Move"
          className="absolute"
          // Computed: pad rect from resolveGameHudLayout; never crosses a fold.
          style={{ left: movePad.x, top: movePad.y, width: movePad.width, height: movePad.height }}
        >
          {/* 3x3 grid, arms only. Directions are physical map directions; RTL does not mirror them. */}
          <View className="flex-row justify-center">
            <IconButton district={DISTRICT} aria-label="Move forward" icon={<View className="rotate-180"><ChevronDown size={22} /></View>} onPress={() => run('moveForward')} />
          </View>
          <View className="flex-row justify-between">
            <IconButton district={DISTRICT} aria-label="Move left" icon={<ChevronLeft size={22} />} onPress={() => run('moveLeft')} />
            <IconButton district={DISTRICT} aria-label="Move right" icon={<ChevronRight size={22} />} onPress={() => run('moveRight')} />
          </View>
          <View className="flex-row justify-center">
            <IconButton district={DISTRICT} aria-label="Move back" icon={<ChevronDown size={22} />} onPress={() => run('moveBack')} />
          </View>
        </View>
      ) : null}
    </>
  );
}
