import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { AngledStartButton, type AngledStartButtonProps } from './AngledStartButton';

/*
  START without the `start-angled` artboard: the corner-cut face, the
  engraved legend (`g02.start.legend`), the 64 pt target and the accessible
  name per variant (`g02.start.a11y.*`). The log under each button shows the
  press the app would receive; nothing here starts a game.
*/

const meta = {
  title: 'Lobby/AngledStartButton',
  decorators: [
    (Story) => (
      <View className="w-80 bg-concrete-900 p-6">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

interface Log {
  presses: number;
}

function Demo(props: Omit<AngledStartButtonProps, 'onPress'>) {
  const log = useInstanceStore<Log>(() => ({ presses: 0 }));
  const presses = useStore(log, (s) => s.presses);
  return (
    <View className="gap-2">
      <AngledStartButton {...props} onPress={() => log.setState({ presses: presses + 1 })} />
      <Text className="text-xs text-text-muted">{`${props.variant} · ${props.state} · presses ${presses}`}</Text>
    </View>
  );
}

export const Idle: Story = { render: () => <Demo variant="new" state="idle" reducedMotion={false} /> };
export const Continue: Story = { render: () => <Demo variant="continue" district="harlem" state="idle" reducedMotion={false} /> };
export const Pressed: Story = { render: () => <Demo variant="continue" state="pressed" reducedMotion={false} /> };
/** `busy`; `g02.start.loading` is spoken once on entry. The legend stays. */
export const Loading: Story = { render: () => <Demo variant="continue" state="loading" reducedMotion={false} /> };
export const Disabled: Story = { render: () => <Demo variant="new" state="disabled" reducedMotion={false} /> };
/** Resume failed: the name is "Fix your last save"; the press opens the lobby's recovery dialog. */
export const Recover: Story = { render: () => <Demo variant="recover" state="idle" reducedMotion={false} /> };
/** Steady rim instead of the energy trace; colour-only press. */
export const ReducedMotion: Story = { render: () => <Demo variant="continue" state="idle" reducedMotion /> };
export const Daylit: Story = {
  decorators: [(Story) => <View className="scheme-light bg-concrete-50 p-2"><Story /></View>],
  render: () => <Demo variant="new" state="idle" reducedMotion scheme="daylit" />,
};
/** Full content width at a tablet column: the face stays 64 pt tall. */
export const AtScale: Story = {
  decorators: [(Story) => <View className="w-[640px]"><Story /></View>],
  render: () => <Demo variant="continue" district="midtown" state="idle" reducedMotion={false} />,
};
