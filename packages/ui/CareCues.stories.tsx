import type { Meta, StoryObj } from '@storybook/react-vite';
import { CARE_CUES, cueSeconds } from './audio/care-cues-core';
import { playCareCue } from './audio/care-cues';
import { Button } from './Button';
import { Text, View } from './tw';

/**
 * Plays each Mon Space care cue on press (a press is the user gesture Web
 * Audio needs). Sound off in Settings silences every one of them.
 */
function CareCueBoard() {
  return (
    <View className="max-w-content-form gap-3 p-4">
      {CARE_CUES.map((cue) => (
        <View key={cue} className="flex-row items-center gap-3">
          <Button title={`Play ${cue}`} size="sm" onPress={() => playCareCue(cue)} />
          <Text className="text-sm text-text-muted">{`${Math.round(cueSeconds(cue) * 1000)} ms`}</Text>
        </View>
      ))}
    </View>
  );
}

const meta = {
  title: 'UI/CareCues',
  component: CareCueBoard,
} satisfies Meta<typeof CareCueBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every cue with its length. */
export const AllCues: Story = {};
