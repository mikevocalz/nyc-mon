'use client';
import { Pressable, Text, View } from '../tw';

export interface ClassicKeyProps {
  /** The classic letter on the key face: A cycles, B selects, C cancels. */
  letter: 'A' | 'B' | 'C';
  /** The word under the letter and the button's name ("Next", "Select", "Back"). */
  label: string;
  hint?: string;
  onPress: () => void;
  /** B is the primary key: filled face. A and C are outlined. */
  primary?: boolean;
  testID?: string;
}

/**
 * One of Mon Space's three on-screen keys (M32 "A/B/C keys"): a 56 pt round
 * face with the classic letter and the word under it, so the key reads
 * without knowing the old toys. Not the H-Lynk's HLynkKey: no device body.
 * The letter is decorative; the word is the name.
 */
export function ClassicKey({ letter, label, hint, onPress, primary = false, testID }: ClassicKeyProps) {
  return (
    <View testID={testID} className="items-center">
      <Pressable
        role="button"
        aria-label={label}
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={onPress}
        className="items-center gap-1 active:translate-y-[2px] motion-reduce:transition-none"
      >
        <View
          className={`items-center justify-center rounded-full border-2 ${primary ? 'border-text bg-text' : 'border-text bg-transparent'}`}
          style={{ width: 56, height: 56 }}
        >
          <Text className={`font-display text-type-title ${primary ? 'text-bg' : 'text-text'}`}>{letter}</Text>
        </View>
        <Text className="text-type-caption text-text" numberOfLines={1}>{label}</Text>
      </Pressable>
    </View>
  );
}
