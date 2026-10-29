'use client';

import type { ReactNode } from 'react';
import type { MonCareView } from '@acme/core/sim';
import {
  HeartRow, Image, LcdIconButton, LcdPanel, PixelGlyph, SegmentBar, SegmentNumber, type ImageProps, type LcdColors,
} from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { companionCopy } from '../companion/copy';
import type { CreatureArt } from '@acme/assets/creatures';
import {
  MON_SPACE_ICONS, ageLine, iconCopy, iconDisabled, lcdField, poopLine, type Line, type MonSpaceIcon, type MonSpaceUi,
} from './mon-space-model';

const fill = (line: Line, name: string) => companionCopy(line.copy, { name, ...line.tokens });

/** Glyph per icon (packages/ui/care/pixel-glyphs.ts). */
const GLYPH = {
  meal: 'meal', snack: 'snack', play: 'play', lights: 'lights', clean: 'clean', medicine: 'medicine',
  boundary: 'discipline', status: 'status', pause: 'pause',
} as const satisfies Record<MonSpaceIcon, string>;

export interface MonSpaceLcdProps {
  readonly view: MonCareView;
  readonly ui: MonSpaceUi;
  readonly name: string;
  readonly scheme: 'daylit' | 'night';
  /** The evolve beat: the LCD inverts for one beat on top of the lights state. */
  readonly beat: boolean;
  readonly art: CreatureArt | undefined;
  /** Idle vignette step: the sprite shifts one place per vignette (none under reduced motion's tween; it just moves). */
  readonly pose: number;
  readonly status: string;
  readonly onIcon: (icon: MonSpaceIcon) => void;
  /** The name plate for the evolve and hatch moments. */
  readonly plate: ReactNode;
  readonly compactIcons: boolean;
}

/**
 * The Mon Space LCD on the 2D path (`LcdPanel`): heart rows, the Mon and its
 * field (piles, the cold, the call glyph, sleep), the status line, the icon
 * bar and the status page. Every element has a real accessible twin: the
 * hearts and numerals are labelled kit parts, the icons are buttons.
 */
export function MonSpaceLcd({ view, ui, name, scheme, beat, art, pose, status, onIcon, plate, compactIcons }: MonSpaceLcdProps) {
  const field = lcdField(view);
  const inverted = field.inverted !== beat;
  const focused = MON_SPACE_ICONS[ui.focus] ?? 'meal';
  const caption = companionCopy(iconCopy(focused, view).label, { name });
  return (
    <LcdPanel scheme={scheme} inverted={inverted} testID="m32-lcd">
      {(c) => (
        <View className="flex-1 justify-between gap-2 p-3">
          {ui.layer === 'status' ? <StatusPage view={view} name={name} c={c} /> : (
            <>
              <Hearts view={view} c={c} />
              <MonField view={view} c={c} name={name} art={art} pose={pose} plate={plate} />
            </>
          )}
          <Text
            testID="m32-status"
            accessibilityRole="text"
            aria-live="polite"
            className="text-center font-display text-type-body"
            style={{ color: c.ink }}
          >
            {status}
          </Text>
          <IconBar view={view} ui={ui} c={c} name={name} onIcon={onIcon} compact={compactIcons} />
          <Text className="text-center text-type-caption" style={{ color: c.ink }} numberOfLines={1} {...{ 'aria-hidden': true }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {caption}
          </Text>
        </View>
      )}
    </LcdPanel>
  );
}

function Hearts({ view, c }: { view: MonCareView; c: LcdColors }) {
  const rows = [
    ['fullness', 'monspace.hearts.fullness', view.hearts.fullness],
    ['energy', 'monspace.hearts.energy', view.hearts.energy],
    ['social', 'monspace.hearts.social', view.hearts.social],
  ] as const;
  return (
    <View className="gap-1">
      {rows.map(([id, label, count]) => (
        <HeartRow
          key={id}
          testID={`m32-hearts-${id}`}
          filled={count}
          label={companionCopy(label)}
          accessibilityLabel={`${companionCopy(label)}, ${companionCopy('monspace.a11y.hearts', { count })}`}
          color={c.ink}
          emptyColor={c.ink}
          cell={3}
          labelClassName="text-type-label"
        />
      ))}
    </View>
  );
}

function MonField({ view, c, name, art, pose, plate }: { view: MonCareView; c: LcdColors; name: string; art: CreatureArt | undefined; pose: number; plate: ReactNode }) {
  const field = lcdField(view);
  const piles = poopLine(field.piles);
  // The sprite steps between three places on the idle vignettes (the Mon is never a statue).
  const shift = [0, -18, 18][((pose % 3) + 3) % 3] ?? 0;
  return (
    <View className="relative min-h-0 flex-1 items-center justify-center">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={companionCopy('monspace.a11y.mon', { name })}
        aria-label={companionCopy('monspace.a11y.mon', { name })}
        className="w-[52%] max-w-56 items-center"
        style={{ transform: [{ translateX: shift }], opacity: field.asleep ? 0.55 : 1 }}
      >
        {art === undefined ? (
          <PixelGlyph glyph="play" cell={6} color={c.ink} />
        ) : (
          <View className="w-full" style={{ aspectRatio: art.width / art.height }}>
            <Image src={art.source as ImageProps['src']} alt="" fill framed={false} unoptimized className="h-full w-full" />
          </View>
        )}
      </View>
      {field.asleep ? (
        <View className="absolute right-[18%] top-1" {...{ 'aria-hidden': true }}>
          <PixelGlyph glyph="sleep" cell={3} color={c.ink} />
        </View>
      ) : null}
      {field.callGlyph ? (
        <View className="absolute right-[20%] top-0" {...{ 'aria-hidden': true }}>
          <PixelGlyph glyph="attention" cell={5} color={c.ink} />
        </View>
      ) : null}
      {field.cold ? (
        <View
          testID="m32-cold"
          accessible
          accessibilityRole="text"
          accessibilityLabel={companionCopy('monspace.status.cold', { name })}
          className="absolute left-[14%] top-1 flex-row items-start gap-1"
        >
          <PixelGlyph glyph="cold" cell={3} color={c.ink} />
          <PixelGlyph glyph="sneeze" cell={3} color={c.ink} />
        </View>
      ) : null}
      {piles !== null ? (
        <View
          testID="m32-poop"
          accessible
          accessibilityRole="text"
          accessibilityLabel={companionCopy(piles.copy, piles.tokens)}
          className="absolute bottom-0 right-1 flex-row items-end gap-1"
        >
          {Array.from({ length: field.piles }, (_, i) => <PixelGlyph key={i} glyph="poop" cell={3} color={c.ink} />)}
        </View>
      ) : null}
      {plate}
    </View>
  );
}

function IconBar({ view, ui, c, name, onIcon, compact }: { view: MonCareView; ui: MonSpaceUi; c: LcdColors; name: string; onIcon: (icon: MonSpaceIcon) => void; compact: boolean }) {
  // Phones: two rows (5 + 4) so every icon keeps a 44 pt target; wide windows: one row of nine.
  const rows: (readonly MonSpaceIcon[])[] = compact ? [MON_SPACE_ICONS.slice(0, 5), MON_SPACE_ICONS.slice(5)] : [MON_SPACE_ICONS];
  return (
    <View role="toolbar" aria-label={companionCopy('monspace.title')} className="gap-1">
      {rows.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((icon) => {
            const copy = iconCopy(icon, view);
            return (
              <LcdIconButton
                key={icon}
                testID={`m32-menu-${icon}`}
                glyph={GLYPH[icon]}
                label={companionCopy(copy.label, { name })}
                hint={companionCopy(copy.hint, { name })}
                focused={MON_SPACE_ICONS[ui.focus] === icon}
                disabled={iconDisabled(icon, view)}
                colors={c}
                onPress={() => onIcon(icon)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Status page (B on Status): hearts, boundaries, weight and age in segment numerals, the stage. No mistakes (D20e), no weight band (D20f). */
function StatusPage({ view, name, c }: { view: MonCareView; name: string; c: LcdColors }) {
  const age = ageLine(view.ageDays);
  return (
    <View className="flex-1 justify-center gap-3" testID="m32-status-page">
      <Hearts view={view} c={c} />
      <SegmentBar
        testID="m32-boundaries"
        filled={view.discipline}
        label={companionCopy('monspace.status.boundaries')}
        accessibilityLabel={`${companionCopy('monspace.status.boundaries')}, ${companionCopy('monspace.status.boundaries.value', { level: view.discipline })}`}
        color={c.ink}
        labelClassName="text-type-label"
      />
      <View className="flex-row flex-wrap items-end gap-6">
        <View className="gap-1">
          <Text className="text-type-label" style={{ color: c.ink }} {...{ 'aria-hidden': true }}>{companionCopy('monspace.status.weight')}</Text>
          <SegmentNumber
            testID="m32-weight"
            value={view.weight}
            color={c.ink}
            unlit={c.unlit}
            accessibilityLabel={`${companionCopy('monspace.status.weight')} ${companionCopy('monspace.status.weight.value', { weight: view.weight })}`}
          />
        </View>
        <View className="gap-1">
          <Text className="text-type-label" style={{ color: c.ink }} {...{ 'aria-hidden': true }}>{companionCopy('monspace.status.age')}</Text>
          <SegmentNumber
            testID="m32-age"
            value={view.ageDays}
            width={3}
            color={c.ink}
            unlit={c.unlit}
            accessibilityLabel={`${companionCopy('monspace.status.age')} ${fill(age, name)}`}
          />
        </View>
      </View>
      <Text className="text-type-label" style={{ color: c.ink }} testID="m32-stage">
        {companionCopy('monspace.status.stage', { stage: view.stage })}
      </Text>
    </View>
  );
}
