'use client';
import { Button } from '../Button';
import { View } from '../tw';

/**
 * Props for `TrackpadActions`: the on-screen, word-labelled twin of a
 * {@linkcode TrackpadProps} set. Labels are required and come from the screen's
 * copy (the kit invents no strings). Each action renders only when its
 * handler is present.
 */
export interface TrackpadActionsProps {
  /** Same handler as `Trackpad.onStep(-1)`. */
  onStepBack?: () => void;
  stepBackLabel?: string;
  /** Same handler as `Trackpad.onActivate`. */
  onActivate?: () => void;
  activateLabel?: string;
  /** Same handler as `Trackpad.onStep(1)`. */
  onStepForward?: () => void;
  stepForwardLabel?: string;
  /** Same handler as `Trackpad.onCommit`: one press, no hold, no timeout. */
  onCommit?: () => void;
  commitLabel?: string;
  disabled?: boolean;
  /**
   * Test id on the row. Each button gets `<testID>-back`, `-activate`,
   * `-forward` or `-commit` on its own pressable.
   */
  testID?: string;
}

/**
 * Every trackpad gesture as a plain labelled control, for anyone who does not
 * discover gestures or cannot perform them (DIRECTION.md "Controls": every
 * trackpad action has an on-screen equivalent; WCAG 2.5.1). Screens place it
 * in or under the `HLynkScreen` status row. The buttons are `size="sm"` faces
 * on full `min-h-target` press targets (Button), spaced by `target-gap` so two
 * targets never share a controller ray's jitter.
 */
export function TrackpadActions({
  onStepBack, stepBackLabel, onActivate, activateLabel, onStepForward, stepForwardLabel,
  onCommit, commitLabel, disabled = false, testID,
}: TrackpadActionsProps) {
  const items = [
    { key: 'back', on: onStepBack, label: stepBackLabel, variant: 'outline' as const },
    { key: 'activate', on: onActivate, label: activateLabel, variant: 'outline' as const },
    { key: 'forward', on: onStepForward, label: stepForwardLabel, variant: 'outline' as const },
    { key: 'commit', on: onCommit, label: commitLabel, variant: undefined },
  ].filter((i): i is typeof i & { on: () => void; label: string } => Boolean(i.on && i.label));
  return (
    <View testID={testID} className="flex-row flex-wrap gap-target-gap">
      {items.map((i) => (
        <Button
          key={i.key}
          testID={testID === undefined ? undefined : `${testID}-${i.key}`}
          title={i.label}
          onPress={i.on}
          variant={i.variant}
          size="sm"
          disabled={disabled}
        />
      ))}
    </View>
  );
}
