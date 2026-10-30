'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { MODEL_COPY } from './model-copy';
import { MonModel3D } from '@acme/ui/three/mon';
import { Heading, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';

/**
 * The Mons with finished 3D models, drawn live with three.js, and the rest of
 * the roster as "Coming Soon". New models arrive through the Payload console
 * (mon-models); this list grows with them.
 */
const LIVE = [
  { name: 'Squeaklet', dex: 2, line: 'Hood Ratti · Baby', url: '/mons/squeaklet.glb', clips: ['tail_swish', 'rat_run'] },
  { name: 'Lil’ Ratti', dex: 3, line: 'Hood Ratti · Small', url: '/mons/lil-ratti.glb', clips: ['up_idle', 'up_breathe'] },
] as const;

const SOON = [
  { name: 'Hood Ratti', line: 'Hood Ratti · Mid' },
  { name: 'Kittee Cee', line: 'Bodega Baddiee Cee · Baby' },
  { name: 'Yotito', line: 'Yote · Baby' },
] as const;

const useStageStore = create<{width: number}>(() => ({width: 320}));
function useStageWidth() {
  const w = useStageStore(state => state.width);
  const setW = (width: number) => useStageStore.setState({width});
  useEffect(() => {
    // A card is the stage plus 36px (p-4 and border-2 per side) inside the page's 16px
    // gutters, so the stage gets innerWidth - 68 to keep the card inside a phone screen.
    const fit = () => setW(Math.max(220, Math.min(420, window.innerWidth - 68)));
    let t: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(fit, 150); // settle before resizing the WebGL stages
    };
    fit();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return w;
}

export function MonsModels3D({ copy = MODEL_COPY }: { copy?: typeof MODEL_COPY } = {}) {
  const width = useStageWidth();
  return (
    <Section aria-labelledby="w02-mons-3d" className="w-full bg-signage-black">
      <View className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-14 sm:px-6 lg:px-8">
        <Heading level={2} id="w02-mons-3d" className="my-0 font-display text-display-md uppercase leading-heading text-signage-white">
          {copy.title}
        </Heading>
        <View className="flex-row flex-wrap gap-6">
          {LIVE.map((model, index) => { const m = {...model, ...copy.live[index]}; return (
            <View key={m.name} className="gap-3 border-2 border-ink-700 bg-ink-900 p-4">
              <MonModel3D url={m.url} clips={m.clips} width={width} height={Math.round(width * 1.2)} label={`${m.name}, 3D model`} />
              <Text className="font-display text-xl uppercase text-signage-white">{m.name}</Text>
              <Text className="text-sm font-semibold text-silver-200">{`#${String(m.dex).padStart(3, '0')} · ${m.line}`}</Text>
            </View>
          ); })}
          {SOON.map((model, index) => { const m = {...model, ...copy.soon[index]}; return (
            <View key={m.name} className="justify-between gap-3 border-2 border-dashed border-ink-700 bg-ink-900 p-4" style={{ width: width + 36, minHeight: 200 }}>
              <Text className="self-start bg-orange-500 px-2 py-1 font-display text-sm uppercase text-ink-950">{copy.comingSoon}</Text>
              <View className="gap-1">
                <Text className="font-display text-xl uppercase text-signage-white">{m.name}</Text>
                <Text className="text-sm font-semibold text-silver-200">{m.line}</Text>
              </View>
            </View>
          ); })}
        </View>
      </View>
    </Section>
  );
}
