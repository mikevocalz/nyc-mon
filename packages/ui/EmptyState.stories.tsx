import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { View } from './tw';
import { Calendar, Users } from './icons';
import { DISTRICTS, DISTRICT_NAME } from './district';
import { Image, type ImageProps } from './Image';
import { NYC_PHOTOS } from '../assets/photos';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    icon: <Calendar size={30} className="text-text-muted" />,
    title: 'Nothing here yet',
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
  },
};
export const WithAction: Story = {
  args: {
    description: 'Content appears here once it has been added.',
    action: <Button title="Refresh" variant="outline" size="sm" onPress={() => {}} />,
  },
};

/** One per district, with the copy the schedule and staff panes use. */
export const Districts: Story = {
  render: () => (
    <View className="gap-2 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <EmptyState
          key={d}
          district={d}
          icon={<Users size={30} className="text-text-muted" />}
          title={`${DISTRICT_NAME[d]}: no staff yet`}
          description="Add someone to the studio to see them here."
        />
      ))}
    </View>
  ),
};

const STOOPS = NYC_PHOTOS.find((p) => p.id === 'harlem-brownstone-stoops') ?? NYC_PHOTOS[0]!;

/**
 * `illustration` replaces the icon tile and skyline. The caller owns the
 * art's accessible name: here a bundled photo with its alt text.
 */
export const WithIllustration: Story = {
  args: {
    icon: undefined,
    // The bundler's static import (URL, StaticImageData or asset id), as CardSliderImageItem passes it.
    illustration: <Image src={STOOPS.source as ImageProps['src']} alt={STOOPS.alt} width={320} height={213} unoptimized district="harlem" />,
    title: 'No crew on this block yet',
    description: 'Invite a friend to start one.',
    district: 'harlem',
  },
};

/**
 * No icon and no art (the art is still to come): the slot renders nothing
 * and the state starts at its title, with no gap above it.
 */
export const WithoutIllustration: Story = {
  args: {
    icon: undefined,
    title: 'This request has expired',
    description: 'Ask again and we will send a new link.',
    action: <Button title="Ask again" size="md" onPress={() => {}} />,
  },
};
