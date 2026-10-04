import type { Meta, StoryObj } from '@storybook/react-vite';
import { DropZone, type DropAsset } from './DropZone';
import { Text as TWText, View } from './tw';
import { Text } from './Text';
import { Image } from './Image';
import { create } from 'zustand';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

// Story state — zustand always (repo rule).
const useDropStory = create<{
  active: boolean; dropped: DropAsset[];
  setActive: (active: boolean) => void; addAssets: (assets: DropAsset[]) => void;
}>((set) => ({
  active: false, dropped: [],
  setActive: (active) => set({ active }),
  addAssets: (assets) => set((s) => ({ active: false, dropped: [...s.dropped, ...assets] })),
}));

const meta = {
  title: 'UI/DropZone',
  component: DropZone,
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    active: { control: 'boolean' },
  },
} satisfies Meta<typeof DropZone>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: function Render() {
    const { active, setActive, dropped, addAssets } = useDropStory();
    return (
      <View className="max-w-content-detail gap-4 p-6">
        <DropZone
          active={active}
          onEnter={() => setActive(true)}
          onExit={() => setActive(false)}
          onDrop={({ assets }) => addAssets(assets)}
        />
        {dropped.length ? (
          <View className="flex-row flex-wrap gap-3">
            {dropped.map((a, i) =>
              a.uri && a.type.startsWith('image') ? (
                <Image
                  key={i}
                  src={a.uri}
                  alt={a.fileName ?? 'Dropped image'}
                  unoptimized
                  className="h-24 w-24 rounded-none border border-border/60 shadow-card"
                />
              ) : (
                <View key={i} className="flex-row items-center gap-2 rounded-none border border-border bg-surface-raised px-3 py-1.5 shadow-card">
                  <TWText className="text-sm">📄</TWText>
                  <Text variant="caption">{a.fileName ?? a.text ?? a.type}</Text>
                </View>
              ),
            )}
          </View>
        ) : null}
      </View>
    );
  },
};

export const CustomContent: Story = {
  render: () => (
    <View className="max-w-content-form p-6">
      <DropZone title="Add attachments" description="Up to 10 files. Images, PDFs, and text." glyph="🖼️" />
    </View>
  ),
};

/** District showcase: resting (dashed) and drag-over (solid border, accent glow). */
export const Districts: Story = {
  render: () => (
    <View className="gap-4 p-6 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d, i) => (
        <DropZone
          key={d}
          district={d}
          active={i % 2 === 1}
          title={i % 2 === 1 ? 'Release to attach' : `Drop a ${DISTRICT_NAME[d]} photo`}
          description="Images, documents and audio."
          className="md:w-80"
        />
      ))}
    </View>
  ),
};
