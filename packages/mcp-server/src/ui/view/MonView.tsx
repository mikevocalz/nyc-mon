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
import { Card } from '../../../../ui/Card';
import { CareMeterRing } from '../../../../ui/care/CareMeterRing';
import { CareMeterRingGroup } from '../../../../ui/care/CareMeterRingGroup';
import type { ControlTone } from '../../../../ui/district';
import { Heading } from '../../../../ui/Heading';
import { Image, type ImageProps } from '../../../../ui/Image';
import { StatusRow } from '../../../../ui/StatusRow';
import { Text } from '../../../../ui/Text';
import { ScrollView, View } from '../../../../ui/tw';
import type { ActionId, MonViewModel } from '../contract.ts';

/**
 * The Mon views, composed from kit stories and the companion screens:
 *  - Card: the Notch story (`variant="notch"`, `notchSides={['top']}`,
 *    `title`, `description`), toned per starter slot as W02 does
 *    (MonsIndexPage: orange, royal, leaf). It holds the Baby still, drawn as
 *    HomeLayout's `renderStill` draws it.
 *  - Status and rings sit on the page next to the Card, as the StatusRow and
 *    CareMeterRing stories show them, with `scheme` following the page (the
 *    GroupDaylit / GroupNight stories). They stay off the tone face: the kit's
 *    notch Card overrides themed text for its children, which leaves the chip
 *    and the ring plate unreadable on orange and leaf after dark.
 *  - Bar: M13's Feed, Rest or Wake, Play, and Journal (card) or Close
 *    (room): the asked-for action as the Cta story's button, the rest outline.
 *  - Room: the same, larger, plus M18's timeline rows (JournalScreen).
 * Every string is from packages/app/features/companion/copy.ts.
 */

/** W02's tones in starter-slot order. */
const SLOT_TONE: Readonly<Record<string, ControlTone>> = {
  'Hood Ratti': 'orange',
  'Bodega Baddiee Cee': 'royal',
  Yote: 'leaf',
};

export interface MonViewProps {
  readonly vm: MonViewModel;
  readonly layout: 'card' | 'room';
  readonly canExpand: boolean;
  /** The page theme; ring colours follow it as in the GroupDaylit / GroupNight stories. */
  readonly theme: 'light' | 'dark';
  readonly nowMs: number;
  /** Narrow frame (under about 600 px): the status and rings stack under the Card. */
  readonly narrow?: boolean;
  /** Room only: the canvas height in base px, so the room fills it. */
  readonly canvasHeight?: number;
  readonly onAction: (id: ActionId) => void;
  readonly onToggleRoom: () => void;
}

/** HomeLayout's renderStill, as written there: a sized box, the bare image filling it. */
function Still({ vm, width }: { vm: MonViewModel; width: number }) {
  const art = artFor('baby', vm.identity.dexId);
  if (!art) return null;
  return (
    <View style={{ width, aspectRatio: art.width / art.height }}>
      <Image src={art.source as ImageProps['src']} alt={art.alt} fill framed={false} unoptimized className="h-full w-full" />
    </View>
  );
}

function MonCard({ vm, stillWidth }: { vm: MonViewModel; stillWidth: number }) {
  const tone = SLOT_TONE[vm.identity.bloodlineName ?? ''] ?? 'orange';
  return (
    <Card variant="notch" tone={tone} notchSides={['top']} title={vm.name} description={vm.identity.bloodlineLabel ?? undefined}>
      <Still vm={vm} width={stillWidth} />
    </Card>
  );
}

function Care({ vm, theme }: { vm: MonViewModel; theme: 'light' | 'dark' }) {
  const care = vm.care;
  const scheme = theme === 'dark' ? 'night' : 'daylit';
  return (
    <View className="gap-4">
      {vm.status ? <StatusRow items={[{ id: 'status', label: vm.status.text, tone: vm.status.tone }]} /> : null}
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
 * (`variant="cta" size="lg" fullWidth`); every other action is the outline
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
          <Button variant={id === vm.suggested ? 'cta' : 'outline'} size="lg" fullWidth title={label} onPress={onPress} />
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

/** Card column width: wide enough for "Bodega Baddiee Cee Bloodline" on one line. */
const CARD_WIDTH = 300;

export function MonView(props: MonViewProps) {
  const { vm, layout, theme, nowMs } = props;
  if (props.narrow) {
    // Stacked: the Card, then the status and rings on the page, then the bar.
    return (
      <View className="gap-4">
        <MonCard vm={vm} stillWidth={160} />
        {layout === 'room' ? (
          <View className="gap-4">
            <Care vm={vm} theme={theme} />
            <Journal vm={vm} nowMs={nowMs} />
          </View>
        ) : (
          <Care vm={vm} theme={theme} />
        )}
        <Bar {...props} />
      </View>
    );
  }
  if (layout === 'room') {
    // Base px: the bar is about 64 tall with a 16 gap; the notch card adds its
    // top notch padding, title, description, gaps and bottom padding (about
    // 190) to the still, whose box is 4:5.
    const height = props.canvasHeight ?? 456;
    const stillWidth = Math.max(140, Math.min(CARD_WIDTH - 48, Math.round(((height - 64 - 16 - 190) * 4) / 5)));
    return (
      <View className="gap-4" style={{ height }}>
        <View className="min-h-0 flex-1 flex-row items-start gap-6">
          <View style={{ width: CARD_WIDTH }}>
            <MonCard vm={vm} stillWidth={stillWidth} />
          </View>
          <ScrollView className="min-h-0 flex-1 self-stretch" contentContainerClassName="gap-4">
            <Care vm={vm} theme={theme} />
            <Journal vm={vm} nowMs={nowMs} />
          </ScrollView>
        </View>
        <Bar {...props} />
      </View>
    );
  }
  return (
    <View className="gap-4">
      <View className="flex-row items-start gap-6">
        <View style={{ width: CARD_WIDTH }}>
          <MonCard vm={vm} stillWidth={160} />
        </View>
        <View className="flex-1">
          <Care vm={vm} theme={theme} />
        </View>
      </View>
      <Bar {...props} />
    </View>
  );
}
