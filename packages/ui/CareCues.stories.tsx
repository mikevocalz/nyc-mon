import type { Meta, StoryObj } from '@storybook/react-vite';
import { CARE_CUES, cueSeconds } from './audio/care-cues-core';
import { playCareCue } from './audio/care-cues';
import { Button } from './Button';
import { setKitPreferences, useSoundEnabled } from './device-preferences';
import { Switch } from './Switch';
import { View } from './tw';

/**
 * Plays each Mon Space care cue on press (a press is the user gesture Web
 * Audio needs). The Sound switch is the kit preference every cue reads, so
 * turning it off here silences them the way Settings does. Each button's
 * label carries the cue's length.
 */
function CareCueBoard() {
  const sound = useSoundEnabled();
  return (
    <View className="max-w-content-form gap-3 p-4">
      <Switch label="Sound" value={sound} onChange={(next) => setKitPreferences({ sound: next })} />
      {CARE_CUES.map((cue) => (
        <Button
          key={cue}
          title={`Play ${cue}, ${Math.round(cueSeconds(cue) * 1000)} ms`}
          size="sm"
          onPress={() => playCareCue(cue)}
        />
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

/** Every cue with its length, and the Sound switch. */
export const AllCues: Story = {};
