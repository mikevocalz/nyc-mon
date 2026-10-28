'use client';

import { CREATURE_ART, type CreatureArt } from '@acme/assets/creatures';
import { eggHatchAssetForSpecies, type EggHatchAsset } from '@acme/assets/eggs';
import { Badge, HatchEgg3D, Image, LoadingSkeleton, MonStage, useInstanceStore, useReducedMotion, useStore, type ImageProps } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { monModelSource, type MonModelSource } from '../companion/mon-models';
import { monsCopy } from './copy';
import { dexDigits, type DexEntry } from './dex-model';

/** The picture of a form: its still by Dex number (never the hatch scene), or undefined when none ships. */
export function artForDex(dexId: number | null): CreatureArt | undefined {
  if (dexId === null) return undefined;
  return CREATURE_ART.find((a) => a.dexId === dexId && a.kind !== 'scene');
}

/** What stands for an entry, best first: its live model, its still, or nothing yet. Unseen forms show none of these. */
export type DexVisual =
  | { readonly kind: 'unseen' }
  | { readonly kind: 'mon3d'; readonly source: MonModelSource; readonly art: CreatureArt | undefined }
  | { readonly kind: 'egg3d'; readonly asset: EggHatchAsset; readonly art: CreatureArt | undefined }
  | { readonly kind: 'still'; readonly art: CreatureArt }
  | { readonly kind: 'none' };

export function dexVisual(entry: DexEntry): DexVisual {
  if (!entry.seen) return { kind: 'unseen' };
  const art = artForDex(entry.dexId);
  const mon = monModelSource(entry.dexId);
  if (mon !== null) return { kind: 'mon3d', source: mon, art };
  const egg = entry.stage === 'Egg' ? eggHatchAssetForSpecies(entry.speciesId) : undefined;
  if (egg !== undefined) return { kind: 'egg3d', asset: egg, art };
  return art === undefined ? { kind: 'none' } : { kind: 'still', art };
}

function Still({ art, decorative }: { art: CreatureArt; decorative: boolean }) {
  return (
    <Image
      fill
      framed={false}
      unoptimized
      src={art.source as ImageProps['src']}
      alt={decorative ? '' : art.alt}
      placeholder="blur"
      blurDataURL={art.blurDataURL}
      className="h-full w-full"
    />
  );
}

/**
 * The "???" silhouette for a form not seen yet: a sunken tile with a question
 * mark. Never the form's own outline, because a Baby is never shown before
 * the hatch (COPY_DECK glossary, P3).
 */
function Silhouette({ size }: { size: 'thumb' | 'hero' }) {
  return (
    <View
      accessible
      accessibilityLabel={monsCopy('mons.entry.unseen.art.a11y')}
      className="h-full w-full items-center justify-center bg-surface-sunken"
    >
      <Text aria-hidden className={size === 'thumb' ? 'font-display text-xr-title text-text-muted' : 'font-display text-[96px] leading-[100px] text-text-muted'}>
        ?
      </Text>
    </View>
  );
}

/**
 * A list row's thumbnail, 56 pt. Thumbnails never run a renderer (a live
 * canvas per row across 109 forms would not hold a frame rate), so a form with a model
 * shows its still: for Lil' Ratti that still is a render of its GLB.
 */
export function DexThumb({ entry }: { entry: DexEntry }) {
  const visual = dexVisual(entry);
  const art = visual.kind === 'still' ? visual.art : visual.kind === 'mon3d' || visual.kind === 'egg3d' ? visual.art : undefined;
  return (
    <View aria-hidden className="h-14 w-14 overflow-hidden border-2 border-structure/40 bg-surface-raised" style={{ borderCurve: 'continuous' }}>
      {visual.kind === 'unseen' ? <Silhouette size="thumb" /> : art !== undefined ? <Still art={art} decorative /> : (
        <View className="h-full w-full items-center justify-center">
          <Text className="text-xr-caption text-text-muted" style={{ fontVariant: ['tabular-nums'] }}>{dexDigits(entry.dexId)}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The Mon itself, big, on a plain stage: its live 3D model when a GLB ships
 * (MonStage for a Baby or Small, HatchEgg3D idling for an egg), the still
 * under it while the model loads and if it fails, the still with Coming Soon
 * when no model exists, a Coming Soon tile with neither, the silhouette when
 * unseen. Fills its parent.
 */
export function DexHero({ entry, name }: { entry: DexEntry; name: string }) {
  const reducedMotion = useReducedMotion();
  const visual = dexVisual(entry);
  const ui = useInstanceStore(() => ({ readyKey: null as string | null }));
  const readyKey = useStore(ui, (s) => s.readyKey);
  const key = entry.speciesId;
  const ready = readyKey === key;
  const markReady = () => ui.setState({ readyKey: key });

  if (visual.kind === 'unseen') return <Silhouette size="hero" />;
  if (visual.kind === 'none') {
    return (
      <View className="h-full w-full items-center justify-center">
        <Badge label={monsCopy('mons.comingSoon')} tone="neutral" />
      </View>
    );
  }
  if (visual.kind === 'still') {
    return (
      <View className="h-full w-full">
        <Still art={visual.art} decorative={false} />
        <View className="absolute bottom-3 left-0 right-0 items-center">
          <Badge label={monsCopy('mons.comingSoon')} tone="neutral" />
        </View>
      </View>
    );
  }

  // A live model: the still (or a skeleton) holds the space until the first frame.
  const placeholder = visual.art !== undefined ? <Still art={visual.art} decorative /> : <LoadingSkeleton count={1} className="h-full w-full" />;
  const label = monsCopy('mons.entry.model.a11y', { name });
  return (
    <View className="h-full w-full" accessible accessibilityRole="image" accessibilityLabel={label}>
      {ready ? null : (
        <View className="absolute inset-0" accessibilityLabel={monsCopy('mons.loading.a11y')}>
          {placeholder}
        </View>
      )}
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
        {visual.kind === 'mon3d' ? (
          <MonStage key={key} source={visual.source} reducedMotion={reducedMotion} fallback={placeholder} onReady={markReady} onError={markReady} />
        ) : (
          <HatchEgg3D
            key={key}
            eggId={visual.asset.eggId}
            source={visual.asset}
            phase={null}
            firstLook="lean-in"
            reducedMotion={reducedMotion}
            fallback={placeholder}
            onReady={markReady}
            onError={markReady}
          />
        )}
      </View>
    </View>
  );
}
