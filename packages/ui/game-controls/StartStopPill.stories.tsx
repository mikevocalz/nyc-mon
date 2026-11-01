import type { Meta, StoryObj } from '@storybook/react-vite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { StartStopPill, type StartStopPillState } from './StartStopPill';

/*
  The pill without the `start-stop` artboard: the corner-cut housing, the
  legend (`g01.pill.*`), the 144 × 48 target and the hint line. Tap for the
  short press, hold 600 ms for the stop; the log under each pill shows what
  the session would receive. `Live` runs a story-local session so the pill
  can be driven through every state.
*/

const meta = {
  title: 'Game controls/StartStopPill',
  decorators: [
    (Story) => (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="bg-concrete-900 p-6">
          <Story />
        </View>
      </GestureHandlerRootView>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

interface Log {
  lines: string[];
}

function useLog() {
  const store = useInstanceStore<Log>(() => ({ lines: [] }));
  const lines = useStore(store, (s) => s.lines);
  const push = (line: string) => store.setState({ lines: [line, ...store.getState().lines].slice(0, 5) });
  return { lines, push };
}

function Static({ state, progress = 0, reducedMotion = false }: { state: StartStopPillState; progress?: number; reducedMotion?: boolean }) {
  const log = useLog();
  const common = { reducedMotion, testID: `pill-${state}` };
  const pill = (() => {
    switch (state) {
      case 'start':
        return <StartStopPill {...common} state="start" onStart={() => log.push('onStart')} />;
      case 'playing':
        return <StartStopPill {...common} state="playing" onPause={() => log.push('onPause')} onStopHoldStart={() => log.push('onStopHoldStart')} onStopHoldComplete={() => log.push('onStopHoldComplete')} onStopReleased={() => log.push('onStopReleased')} />;
      case 'paused':
        return <StartStopPill {...common} state="paused" onResume={() => log.push('onResume')} onStopHoldStart={() => log.push('onStopHoldStart')} onStopHoldComplete={() => log.push('onStopHoldComplete')} onStopReleased={() => log.push('onStopReleased')} />;
      case 'stopConfirm':
        return <StartStopPill {...common} state="stopConfirm" progress={progress} onStopHoldComplete={() => log.push('onStopHoldComplete')} onStopReleased={() => log.push('onStopReleased')} />;
      case 'disabled':
        return <StartStopPill {...common} state="disabled" />;
    }
  })();
  return (
    <View className="items-center gap-2">
      {pill}
      <Text className="text-xs text-text-muted">{`${state}${state === 'stopConfirm' ? ` · progress ${progress}` : ''}`}</Text>
      {log.lines.map((line, i) => (
        <Text key={i} className="text-xs text-text-muted">{line}</Text>
      ))}
    </View>
  );
}

export const Start: Story = { render: () => <Static state="start" /> };
export const Playing: Story = { render: () => <Static state="playing" /> };
export const Paused: Story = { render: () => <Static state="paused" /> };
export const StopConfirm0: Story = { render: () => <Static state="stopConfirm" progress={0} /> };
export const StopConfirm50: Story = { render: () => <Static state="stopConfirm" progress={0.5} /> };
export const StopConfirm100: Story = { render: () => <Static state="stopConfirm" progress={1} /> };
export const Disabled: Story = { render: () => <Static state="disabled" /> };
/** Reduced motion: no sink, the hold ring fills in four steps. */
export const ReducedMotion: Story = { render: () => <Static state="playing" reducedMotion /> };

interface Session {
  state: StartStopPillState;
  progress: number;
}

function LiveDemo() {
  const session = useInstanceStore<Session>(() => ({ state: 'start', progress: 0 }));
  const { state, progress } = useStore(session);
  const common = { reducedMotion: false, testID: 'pill-live' };
  const stop = {
    onStopHoldStart: () => session.setState({ state: 'stopConfirm' }),
    onStopHoldComplete: () => session.setState({ state: 'start', progress: 0 }),
    onStopReleased: () => session.setState({ state: 'playing', progress: 0 }),
  };
  return (
    <View className="items-center gap-3">
      {state === 'start' ? <StartStopPill {...common} state="start" onStart={() => session.setState({ state: 'playing' })} /> : null}
      {state === 'playing' ? <StartStopPill {...common} state="playing" onPause={() => session.setState({ state: 'paused' })} {...stop} /> : null}
      {state === 'paused' ? <StartStopPill {...common} state="paused" onResume={() => session.setState({ state: 'playing' })} {...stop} /> : null}
      {state === 'stopConfirm' ? <StartStopPill {...common} state="stopConfirm" progress={progress} onStopHoldComplete={stop.onStopHoldComplete} onStopReleased={stop.onStopReleased} /> : null}
      {state === 'disabled' ? <StartStopPill {...common} state="disabled" /> : null}
      <Text className="text-xs text-text-muted">{`session: ${state}`}</Text>
    </View>
  );
}

/** A story-local session: tap START, tap to pause and resume, hold to stop. The pill only reflects it. */
export const Live: Story = { render: () => <LiveDemo /> };
