import type { Meta, StoryObj } from '@storybook/react-vite';
import { AudioPlayer } from './audio/AudioPlayer';
import { VoiceRecorder } from './audio/VoiceRecorder';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';
import { View } from './tw';

/**
 * A generated voice-like clip as a data: URI, so the story needs no network:
 * 8 kHz, 8-bit mono WAV, a few syllables of a 160 Hz buzz under a bumpy
 * envelope, with pauses between words so the waveform reads as a skyline.
 */
function sampleWav(seconds = 4, rate = 8000): string {
  const n = Math.floor(seconds * rate);
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const ascii = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + n, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  ascii(36, 'data'); view.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const word = Math.max(0, Math.sin(t * Math.PI * 2.6)) ** 0.6;
    const syllable = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 7.3 + Math.sin(t * 3)));
    const amp = word * syllable * 0.9;
    const v = amp * (Math.sin(2 * Math.PI * 160 * t) * 0.7 + Math.sin(2 * Math.PI * 320 * t) * 0.3);
    bytes[44 + i] = Math.round(128 + 127 * v);
  }
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const SAMPLE = sampleWav();
// Levels as the recorder would hand them over: the player draws these as-is.
const LEVELS = Array.from({ length: 48 }, (_, i) => 0.15 + 0.85 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)));

const meta = {
  title: 'UI/AudioPlayer',
  component: AudioPlayer,
  args: { uri: SAMPLE, label: 'Voice note: rehearsal, take 2', district: 'midtown' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    uri: { control: false },
    levels: { control: false },
  },
  decorators: [(Story) => <View className="max-w-content-form p-4">{Story()}</View>],
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Decodes the generated clip for its waveform. Press play to hear it. */
export const Default: Story = {};

/** Levels captured at record time, as the recorder passes them along. */
export const WithLevels: Story = {
  args: { levels: LEVELS, duration: 4, label: 'Your recording' },
};

export const Unreadable: Story = {
  args: { uri: 'data:audio/wav;base64,AAAA', label: 'Broken file' },
};

export const Districts: Story = {
  render: () => (
    <View className="gap-2">
      {DISTRICTS.map((d) => (
        <AudioPlayer key={d} uri={SAMPLE} levels={LEVELS} duration={4} label={DISTRICT_NAME[d]} district={d} />
      ))}
    </View>
  ),
};

/** On web the recorder states that recording happens in the mobile app. */
export const RecorderOnWeb: Story = {
  render: (args) => <VoiceRecorder district={args.district} onComplete={() => {}} onCancel={() => {}} />,
};
