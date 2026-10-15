import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CreatureStage } from './hatch/CreatureStage';
import { HatchBurst } from './hatch/HatchBurst';
import { HatchEgg } from './hatch/HatchEgg';
import { Button } from './Button';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * M12's hatch pieces. `HatchEgg` draws three cracks at 0.25 / 0.55 / 0.85 of
 * `hatchProgress` and the light through them over the screen's egg art.
 * `HatchBurst` blooms to its cap (0.6 phone, 0.4 Quest) at 0.36 and renders
 * nothing under reduced motion. `CreatureStage` holds the creature through
 * the framing moves. Stand-in shapes replace the art, which the screen passes.
 */
const meta = { title: 'Hatch/Sequence' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const EggArt = () => <View className="bg-concrete-50" style={{ width: 84, height: 108 }} />;

function useLoop(durationMs: number) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false));
  }, [p, durationMs]);
  return p;
}

function Egg({ fixed, reducedMotion = false }: { fixed?: number; reducedMotion?: boolean }) {
  const loop = useLoop(2400);
  const still = useSharedValue(fixed ?? 0);
  const glow = useSharedValue(0.8);
  return (
    <View className="scheme-dark items-center bg-night p-8">
      <HatchEgg eggSpeciesId="dex-001" hatchProgress={fixed === undefined ? loop : still} crackGlow={glow} reducedMotion={reducedMotion} art={<EggArt />} testID="m12-egg" />
    </View>
  );
}
export const EggCracking: Story = { render: () => <Egg /> };
export const EggOneCrack: Story = { render: () => <Egg fixed={0.3} /> };
export const EggThreeCracks: Story = { render: () => <Egg fixed={0.9} /> };
export const EggReduced: Story = { render: () => <Egg fixed={0.6} reducedMotion /> };

function Burst({ cap, reducedMotion = false }: { cap: 0.6 | 0.4; reducedMotion?: boolean }) {
  const p = useLoop(1500);
  return (
    <View className="scheme-dark items-center bg-night p-4">
      <HatchBurst progress={p} peakOpacity={cap} reducedMotion={reducedMotion} sizePt={280} testID="m12-burst" />
      <Text variant="caption" className="text-silver-300">{reducedMotion ? 'Reduced: no burst' : `Peak opacity ${cap}`}</Text>
    </View>
  );
}
export const BurstPhone: Story = { render: () => <Burst cap={0.6} /> };
export const BurstQuest: Story = { render: () => <Burst cap={0.4} /> };
export const BurstReduced: Story = { render: () => <Burst cap={0.6} reducedMotion /> };

type Framing = 'hatch-closeup' | 'home' | 'naming';
function Stage({ reducedMotion }: { reducedMotion: boolean }) {
  const store = useInstanceStore(() => ({ framing: 'hatch-closeup' as Framing, look: 'lean-in' as 'lean-in' | 'hesitate', resolved: false }));
  const { framing, look, resolved } = useStore(store);
  return (
    <View className="gap-3 p-4">
      <View className="relative overflow-hidden bg-concrete-100" style={{ width: 351, height: 468 }}>
        <CreatureStage
          scene={{ id: 'baby' }}
          framing={framing}
          performance={{ kind: 'first-look', choice: look, resolved }}
          reducedMotion={reducedMotion}
          renderStill={() => <View className="mb-8 bg-royal-500" style={{ width: 120, height: 140 }} />}
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {(['hatch-closeup', 'home', 'naming'] as const).map((f) => (
          <Button key={f} title={f} size="sm" variant={f === framing ? undefined : 'outline'} onPress={() => store.setState({ framing: f })} />
        ))}
        <Button title="Hesitate" size="sm" variant="outline" onPress={() => store.setState({ look: 'hesitate', resolved: false })} />
        <Button title="Stay close" size="sm" variant="outline" onPress={() => store.setState({ resolved: true })} />
      </View>
    </View>
  );
}
/** Framing presets and the first look. A hesitation tucks aside, never turns away, and resolves to the lean-in. */
export const CreatureFraming: Story = { render: () => <Stage reducedMotion={false} /> };
export const CreatureFramingReduced: Story = { render: () => <Stage reducedMotion /> };
