import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { companionCopy } from '@acme/app/features/companion/copy.ts';
import { NEED_RING, isLow } from '@acme/app/features/companion/home-model.ts';
import { groupJournalByDay, journalEntryCopyId, showsFirstBadge, type DayHeading } from '@acme/app/features/companion/journal-model.ts';
import { artFor } from '@acme/app/features/companion/creature-art.ts';
import { hatchCopy } from '@acme/app/features/hatch/copy.ts';
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
import { HatchSequence3D } from '../../../../ui/three/mon/HatchSequence3D';
import { MonModel3D, type MouthRig } from '../../../../ui/three/mon/MonModel3D';
import type { MonSpeechCue } from '../../../../ui/three/mon/lipsync/cue.ts';
import { View } from '../../../../ui/tw';
import { clipsFor, eggDetailText, eggReady, eggTimeText, type ActionId, type MonViewModel } from '../contract.ts';

/**
 * The Mon views, composed from kit stories and the companion screens:
 *  - Stage: the Mon standing on the view, as virtual pets stand in their
 *    world, with its name and Bloodline as plain text above it. No card: the
 *    Mon is the screen, not an item on it.
 *  - Status and rings sit beside the Mon, as the StatusRow and CareMeterRing
 *    stories show them, with `scheme` following the page (the GroupDaylit /
 *    GroupNight stories).
 *  - Bar: M13's Feed, Rest or Wake, Play, and Close in the room
 *    (room): the asked-for action as the Cta story's button, the rest outline.
 *  - Room: the same header and bar, with M18's timeline rows (JournalScreen)
 *    where the card has its rings.
 *  - Egg: while the companion is still incubating, the Metro Egg stands in
 *    the Mon's place with M11's time left. No meters and no care buttons:
 *    none of them applies to an egg. Once it is ready, the bar has one
 *    button, "Hatch your egg", the touch twin of saying "hatch it".
 *  - Hatching: hatch_egg's result plays the egg cracking open into the Baby
 *    on the same stage (HatchSequence3D), then hands over to MonModel3D.
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
  /** Content width of a fitted canvas (768 less padding unless the frame is wider). */
  readonly canvasWidth?: number;
  readonly onAction: (id: ActionId) => void;
  readonly onToggleRoom: () => void;
  /**
   * The simulator's latest speech cue (host context). On a real Echo no host
   * sends one: Alexa speaks in its own voice and the Mon keeps its clip.
   */
  readonly speech?: MonSpeechCue | null;
  /** The action whose tool call is in flight; its button is disabled until it answers. */
  readonly busy?: ActionId | null;
}

declare const __MON_MODEL_ORIGIN__: string;

/**
 * Forms with a finished, rigged model (Dex number -> GLB on the sim host).
 * The clip each one loops follows the Mon's mood (`clipsFor`, contract.ts).
 * Every other Mon shows its still with "Coming Soon"; their models arrive
 * through the Payload console (mon-models).
 */
const MON_MODELS: Readonly<Record<number, { file: string; mouth?: MouthRig }>> = {
  // The Egg form: the hatch rig (packages/assets/eggs/metro-egg). No mouth.
  1: { file: 'metro-egg' },
  // Jaw angles read off the files' own clips (about the jaw's local X, from
  // bind): Squeaklet binds with the mouth ajar and its mouth_close clip shuts
  // it at +0.357; jaw_chomp opens to -0.286. Lil' Ratti binds shut;
  // face_pose_sweep's widest frame is -0.312. Rest: Lil' Ratti's neutral
  // geometry (all weights 0) has the mouth open, so its resting face is
  // mouthClose 1, the value its own emote clips rest on; frames at 0, 0.7 and
  // 1 showed lips meeting only at 1, without crushing. Squeaklet rests on
  // its mouth_close pose (jaw shut, mouthClose 1).
  2: { file: 'squeaklet', mouth: { jawBone: 'jaw', jawClosedRad: 0.357, jawOpenRad: -0.15, rest: { mouthClose: 1 } } },
  3: { file: 'lil-ratti', mouth: { jawBone: 'jaw', jawClosedRad: 0, jawOpenRad: -0.3, rest: { mouthClose: 1 } } },
};

const modelUrl = (file: string) => `${typeof __MON_MODEL_ORIGIN__ === 'string' ? __MON_MODEL_ORIGIN__ : ''}/mons/${file}.glb`;

/**
 * The hatch moment, then the Mon. MonModel3D mounts under the sequence once
 * the moment ends and replaces it as soon as its own model has loaded
 * (`aria-busy` false), so the Baby never blinks out between the two.
 */
function HatchStage({
  vm,
  file,
  eggFile,
  mouth,
  width,
  height,
  speech,
  onError,
  onHatched,
}: {
  vm: MonViewModel;
  file: string;
  eggFile: string;
  mouth: MouthRig | undefined;
  width: number;
  height: number;
  speech: MonSpeechCue | null;
  onError: () => void;
  onHatched?: () => void;
}) {
  const [stage, setStage] = useState<'playing' | 'handing-over' | 'mon'>('playing');
  const box = useRef<HTMLDivElement | null>(null);
  const clips = clipsFor(vm.identity.dexId, vm.mood, vm.asleep) ?? [];
  useEffect(() => {
    if (stage !== 'handing-over' || !box.current) return;
    const el = box.current;
    const ready = () => el.querySelector('[data-layer="mon"] [role=img][aria-busy="false"]') !== null;
    if (ready()) {
      setStage('mon');
      return;
    }
    const watch = new MutationObserver(() => {
      if (ready()) setStage('mon');
    });
    watch.observe(el, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    return () => watch.disconnect();
  }, [stage]);
  return (
    <div ref={box} style={{ width, height, position: 'relative' }}>
      {stage === 'playing' ? null : (
        <div data-layer="mon" style={{ position: 'absolute', inset: 0 }}>
          <MonModel3D url={modelUrl(file)} clips={clips} width={width} height={height} label={vm.name} onError={onError} {...(mouth ? { mouth, speech } : {})} />
        </div>
      )}
      {stage === 'mon' ? null : (
        <div style={{ position: 'absolute', inset: 0 }}>
          <HatchSequence3D
            eggUrl={modelUrl(eggFile)}
            monUrl={modelUrl(file)}
            monClips={clips}
            width={width}
            height={height}
            label={hatchCopy('m12.a11y.crack')}
            announcements={{
              intro: hatchCopy('m12.a11y.stir'),
              shake1: hatchCopy('m12.a11y.crack'),
              tension: hatchCopy('m12.a11y.pressure'),
              resolve: hatchCopy('m12.a11y.hatched_from', { babyName: vm.name, eggName: vm.hatching?.eggName ?? '' }),
              crossfade: hatchCopy('m12.a11y.hatched_from', { babyName: vm.name, eggName: vm.hatching?.eggName ?? '' }),
            }}
            onDone={() => {
              setStage((s) => (s === 'playing' ? 'handing-over' : s));
              onHatched?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

/** The Mon in 3D (three.js) when its model exists; otherwise HomeLayout's still with a Coming Soon badge. */
function Still({
  vm,
  width,
  nowMs,
  speech,
  height = Math.round(width * 1.25),
  onHatched,
}: {
  vm: MonViewModel;
  width: number;
  nowMs: number;
  speech: MonSpeechCue | null;
  height?: number;
  /** The hatch moment has ended (or cannot play here), so the card can show the Mon's controls. */
  onHatched?: () => void;
}) {
  const dex = vm.identity.dexId;
  const model = dex === null ? undefined : MON_MODELS[dex];
  const [failed, setFailed] = useState(false);
  const art = artFor(vm.egg ? 'egg' : 'baby', dex);
  const eggModel = vm.hatching?.eggDexId == null ? undefined : MON_MODELS[vm.hatching.eggDexId];
  const playable = Boolean(model && !failed && vm.hatching && eggModel);
  // No hatch to play (a model is missing or failed): the Mon shows straight away.
  useEffect(() => {
    if (vm.hatching && !playable) onHatched?.();
  }, [vm.hatching, playable, onHatched]);
  if (model && !failed && vm.hatching && eggModel) {
    return (
      <HatchStage
        key={vm.hatching.eggId}
        vm={vm}
        file={model.file}
        eggFile={eggModel.file}
        mouth={model.mouth}
        width={width}
        height={height}
        speech={speech}
        onError={() => setFailed(true)}
        onHatched={onHatched}
      />
    );
  }
  if (model && !failed) {
    const label = vm.egg
      ? hatchCopy(eggReady(vm.egg, nowMs) ? 'm11.egg.a11y.label.ready' : 'm11.egg.a11y.label', { eggName: vm.name })
      : vm.name;
    const clips = clipsFor(dex, vm.mood, vm.asleep) ?? [];
    return (
      // A mood change cross-fades the clip inside MonModel3D; the GLB is not reloaded.
      <MonModel3D
        url={modelUrl(model.file)}
        clips={clips}
        width={width}
        height={height}
        label={label}
        onError={() => setFailed(true)}
        {...(model.mouth && !vm.egg ? { mouth: model.mouth, speech } : {})}
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
function Stage({
  vm,
  title,
  stillWidth,
  nowMs,
  speech,
  onHatched,
}: {
  vm: MonViewModel;
  title: string;
  stillWidth: number;
  nowMs: number;
  speech: MonSpeechCue | null;
  onHatched: () => void;
}) {
  return (
    <View className="items-center gap-2">
      <View className="items-center">
        <Heading level={1} size="title">{title}</Heading>
        {vm.identity.bloodlineLabel ? <Text variant="caption" tone="muted">{vm.identity.bloodlineLabel}</Text> : null}
      </View>
      <Still vm={vm} width={stillWidth} nowMs={nowMs} speech={speech} onHatched={onHatched} />
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

/** M11's time left, as the Incubating screen words it, where a Mon has its rings. */
function Incubation({ vm, nowMs }: { vm: MonViewModel; nowMs: number }) {
  const egg = vm.egg;
  if (!egg) return null;
  const ready = eggReady(egg, nowMs);
  const detail = eggDetailText(egg, vm.name, nowMs);
  return (
    <View className="gap-2">
      <Heading level={2} size="display-sm">{eggTimeText(egg, nowMs)}</Heading>
      {detail ? <Text tone="muted">{detail}</Text> : null}
      {ready ? null : <Text variant="caption" tone="muted">{hatchCopy('m11.caption.counting')}</Text>}
    </View>
  );
}

/**
 * M13's bar. The action the Mon is asking for is the Cta story's button
 * (`variant="cta" size="sm" fullWidth`), small so the Mon keeps the height; every other action is the outline
 * button from FullWidthWraps. hlynk-care is drawn over the live scene and
 * reads black-on-navy here, where there is no scene.
 */
function Bar(props: MonViewProps) {
  const { vm, layout, canExpand, narrow, onAction, onToggleRoom } = props;
  const items: (readonly [string, string, () => void])[] = [];
  if (vm.egg) {
    // An egg has no care actions and no journal yet: only Hatch once it is
    // ready, and the room's way back.
    if (eggReady(vm.egg, props.nowMs)) items.push(['hatch', hatchCopy('m12.trackpad.open'), () => onAction('hatch')]);
    if (canExpand && layout === 'room') items.push(['mode', companionCopy('m14.close'), onToggleRoom]);
    if (items.length === 0) return null;
  } else {
    items.push(
      ['feed', companionCopy('m13.bar.feed'), () => onAction('feed')],
      vm.asleep
        ? ['wake', companionCopy('m13.bar.wake'), () => onAction('wake')]
        : ['rest', companionCopy('m13.bar.rest'), () => onAction('rest')],
      ['play', companionCopy('m13.bar.play'), () => onAction('play')],
    );
    // No Journal button on the card: nothing on the server keeps a journal yet
    // (it lives in the app's local save), so it only enlarged the card. The
    // room keeps its Close for a host that opens it fullscreen.
    if (canExpand && layout === 'room') items.push(['mode', companionCopy('m14.close'), onToggleRoom]);
  }
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map(([id, label, onPress]) => (
        // Narrow: two per row, so labels never squeeze below the button's own size.
        <View key={id} style={narrow ? { flexBasis: '45%', flexGrow: 1 } : { flex: 1 }}>
          <Button variant={id === vm.suggested || id === 'hatch' ? 'cta' : 'outline'} size="sm" fullWidth title={label} onPress={onPress} disabled={props.busy === id} />
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

/**
 * M18's heading and timeline rows (JournalScreen), newest first, without the
 * calendar. With `fit`, it fills its box and shows only the entries that fit
 * whole (without the M18 heading, which becomes the box's label), with no measuring: the box is a column that wraps, so a row that
 * would cross the bottom edge moves to a second column, and that column (each
 * item is the box's full width) sits past the right edge, clipped. A day's
 * heading travels with its first row, so no heading is left without one.
 */
function Journal({ vm, nowMs, fit = false }: { vm: MonViewModel; nowMs: number; fit?: boolean }) {
  const entries = useMemo(() => [...vm.journal].sort((a, b) => b.at - a.at), [vm.journal]);
  if (entries.length === 0) return null;
  const groups = groupJournalByDay(entries, nowMs);
  const row = (entry: (typeof entries)[number]) => (
    <View key={entry.entryId} testID="journal-row" className="flex-row items-center gap-3">
      <Text>{companionCopy(journalEntryCopyId(entry), { name: vm.name })}</Text>
      {showsFirstBadge(entry) ? <Badge label={companionCopy('m18.first')} size="sm" tone="neutral" /> : null}
    </View>
  );
  const item = fit ? { width: '100%' as const } : undefined;
  return (
    <View
      className={fit ? 'min-h-0 flex-1 flex-col flex-wrap content-start gap-1 overflow-hidden' : 'gap-1'}
      accessibilityLabel={fit ? companionCopy('m18.heading', { name: vm.name }) : companionCopy('m18.timeline.a11y')}
    >
      {/* Fitted under the room's own header, which already names the Mon, the
          entries get the room; the box keeps the M18 heading as its label. */}
      {fit ? null : <Heading level={2} size="title">{companionCopy('m18.heading', { name: vm.name })}</Heading>}
      {groups.flatMap((g) => {
        const [first, ...rest] = g.entries;
        return [
          <View key={g.iso} style={item} className="gap-1 pt-1">
            <Text variant="caption" tone="muted">{headingText(g.heading)}</Text>
            {first ? row(first) : null}
          </View>,
          ...rest.map((entry) => (
            <View key={`${entry.entryId}-item`} style={item}>
              {row(entry)}
            </View>
          )),
        ];
      })}
    </View>
  );
}

/** "Your egg started hatching" (M11), where the Mon's rings will be once it is out. */
function Hatching() {
  return <Heading level={2} size="display-sm">{hatchCopy('m11.time.resume')}</Heading>;
}

export function MonView(props: MonViewProps) {
  const { vm, layout, theme, nowMs } = props;
  const speech = props.speech ?? null;
  const height = props.canvasHeight ?? 456;
  // While the egg is cracking open the card is still the egg's: its name, no
  // status, rings or buttons. They arrive with the Baby (onHatched).
  const [hatchedEggId, setHatchedEggId] = useState<string | null>(null);
  const hatchingEggId = vm.hatching?.eggId ?? null;
  const hatching = vm.hatching !== null && hatchedEggId !== vm.hatching.eggId;
  const onHatched = useCallback(() => setHatchedEggId(hatchingEggId), [hatchingEggId]);
  const title = hatching && vm.hatching ? vm.hatching.eggName : vm.name;
  if (props.narrow) {
    // Stacked at content height: the Mon, then the status and rings, then the
    // bar. A narrow host grows the frame to fit (main.tsx), so nothing clips.
    return (
      <View className="gap-4">
        <Stage vm={vm} title={title} stillWidth={220} nowMs={nowMs} speech={speech} onHatched={onHatched} />
        {hatching ? <Hatching /> : vm.egg ? <Incubation vm={vm} nowMs={nowMs} /> : <Care vm={vm} theme={theme} />}
        {layout === 'room' && !hatching ? <Journal vm={vm} nowMs={nowMs} /> : null}
        {hatching ? null : <Bar {...props} />}
      </View>
    );
  }
  // The Mon stands on the right in a square box at 90% of the frame's height
  // (the turntable sweeps the tail out to the sides, so a narrow box would
  // shrink it); name, rings and the bar stack on the left.
  const stillSize = Math.max(160, Math.round(height * 0.9));
  // The canvas less its padding and the 24 px gap: three small buttons fit in
  // one row from about 360 px.
  const twoRowBar = (props.canvasWidth ?? 744) - 24 - stillSize < 360;
  // The room shows the journal where the card has its rings (the rings and a
  // journal do not both fit one screen); a room with no journal yet keeps the rings.
  const journalInstead = layout === 'room' && vm.journal.length > 0;
  return (
    <View className="flex-row gap-6" style={{ height }}>
      <View className="min-h-0 flex-1 justify-between gap-3">
        {/* Name, Bloodline and status share one row so the rings keep their height. */}
        <View className="gap-1">
          <Heading level={1} size="title">{title}</Heading>
          <View className="flex-row flex-wrap items-center gap-3">
            {vm.identity.bloodlineLabel ? <Text variant="caption" tone="muted">{vm.identity.bloodlineLabel}</Text> : null}
            {vm.status && !vm.egg && !hatching ? <StatusRow items={[{ id: 'status', label: vm.status.text, tone: vm.status.tone }]} /> : null}
          </View>
        </View>
        <View className={`min-h-0 flex-1 gap-4 overflow-hidden ${journalInstead && !hatching ? 'justify-start' : 'justify-center'}`}>
          {hatching ? (
            <Hatching />
          ) : vm.egg ? (
            <Incubation vm={vm} nowMs={nowMs} />
          ) : journalInstead ? (
            <Journal vm={vm} nowMs={nowMs} fit />
          ) : (
            <Care vm={vm} theme={theme} status={false} />
          )}
        </View>
        {hatching ? null : <Bar {...props} narrow={twoRowBar} />}
      </View>
      <View className="justify-end">
        <Still vm={vm} width={stillSize} height={stillSize} nowMs={nowMs} speech={speech} onHatched={onHatched} />
      </View>
    </View>
  );
}
