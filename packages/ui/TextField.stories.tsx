import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField, type PasteEventPayload } from './TextField';
import { View } from './tw';
import { Text } from './Text';
import { Image } from './Image';
import { create } from 'zustand';

// Story state — zustand always (repo rule).
const usePasteStory = create<{
  value: string; images: string[];
  setValue: (value: string) => void; addImages: (uris: string[]) => void;
}>((set) => ({
  value: '', images: [],
  setValue: (value) => set({ value }),
  addImages: (uris) => set((s) => ({ images: [...s.images, ...uris] })),
}));

const meta = { title: 'UI/TextField', component: TextField, args: { label: 'Field' } } satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <TextField label="Full name" placeholder="Your name" />
      <TextField label="Email" placeholder="you@example.com" hint="We never share your email." />
      <TextField label="Phone" placeholder="(555) 555-5555" error="Enter a valid phone number." />
      <TextField label="Locked" placeholder="Read only" disabled />
    </View>
  ),
};

export const WithPaste: Story = {
  render: function Render() {
    const { value, setValue, images, addImages } = usePasteStory();
    const onPaste = (payload: PasteEventPayload) => {
      // Text pastes insert into the field natively (value arrives via onChangeText).
      if (payload.type === 'images') addImages(payload.uris);
    };
    return (
      <View className="max-w-content-form gap-4 p-4">
        <TextField
          label="Message"
          placeholder="Paste text or an image…"
          hint="Copy an image to the clipboard, then paste it into the field."
          value={value}
          onChangeText={setValue}
          onPaste={onPaste}
        />
        {images.length ? (
          <View className="flex-row flex-wrap gap-3">
            {images.map((uri, i) => (
              <Image
                key={i}
                src={uri}
                alt="Pasted"
                unoptimized
                className="h-20 w-20 rounded-lg border border-border/60 shadow-card"
              />
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="muted">Pasted images appear here.</Text>
        )}
      </View>
    );
  },
};

/** NeonBlade neon input: tone nameplate label, night well, focus glow. One per district plus error and disabled. */
export const Neon: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 bg-ink-950 p-6">
      <TextField variant="neon" district="downtown" label="Crew name" placeholder="Wall Street Wolves" />
      <TextField variant="neon" district="midtown" label="Home block" placeholder="W 34th St & 5th Ave" />
      <TextField variant="neon" district="harlem" label="Stoop" placeholder="Lenox Ave" hint="The corner you play from." />
      <TextField variant="neon" district="megacity" label="Sky bridge" error="Pick a bridge that exists." defaultValue="Level 90" />
      <TextField variant="neon" label="Locked" disabled defaultValue="Read only" />
    </View>
  ),
};
