import { useState } from 'react';
import { companionCopy } from '@acme/app/features/companion/copy.ts';
import { NEED_RING, isLow } from '@acme/app/features/companion/home-model.ts';
import { groupJournalByDay, journalEntryCopyId, showsFirstBadge, type DayHeading } from '@acme/app/features/companion/journal-model.ts';
import { artFor } from '@acme/app/features/companion/mon-identity.ts';
// Kit components are imported the way their Storybook stories import them
// (from the component file, not the @acme/ui barrel) and used with the props
// those stories, or the existing screens, pass. The one className on a kit
// component is Image's `h-full w-full`, exactly as HomeLayout's renderStill
// passes it; otherwise plain layout Views go around them.
import { Badge } from '../../../../ui/Badge';
import { Button } from '../../../../ui/Button';
import { CareMeterRing } from '../../../../ui/care/CareMeterRing';
import { CareMeterRingGroup } from '../../../../ui/care/CareMeterRingGroup';
import { Heading } from '../../../../ui/Heading';
import { Image, type ImageProps } from '../../../../ui/Image';
import { StatusRow } from '../../../../ui/StatusRow';
import { Text } from '../../../../ui/Text';
import { MonModel3D } from '../../../../ui/three/mon/MonModel3D';
import { View } from '../../../../ui/tw';
import type { ActionId, MonViewModel } from '../contract.ts';

/**
 * The Mon views, composed from kit stories and the companion screens:
 *  - Stage: the Mon standing on the view, as virtual pets stand in their
 *    world, with its name and Bloodline as plain text above it. No card: the
 *    Mon is the screen, not an item on it.
 *  - Status and rings sit beside the Mon, as the StatusRow and CareMeterRing
 *    stories show them, with `scheme` following the page (the GroupDaylit /
 *    GroupNight stories).
 *  - Bar: M13's Feed, Rest or Wake, Play, and Journal (card) or Close
 *    (room): the asked-for action as the Cta story's button, the rest outline.
 *  - Room: the same, larger, plus M18's timeline rows (JournalScreen).
 * Every string is from packages/app/features/companion/copy.ts.
 */

export interface MonViewProps {
  readonly vm: MonViewModel;
  readonly layout: 'card' | 'room';
  readonly canExpand: boolean;
  /** The page theme; ring colours follow it as in the GroupDaylit / GroupNight stories. */
  readonly theme: 'light' | 'dark';
  readonly nowMs: number;
  /** Narrow frame (under about 600 px): the status and rings stack under the Mon. */
  readonly narrow?: boolean;
  /** Room only: the canvas height in base px, so the room fills it. */
  readonly canvasHeight?: number;
  readonly onAction: (id: ActionId) => void;
  readonly onToggleRoom: () => void;
}

declare const __MON_MODEL_ORIGIN__: string;

/**
 * Forms with a finished, rigged model (Dex number -> GLB on the sim host and
 * the clip to loop). Every other Mon shows its still with "Coming Soon";
 * their models arrive through the Payload console (mon-models).
 */
const MON_MODELS: Readonly<Record<number, { file: string; clips: readonly string[] }>> = {
  2: { file: 'squeaklet', clips: ['tail_swish', 'rat_run'] },
  3: { file: 'lil-ratti', clips: ['up_idle', 'up_breathe', 'quad_idle_sniff'] },
};

/** The Mon in 3D (three.js) when its model exists; otherwise HomeLayout's still with a Coming Soon badge. */
function Still({ vm, width, height = Math.round(width * 1.25) }: { vm: MonViewModel; width: number; height?: number }) {
  const dex = vm.identity.dexId;
  const model = dex === null ? undefined : MON_MODELS[dex];
  const [failed, setFailed] = useState(false);
  const art = artFor('baby', dex);
  if (model && !failed) {
    return (
      <MonModel3D
        url={`${typeof __MON_MODEL_ORIGIN__ === 'string' ? __MON_MODEL_ORIGIN__ : ''}/mons/${model.file}.glb`}
        clips={model.clips}
        width={width}
        height={height}
        label={vm.name}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!art) return <Badge label="Coming Soon" tone="neutral" />;
  return (
    <View style={{ width, aspectRatio: art.width / art.height }}>
      <Image src={art.source as ImageProps['src']} alt={art.alt} fill framed={false} unoptimized className="h-full w-full" />
      {model ? null : (
        <View className="absolute left-2 top-2">
          <Badge label="Coming Soon" tone="neutral" />
        </View>
      )}
    </View>
  );
}

/**
 * The Mon on its stage, the way virtual pets stand in their world (no card
 * around it): name and Bloodline as plain text above, the Mon itself below.
 */
function Stage({ vm, stillWidth }: { vm: MonViewModel; stillWidth: number }) {
  return (
    <View className="items-center gap-2">
      <View className="items-center">
        <Heading level={1} size="title">{vm.name}</Heading>
        {vm.identity.bloodlineLabel ? <Text variant="caption" tone="muted">{vm.identity.bloodlineLabel}</Text> : null}
      </View>
      <Still vm={vm} width={stillWidth} />
    </View>
  );
}

function Care({ vm, theme, status = true }: { vm: MonViewModel; theme: 'light' | 'dark'; status?: boolean }) {
  const care = vm.care;
  const scheme = theme === 'dark' ? 'night' : 'daylit';
  return (
    <View className="gap-4">
      {status && vm.status ? <StatusRow items={[{ id: 'status', label: vm.status.text, tone: vm.status.tone }]} /> : null}
      {care ? (
        <View className="self-start">
          <CareMeterRingGroup accessibilityLabel={companionCopy('m13.rings.a11y.label')}>
            {(['energy', 'fullness', 'social'] as const).map((need) => (
              <CareMeterRing
                key={need}
                need={need}
                value={care[need]}
                label={companionCopy(NEED_RING[need])}
                low={isLow(care[need])}
                lowLabel={companionCopy('m13.ring.low')}
                scheme={scheme}
                reducedMotion
              />
            ))}
          </CareMeterRingGroup>
        </View>
      ) : null}
    </View>
  );
}

/**
 * M13's bar. The action the Mon is asking for is the Cta story's button
 * (`variant="cta" size="sm" fullWidth`), small so the Mon keeps the height; every other action is the outline
 * button from FullWidthWraps. hlynk-care is drawn over the live scene and
 * reads black-on-navy here, where there is no scene.
 */
function Bar({ vm, layout, canExpand, narrow, onAction, onToggleRoom }: MonViewProps) {
  const items: (readonly [string, string, () => void])[] = [
    ['feed', companionCopy('m13.bar.feed'), () => onAction('feed')],
    vm.asleep
      ? ['wake', companionCopy('m13.bar.wake'), () => onAction('wake')]
      : ['rest', companionCopy('m13.bar.rest'), () => onAction('rest')],
    ['play', companionCopy('m13.bar.play'), () => onAction('play')],
  ];
  if (canExpand) {
    items.push(layout === 'room' ? ['mode', companionCopy('m14.close'), onToggleRoom] : ['mode', companionCopy('m18.title'), onToggleRoom]);
  }
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map(([id, label, onPress]) => (
        // Narrow: two per row, so labels never squeeze below the button's own size.
        <View key={id} style={narrow ? { flexBasis: '45%', flexGrow: 1 } : { flex: 1 }}>
          <Button variant={id === vm.suggested ? 'cta' : 'outline'} size="sm" fullWidth title={label} onPress={onPress} />
        </View>
      ))}
    </View>
  );
}

function headingText(heading: DayHeading): string {
  switch (heading.kind) {
    case 'today': return companionCopy('m18.day.today');
    case 'yesterday': return companionCopy('m18.day.yesterday');
    case 'date': return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(heading.atMs));
  }
}

/** M18's heading and timeline rows (JournalScreen), newest day first, without the calendar. */
function Journal({ vm, nowMs }: { vm: MonViewModel; nowMs: number }) {
  if (vm.journal.length === 0) return null;
  const groups = groupJournalByDay(vm.journal, nowMs);
  return (
    <View className="gap-2" accessibilityLabel={companionCopy('m18.timeline.a11y')}>
      <Heading level={2} size="title">{companionCopy('m18.heading', { name: vm.name })}</Heading>
      {groups.map((g) => (
        <View key={g.iso} className="gap-1">
          <Text variant="caption" tone="muted">{headingText(g.heading)}</Text>
          {g.entries.map((entry) => (
            <View key={entry.entryId} className="flex-row items-center gap-3">
              <Text>{companionCopy(journalEntryCopyId(entry), { name: vm.name })}</Text>
              {showsFirstBadge(entry) ? <Badge label={companionCopy('m18.first')} size="sm" tone="neutral" /> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function MonView(props: MonViewProps) {
  const { vm, layout, theme, nowMs } = props;
  const height = props.canvasHeight ?? 456;
  if (props.narrow) {
    // Stacked at content height: the Mon, then the status and rings, then the
    // bar. A narrow host grows the frame to fit (main.tsx), so nothing clips.
    return (
      <View className="gap-4">
        <Stage vm={vm} stillWidth={220} />
        <Care vm={vm} theme={theme} />
        {layout === 'room' ? <Journal vm={vm} nowMs={nowMs} /> : null}
        <Bar {...props} />
      </View>
    );
  }
  // The Mon stands on the right in a square box at 90% of the frame's height
  // (the turntable sweeps the tail out to the sides, so a narrow box would
  // shrink it); name, rings and the bar stack on the left.
  const stillSize = Math.max(160, Math.round(height * 0.9));
  // The 768 canvas less its 24 px padding and the 24 px gap: four small
  // buttons fit in one row from about 480 px ("Journal" wraps below that).
  const twoRowBar = 720 - stillSize < 480;
  return (
    <View className="flex-row gap-6" style={{ height }}>
      <View className="min-h-0 flex-1 justify-between gap-3">
        {/* Name, Bloodline and status share one row so the rings keep their height. */}
        <View className="gap-1">
          <Heading level={1} size="title">{vm.name}</Heading>
          <View className="flex-row flex-wrap items-center gap-3">
            {vm.identity.bloodlineLabel ? <Text variant="caption" tone="muted">{vm.identity.bloodlineLabel}</Text> : null}
            {vm.status ? <StatusRow items={[{ id: 'status', label: vm.status.text, tone: vm.status.tone }]} /> : null}
          </View>
        </View>
        <View className="min-h-0 flex-1 justify-center gap-4 overflow-hidden">
          <Care vm={vm} theme={theme} status={false} />
          {layout === 'room' ? <Journal vm={vm} nowMs={nowMs} /> : null}
        </View>
        <Bar {...props} narrow={twoRowBar} />
      </View>
      <View className="justify-end">
        <Still vm={vm} width={stillSize} height={stillSize} />
      </View>
    </View>
  );
}
