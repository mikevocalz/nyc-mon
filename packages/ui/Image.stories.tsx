import type { Meta, StoryObj } from '@storybook/react-vite';
import { Image } from './Image';
import { View } from './tw';
import { Text } from './Text';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/Image',
  component: Image,
  args: { src: 'https://picsum.photos/seed/starter/800/450', alt: 'Sample' },
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Fill: Story = {
  render: () => (
    <View className="p-4">
      <Image
        src="https://picsum.photos/seed/starter/800/450"
        alt="Sample"
        unoptimized
        className="aspect-video w-full max-w-md"
        sizes="448px"
      />
    </View>
  ),
};

/** The frame in each district, plus a fixed-size image and the bare `framed={false}` escape hatch. */
export const Districts: Story = {
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: () => (
    <View className="gap-6 p-4">
      <View className="flex-row flex-wrap gap-5">
        {DISTRICTS.map((d) => (
          <View key={d} className="gap-2">
            <Image src={`https://picsum.photos/seed/${d}/480/320`} alt={DISTRICT_NAME[d]} unoptimized district={d} className="h-32 w-48" sizes="192px" />
            <Text tone="muted">{DISTRICT_NAME[d]}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap items-start gap-5">
        <Image src="https://picsum.photos/seed/fixed/240/160" alt="Fixed size" unoptimized width={240} height={160} />
        <Image src="https://picsum.photos/seed/bare/480/320" alt="Bare" unoptimized framed={false} className="h-32 w-48" sizes="192px" />
      </View>
    </View>
  ),
};
