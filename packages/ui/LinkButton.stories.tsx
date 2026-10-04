import type { Meta, StoryObj } from '@storybook/react-vite';
import { LinkButton } from './LinkButton';
import { View } from './tw';

const meta = {
  title: 'UI/LinkButton',
  component: LinkButton,
  args: { title: 'Join the waitlist', href: '#waitlist', variant: 'cta' },
  argTypes: {
    variant: { control: 'select', options: [undefined, 'cta', 'primary', 'accent', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: (args) => (
    <View className="gap-4 bg-bg p-6">
      <LinkButton {...args} />
    </View>
  ),
} satisfies Meta<typeof LinkButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The page's one CTA as a link: Button's cta face, an `<a href>` underneath. */
export const Cta: Story = {
  play: ({ canvasElement }) => {
    const anchor = canvasElement.querySelector('a');
    if (anchor?.getAttribute('href') !== '#waitlist') throw new Error('LinkButton must render an <a href>');
    if (anchor.textContent !== 'Join the waitlist') throw new Error(`label: ${anchor.textContent}`);
    if (canvasElement.querySelector('a button')) throw new Error('a <button> is nested in the link');
  },
};

/** Sizes, side by side. */
export const Sizes: Story = {
  render: (args) => (
    <View className="flex-row flex-wrap items-center gap-4 bg-bg p-6">
      <LinkButton {...args} size="sm" />
      <LinkButton {...args} size="md" />
      <LinkButton {...args} size="lg" />
    </View>
  ),
};
