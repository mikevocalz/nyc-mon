'use client';

import { Button } from '@acme/ui';
import { View } from '@acme/ui/tw';

export interface StageControl {
  readonly key: string;
  readonly label: string;
  readonly onPress: () => void;
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly testID: string;
}

/**
 * The 3D H-Lynk's actions as real buttons for screen readers, switch control
 * and keyboards. They draw at 1 px and zero opacity (never display:none), so
 * nothing 2D shows over the stage while every action stays reachable. They
 * sit in the stage's top-left corner, so a screen reader's activation lands
 * on the button itself, not the canvas.
 */
export function StageControls({ controls, testID }: { controls: readonly StageControl[]; testID: string }) {
  return (
    <View testID={testID} className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
      {controls.map((c) => (
        <View key={c.key} testID={c.testID}>
          <Button variant="outline" title={c.label} onPress={c.onPress} disabled={c.disabled} accessibilityHint={c.hint} />
        </View>
      ))}
    </View>
  );
}
