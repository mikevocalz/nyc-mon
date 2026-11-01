import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { EGG_HATCH_ASSETS } from '../assets/eggs';
import { HatchEgg3D, type HatchEgg3DProps } from './hatch/HatchEgg3D';
import type { EggHatchPhase } from './three/hatch/hatch-manifest';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

const PHASES: readonly EggHatchPhase[] = ['stir', 'pressure', 'crack', 'burst', 'emerge', 'attention'];
/** PHASE_MS.full from packages/app/features/hatch/hatch-sequence.ts, plus a beat of idle before and after. */
const PHASE_MS: Record<EggHatchPhase, number> = { stir: 1000, pressure: 800, crack: 2400, burst: 500, emerge: 1800, attention: 1500 };
const IDLE_MS = 1500;

const assetFor = (eggId: string) => {
  const asset = EGG_HATCH_ASSETS.find((a) => a.eggId === eggId);
  if (!asset) throw new Error(`no egg asset ${eggId}`);
  return asset;
};

function Fallback() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-silver-300">Static egg art (fallback)</Text>
    </View>
  );
}

type StoryArgs = Omit<HatchEgg3DProps, 'source' | 'fallback'>;

const meta: Meta<StoryArgs> = {
  title: 'Hatch/HatchEgg3D',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: {
    eggId: 'metro-egg',
    phase: 'crack',
    progress: 0.5,
    firstLook: 'lean-in',
    reducedMotion: false,
    showProxyBaby: true,
    forceWebGL: false,
  },
  argTypes: {
    eggId: { control: 'inline-radio', options: EGG_HATCH_ASSETS.map((a) => a.eggId) },
    phase: { control: 'select', options: [null, ...PHASES] },
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    firstLook: { control: 'inline-radio', options: ['lean-in', 'hesitate'] },
    showProxyBaby: { description: 'The GLB Baby is a labelled proxy; the app hides it and draws the Baby in the creature layer.' },
  },
};


export default meta;
type Story = StoryObj<StoryArgs>;

function Stage({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <View className="h-dvh w-full bg-hlynk-core-black">
      <View className="flex-1">{children}</View>
      <Text testID="hatch3d-caption" className="p-4 text-center text-xr-caption text-silver-300">
        {caption}
      </Text>
    </View>
  );
}

/** Seek: holds `progress` through `phase`. Deterministic, so `?args=phase:emerge;progress:0.5` always shows the same frame. */
export const Seek: Story = {
  render: (args) => (
    <Stage caption={`${args.eggId} · ${args.phase ?? 'idle'} @ ${args.progress ?? '–'}${args.showProxyBaby ? ' · Baby is a proxy' : ''}`}>
      <HatchEgg3D {...args} source={assetFor(args.eggId)} fallback={<Fallback />} />
    </Stage>
  ),
};

/** Plays the whole hatch on the screen's full-motion timings, idle first, then loops. */
function Playthrough(args: StoryArgs) {
  const clock = useInstanceStore(() => ({ step: -1 }));
  const step = useStore(clock, (s) => s.step);
  useEffect(() => {
    const ms = step < 0 || step >= PHASES.length ? IDLE_MS : PHASE_MS[PHASES[step]!];
    const t = setTimeout(() => clock.setState({ step: step >= PHASES.length ? -1 : step + 1 }), ms);
    return () => clearTimeout(t);
  }, [step, clock]);
  const phase = step < 0 || step >= PHASES.length ? (step < 0 ? null : 'attention') : PHASES[step]!;
  const playing = step >= 0 && step < PHASES.length;
  return (
    <Stage caption={`${args.eggId} · ${phase ?? 'idle'}${args.showProxyBaby ? ' · Baby is a proxy' : ''}`}>
      <HatchEgg3D
        {...args}
        phase={phase}
        progress={playing ? null : step < 0 ? null : 1}
        phaseMs={playing ? PHASE_MS[PHASES[step]!] : undefined}
        source={assetFor(args.eggId)}
        fallback={<Fallback />}
      />
    </Stage>
  );
}

export const Play: Story = { render: (args) => <Playthrough {...args} /> };

/** Reduced motion: every phase shows its end pose, no wobble or playback. */
export const ReducedMotion: Story = { args: { reducedMotion: true, phase: 'crack' }, render: Seek.render };

/** A broken asset falls back to the static art instead of a blank canvas. */
export const LoadError: Story = {
  render: (args) => (
    <Stage caption="Missing GLB: the fallback shows">
      <HatchEgg3D {...args} eggId="metro-egg-missing" source={{ manifest: { ...(assetFor('metro-egg').manifest as object), eggId: 'metro-egg-missing' }, glb: '/missing.glb' }} fallback={<Fallback />} />
    </Stage>
  ),
};
