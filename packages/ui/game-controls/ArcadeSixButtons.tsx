'use client';
// The six-button right cluster (Master Directive v2 §2B): one `right-six`
// Rive artboard (§8) under six ArcadeActionButton touch targets placed by
// sixButtonArch. The cluster owns the view model binding and writes
// `buttons/<id>/state`, `/label` and `/icon` from prop effects, which are
// discrete (a press, a binding change), never per frame.
import { useEffect } from 'react';
import { BUTTON_IDS, type ButtonId, type ButtonVisualState, type ControllerBindings, type Handedness } from './contract.ts';
import { View } from '../tw';
import { testIdProps } from '../hlynk/a11y';
import { ArcadeActionButton } from './ArcadeActionButton.tsx';
import { ArcadeRiveSurface } from './ArcadeRiveSurface';
import type { ArcadeRiveSource } from './ArcadeRiveSurface.types.ts';
import { sixButtonArch } from './six-button-arch.ts';
import { useRiveBinding } from './use-rive-binding.ts';

/** Visual state per cap; a missing id reads as `idle`. */
export type ButtonStates = Partial<Record<ButtonId, ButtonVisualState>>;

/** Props of {@linkcode ArcadeSixButtons}. */
export interface ArcadeSixButtonsProps {
  /** Labels, icons and enabled flags for the six caps; the game's own union behind `action`. */
  readonly bindings: ControllerBindings;
  readonly handedness: Handedness;
  /** {@linkcode ControllerProfile.scale} after the layout resolver clamped it. */
  readonly scale: number;
  /** The Rive `buttons/<id>/state` value per cap, from the controller. */
  readonly states?: ButtonStates;
  readonly reducedMotion: boolean;
  /** The `right-six` artboard. Absent: the six hit areas still work and every write is a no-op. */
  readonly rive?: ArcadeRiveSource;
  /** Show the bound icon rather than the letter when the binding has one ({@linkcode ControllerProfile.showIcons}). */
  readonly showIcons?: boolean;
  /** Spoken names per cap; defaults to each binding's label. */
  readonly spokenLabels?: Partial<Record<ButtonId, string>>;
  readonly onDown: (id: ButtonId, timestampMs: number) => void;
  readonly onUp: (id: ButtonId, timestampMs: number) => void;
  readonly onAccessibilityActivate?: (id: ButtonId) => void;
  readonly testID?: string;
}

const EMPTY_STATES: ButtonStates = {};

/**
 * The `right-six` artboard is the hit box plus this glow margin on every side,
 * in artboard units (right-six/scene.rml). The surface is drawn that much
 * larger than the box so one artboard unit is exactly one dp × scale and each
 * Rive cap sits under its touch target. Drawing the 209 × 204 artboard into
 * the 193 × 188 box would scale it by 0.92 and pull the caps up to 8 dp off
 * their hit circles.
 */
const RIVE_GLOW_MARGIN = 8;

/**
 * Six caps on the -45° arch, top row X Y Z and bottom row A B C, each rising
 * toward the upper right, mirrored for the left hand. The box is 193 × 188 dp
 * at scale 1.
 *
 * @see {@linkcode sixButtonArch} for the geometry and {@linkcode ArcadeActionButton} for one cap.
 */
export function ArcadeSixButtons({
  bindings,
  handedness,
  scale,
  states = EMPTY_STATES,
  reducedMotion,
  rive,
  showIcons = false,
  spokenLabels,
  onDown,
  onUp,
  onAccessibilityActivate,
  testID,
}: ArcadeSixButtonsProps) {
  const arch = sixButtonArch({ scale, handedness });
  const glow = RIVE_GLOW_MARGIN * arch.scale;

  const binding = useRiveBinding((b) => {
    for (const id of BUTTON_IDS) {
      const action = bindings[id];
      b.setButtonLabel(id, action.label, showIcons ? action.icon : undefined);
      b.setButtonState(id, states[id] ?? 'idle');
    }
    b.setReducedMotion(reducedMotion);
  });

  useEffect(() => {
    binding.write((b) => {
      for (const id of BUTTON_IDS) {
        const action = bindings[id];
        b.setButtonLabel(id, action.label, showIcons ? action.icon : undefined);
      }
    });
  }, [binding, bindings, showIcons]);

  useEffect(() => {
    binding.write((b) => {
      for (const id of BUTTON_IDS) b.setButtonState(id, states[id] ?? 'idle');
    });
  }, [binding, states]);

  useEffect(() => {
    binding.write((b) => b.setReducedMotion(reducedMotion));
  }, [binding, reducedMotion]);

  return (
    <View
      {...testIdProps(testID)}
      className="relative"
      // Computed: the cluster box scales with the profile (six-button-arch.ts).
      style={{ width: arch.widthDp, height: arch.heightDp }}
    >
      <ArcadeRiveSurface
        riveFile={rive?.file}
        diagnosticsName="right-six"
        artboardName={rive?.artboardName}
        stateMachineName={rive?.stateMachineName}
        onBinding={binding.onBinding}
        // Computed: the artboard is the box plus its glow margin, so it overhangs the box by `glow`.
        style={{ position: 'absolute', left: -glow, top: -glow, width: arch.widthDp + 2 * glow, height: arch.heightDp + 2 * glow }}
      />
      {arch.slots.map((slot) => (
        <ArcadeActionButton
          key={slot.id}
          id={slot.id}
          binding={bindings[slot.id]}
          state={states[slot.id] ?? 'idle'}
          scale={arch.scale}
          reducedMotion={reducedMotion}
          onDown={onDown}
          onUp={onUp}
          onAccessibilityActivate={onAccessibilityActivate}
          accessibilityLabel={spokenLabels?.[slot.id]}
          testID={testID ? `${testID}-btn-${slot.id}` : undefined}
          style={{ left: slot.x - slot.diameterDp / 2, top: slot.y - slot.diameterDp / 2 }}
        />
      ))}
    </View>
  );
}
