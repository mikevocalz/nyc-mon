import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lightbox } from './Lightbox';
import { Button } from './Button';
import { Image } from './Image';
import { Pressable, View } from './tw';
import { create } from 'zustand';
import { DISTRICTS } from './district';
import { useInstanceStore, useStore } from './use-instance-store';

// Story state — zustand always (repo rule).
const useLightboxStory = create<{
  open: boolean; index: number;
  openAt: (index: number) => void; close: () => void;
}>((set) => ({
  open: false, index: 0,
  openAt: (index) => set({ open: true, index }),
  close: () => set({ open: false }),
}));

const IMAGES = [
  'https://picsum.photos/seed/one/1200/800',
  'https://picsum.photos/seed/two/1200/800',
  'https://picsum.photos/seed/three/1200/800',
];

const meta = {
  title: 'UI/Lightbox',
  component: Lightbox,
  args: { images: IMAGES, open: false, onClose: () => {} },
} satisfies Meta<typeof Lightbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  args: { district: 'midtown' },
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: function Render({ district }) {
    const { open, index, openAt, close } = useLightboxStory();
    return (
      <View className="gap-4 p-4">
        <View className="flex-row gap-3">
          {IMAGES.map((uri, i) => (
            <Pressable
              key={uri}
              aria-label={`Open image ${i + 1}`}
              onPress={() => openAt(i)}
              className="transition-opacity duration-fast hover:opacity-90 active:opacity-80"
            >
              <Image
                src={uri}
                alt={`Thumbnail ${i + 1}`}
                unoptimized
                district={district}
                className="h-24 w-32"
                sizes="128px"
              />
            </Pressable>
          ))}
        </View>
        <Button title="Open lightbox" variant="outline" size="sm" onPress={() => openAt(0)} />
        <Lightbox images={IMAGES} initialIndex={index} open={open} onClose={close} district={district} />
      </View>
    );
  },
};

/**
 * Open on the second image: tone pip, counter, square tiles. Close, Escape
 * and the Android back button flip the story's own `open`; a pinned
 * `open: true` with a no-op onClose would never close.
 */
export const Open: Story = {
  args: { images: IMAGES, initialIndex: 1, open: true, district: 'downtown' },
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: function Render(args) {
    const store = useInstanceStore(() => ({ open: args.open }));
    const open = useStore(store, (s) => s.open);
    return (
      <View className="items-start p-4">
        <Button title="Open lightbox" variant="outline" size="sm" onPress={() => store.setState({ open: true })} />
        <Lightbox
          {...args}
          open={open}
          onClose={() => {
            args.onClose();
            store.setState({ open: false });
          }}
        />
      </View>
    );
  },
};
