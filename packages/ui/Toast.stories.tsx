import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Heading } from './html';
import { notify, Toaster } from './notify';
import { Text } from './Text';
import { Toast } from './Toast';
import { View } from './tw';
import { DISTRICT_NAME, DISTRICTS } from './elements/tones';

const meta = {
  title: 'UI/Toast',
  component: Toast,
  parameters: {
    docs: { description: { component: 'Toasts and the sonner neon variant. NeonBlade: Neon Modal (neon-modal), toast pattern.' } },
  },
  args: { title: 'Downloaded', description: 'Total Praise · Alto part is available offline.' },
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 p-4">
      <Toast variant="info" title="Update available" description="A new version is ready to install." />
      <Toast variant="success" title="RSVP saved" />
      <Toast variant="error" title="Upload failed" description="Check your connection and retry." />
    </View>
  ),
};

/** The neon storefront card: what `notify.*(title, { variant: 'neon', district })` shows. */
export const Neon: Story = {
  name: 'Neon card (NeonBlade: Neon Modal)',
  args: { appearance: 'neon', district: 'midtown', variant: 'info' },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['default', 'neon'] },
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
    variant: { control: 'inline-radio', options: ['info', 'success', 'error'] },
  },
  render: (args) => (
    <View className="max-w-content-form gap-4 p-4">
      <Toast {...args} />
      <Toast appearance="neon" district="downtown" variant="success" title="Ticket saved" description="Knicks at the Garden, Friday 7:30." />
      <Toast appearance="neon" district="harlem" variant="error" title="Upload failed" description="Check your connection and try again." />
      <Toast appearance="neon" district="megacity" title="New block unlocked" description="Hudson Yards is on the map." />
    </View>
  ),
};

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Heading level={2} className="font-display text-lg text-ink-50">{title}</Heading>
      <View className="flex-row flex-wrap gap-3">{children}</View>
    </View>
  );
}

/**
 * Real sonner toasts. Each button calls `notify` with `variant: 'neon'`; the
 * Toaster below is the same one the app mounts at its root.
 */
export const LiveNeonToasts: Story = {
  name: 'Live neon toasts (sonner)',
  render: () => (
    <View className="min-h-screen gap-8 bg-ink-950 p-6">
      <Toaster />
      <Text className="max-w-xl text-silver-300">
        Each button fires a real sonner toast through notify, with variant neon and the district you pick.
      </Text>
      <Row title="One per district">
        {DISTRICTS.map((district) => (
          <Button
            key={district}
            variant="cornerCut"
            district={district}
            title={DISTRICT_NAME[district]}
            onPress={() =>
              notify.info(`Entering ${DISTRICT_NAME[district]}`, {
                variant: 'neon',
                district,
                description: 'Your crew is two blocks away.',
              })
            }
          />
        ))}
      </Row>
      <Row title="Every status">
        <Button variant="outline" title="Success" onPress={() => notify.success('Block claimed', { variant: 'neon', district: 'harlem', description: '125th St is yours until someone beats your score.' })} />
        <Button variant="outline" title="Warning" onPress={() => notify.warning('Low signal', { variant: 'neon', district: 'downtown', description: 'Scores will sync when you are back above ground.' })} />
        <Button variant="outline" title="Error" onPress={() => notify.error('Claim failed', { variant: 'neon', district: 'midtown', description: 'Another crew got there first. Try the next block.' })} />
        <Button
          variant="outline"
          title="Loading, then done"
          onPress={() => {
            const id = notify.loading('Saving your route', { variant: 'neon', district: 'megacity' });
            setTimeout(() => notify.success('Route saved', { id, variant: 'neon', district: 'megacity' }), 1800);
          }}
        />
        <Button
          variant="outline"
          title="With an action"
          onPress={() =>
            notify.info('Legend spotted', {
              variant: 'neon',
              district: 'midtown',
              description: 'Near Bryant Park.',
              action: { label: 'Track', onPress: () => notify.success('Tracking', { variant: 'neon', district: 'midtown' }) },
            })
          }
        />
        <Button variant="ghost" title="Dismiss all" onPress={() => notify.dismiss()} />
      </Row>
    </View>
  ),
};

/**
 * `notify.modal(...)`: a centred neon facade through the same sonner system.
 * It traps focus, closes on Escape, on the scrim and on the close control,
 * and every action closes it after running.
 */
export const LiveNeonModal: Story = {
  name: 'Live neon modal (notify.modal)',
  render: () => (
    <View className="min-h-screen gap-8 bg-ink-950 p-6">
      <Toaster />
      <Text className="max-w-xl text-silver-300">
        notify.modal opens a building-facade modal on the sonner modal toaster. Press Escape, the scrim or the close control to close it.
      </Text>
      <Row title="Open a modal">
        <Button
          variant="cornerCut"
          district="harlem"
          title="Claim this block"
          onPress={() =>
            notify.modal({
              district: 'harlem',
              label: '125th St and Lenox',
              title: 'Claim this block?',
              description: 'Harlem 125th becomes yours until someone beats your score.',
              actions: [
                { label: 'Not now' },
                { label: 'Claim block', onPress: () => { notify.success('Block claimed', { variant: 'neon', district: 'harlem' }); } },
              ],
            })
          }
        />
        {DISTRICTS.filter((d) => d !== 'harlem').map((district) => (
          <Button
            key={district}
            variant="outline"
            title={`${DISTRICT_NAME[district]} facade`}
            onPress={() =>
              notify.modal({
                district,
                title: `Enter ${DISTRICT_NAME[district]}`,
                description: 'Your crew is two blocks away.',
                borderBeam: true,
                actions: [{ label: 'Stay here' }, { label: 'Go' }],
              })
            }
          />
        ))}
        <Button
          variant="outline"
          title="Long rules (scrolls)"
          onPress={() =>
            notify.modal({
              district: 'downtown',
              size: 'lg',
              label: 'House rules',
              title: 'Before you play',
              dividers: true,
              scrollableBody: true,
              body: (
                <View className="gap-3">
                  {Array.from({ length: 14 }, (_, i) => (
                    <Text key={i} className="text-silver-200">
                      {`Rule ${i + 1}. Stay on the sidewalk, watch the lights, and never chase a legend into traffic.`}
                    </Text>
                  ))}
                </View>
              ),
              actions: [{ label: 'Got it' }],
            })
          }
        />
        <Button
          variant="outline"
          title="Kit look (variant default)"
          onPress={() =>
            notify.modal({
              variant: 'default',
              title: 'Discard changes?',
              description: 'Your edits have not been saved yet.',
              actions: [{ label: 'Stay' }, { label: 'Leave', variant: 'danger' }],
            })
          }
        />
      </Row>
    </View>
  ),
};
