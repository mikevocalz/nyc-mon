import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Button } from './Button';
import { DialogCard } from './Dialog';
import { AccentFrame } from './elements/AccentFrame';
import { Timeline } from './elements/Timeline';
import { DISTRICT_NAME, type District } from './district';
import { Heading, Paragraph, Section } from './html';
import { districtControl } from './progress/story-kit';
import { ToastCard } from './ToastCard';
import { View } from './tw';

const STOPS = [
  { date: 'Mon', title: 'Bowling Green', description: 'Crew formed.' },
  { date: 'Tue', title: 'Union Square', description: 'First block claimed.', badge: 'New' },
  { date: 'Wed', title: 'Times Sq-42 St', description: 'Holding three blocks.', active: true },
  { date: 'Thu', title: '125 St', description: 'Harlem opens next.' },
];

function AllElements({ district }: { district: District }) {
  const name = DISTRICT_NAME[district];
  return (
    <View className="gap-8 bg-ink-950 p-4 md:p-8">
      <Section className="gap-1">
        <Heading level={2} className="my-0 font-display text-2xl text-ink-50">{name} elements</Heading>
        <Paragraph className="my-0 text-sm text-silver-300">Accent frame, neon badge, facade dialog, storefront toast and the subway timeline.</Paragraph>
      </Section>

      <View className="gap-8 lg:flex-row">
        <View className="gap-8 lg:flex-1">
          <Section className="gap-4">
            <Heading level={3} className="my-0 font-display text-base text-ink-50">Accent frame</Heading>
            <View className="gap-8 px-2 md:flex-row">
              <AccentFrame district={district} bgVariant="subtle" className="md:flex-1">
                <Paragraph className="my-0 font-display text-lg text-ink-50">Setback</Paragraph>
              </AccentFrame>
              <AccentFrame district={district} cornerStyle="cornice" mode="quad" bgVariant="solid" className="md:flex-1">
                <Paragraph className="my-0 font-display text-lg text-ink-50">Cornice</Paragraph>
              </AccentFrame>
            </View>
          </Section>

          <Section className="gap-4">
            <Heading level={3} className="my-0 font-display text-base text-ink-50">Badges</Heading>
            <View className="flex-row flex-wrap items-center gap-3">
              <Badge variant="neon" district={district} label={name} size="md" />
              <Badge variant="neon" district={district} label="Live" dot="pulse" />
              <Badge variant="neon" district={district} label="Outline" fill="outline" />
              <Badge variant="neon" district={district} label="Ghost" fill="ghost" shape="rectangle" />
            </View>
          </Section>

          <Section className="gap-4">
            <Heading level={3} className="my-0 font-display text-base text-ink-50">Toasts</Heading>
            <ToastCard appearance="neon" district={district} title="Block claimed" description={`${name} is yours for now.`} />
            <ToastCard appearance="neon" district={district} variant="success" title="Saved" onDismiss={() => {}} />
            <ToastCard appearance="neon" district={district} variant="error" title="Couldn't claim the block" description="Someone got there first. Try the next one." action={{ label: 'Retry', onPress: () => {} }} />
          </Section>
        </View>

        <View className="gap-8 lg:flex-1">
          <Section className="gap-4">
            <Heading level={3} className="my-0 font-display text-base text-ink-50">Dialog</Heading>
            <DialogCard
              variant="neon"
              district={district}
              size="full"
              title="Claim this block?"
              description="It stays yours until someone beats your score."
              onClose={() => {}}
              actions={
                <>
                  <Button title="Not now" variant="ghost" onPress={() => {}} />
                  <Button title="Claim block" onPress={() => {}} />
                </>
              }
            />
          </Section>

          <Section className="gap-4">
            <Heading level={3} className="my-0 font-display text-base text-ink-50">Timeline</Heading>
            <Timeline district={district} items={STOPS} dotAnim="ping" accessibilityLabel="Route progress" />
          </Section>
        </View>
      </View>
    </View>
  );
}

const meta = {
  title: 'Elements/All',
  component: AllElements,
  parameters: { layout: 'fullscreen' },
  args: { district: 'midtown' },
  argTypes: { district: districtControl },
} satisfies Meta<typeof AllElements>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
export const Downtown: Story = { args: { district: 'downtown' } };
export const Harlem: Story = { args: { district: 'harlem' } };
export const MegaCity: Story = { args: { district: 'megacity' } };
