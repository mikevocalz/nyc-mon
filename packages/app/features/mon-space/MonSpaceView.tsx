'use client';

import type { MonCareView } from '@acme/core/sim';
import type { CreatureArt } from '@acme/assets/creatures';
import {
  Button, CallLamp, ClassicKey, Heading, HeartRow, KeyValueList, SafeArea, SheetSurface, SignagePlate,
} from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { companionCopy, type CompanionCopyId } from '../companion/copy';
import { MonSpaceLcd } from './MonSpaceLcd';
import { ageLine, lampCopy, lampFor, type MonSpaceIcon, type MonSpaceKey, type MonSpaceUi } from './mon-space-model';

export interface MonSpaceViewProps {
  readonly view: MonCareView;
  readonly ui: MonSpaceUi;
  readonly name: string;
  readonly scheme: 'daylit' | 'night';
  /** Tablets and open foldables: the readable twins sit beside the LCD. */
  readonly wide: boolean;
  readonly reducedMotion: boolean;
  /** The status line, already in words. */
  readonly status: string;
  readonly beat: boolean;
  readonly pose: number;
  readonly art: CreatureArt | undefined;
  readonly moment: { readonly kind: 'evolve' | 'hatch'; readonly text: string } | null;
  readonly askOpen: boolean;
  readonly onIcon: (icon: MonSpaceIcon) => void;
  readonly onKey: (key: MonSpaceKey) => void;
  readonly onAsk: (on: boolean) => void;
}

/**
 * M32 Mon Space, presentational: header (Back, the Mon's name, the lamp),
 * the LCD, the A/B/C keys, the pause confirm and the Mon calls ask. All
 * state comes in as props; `MonSpaceScreen` binds it to the store.
 */
export function MonSpaceView({
  view, ui, name, scheme, wide, reducedMotion, status, beat, pose, art, moment, askOpen, onIcon, onKey, onAsk,
}: MonSpaceViewProps) {
  const press = onKey;
  const answerAsk = onAsk;
  const lamp = lampFor(view);
  const plate = moment === null ? null : (
    <View className="absolute inset-x-0 bottom-2 items-center">
      <SignagePlate testID="m32-plate" text={moment.text} accessibilityLabel={moment.text} maxSize="title" />
    </View>
  );

  const lcd = (
    <MonSpaceLcd
      view={view}
      ui={ui}
      name={name}
      scheme={scheme}
      beat={beat}
      art={art}
      pose={reducedMotion ? 0 : pose}
      status={status}
      onIcon={onIcon}
      plate={plate}
      compactIcons={!wide}
    />
  );
  const keys = (
    <View className="flex-row justify-around px-4 pb-2 pt-3" role="toolbar" aria-label={companionCopy('monspace.title')}>
      <ClassicKey testID="m32-key-a" letter="A" label={companionCopy('monspace.key.next')} hint={companionCopy('monspace.key.next.hint')} onPress={() => press('next')} />
      <ClassicKey testID="m32-key-b" letter="B" primary label={companionCopy('monspace.key.select')} hint={companionCopy('monspace.key.select.hint')} onPress={() => press('select')} />
      <ClassicKey testID="m32-key-c" letter="C" label={companionCopy('monspace.key.back')} hint={companionCopy('monspace.key.back.hint')} onPress={() => press('cancel')} />
    </View>
  );

  return (
    <SafeArea edges={['top', 'bottom', 'left', 'right']} className={`flex-1 bg-bg ${scheme === 'night' ? 'scheme-dark' : 'scheme-light'}`}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <View testID="m32-back">
          <Button variant="ghost" size="md" title={companionCopy('monspace.back')} onPress={() => press('cancel')} className="min-h-target" />
        </View>
        <View className="flex-1">
          <Heading level={1} className="text-type-title text-text" numberOfLines={1}>{name}</Heading>
          <Text className="text-type-caption text-text-secondary">{companionCopy('monspace.title')}</Text>
        </View>
        <CallLamp testID="m32-lamp" state={lamp} reducedMotion={reducedMotion} accessibilityLabel={companionCopy(lampCopy(lamp), { name })} />
      </View>
      {wide ? (
        <View className="min-h-0 flex-1 flex-row gap-6 px-6 pb-4">
          <View className="min-h-0 flex-1" style={{ maxWidth: 720 }}>
            <View className="min-h-0 flex-1">{lcd}</View>
            {keys}
          </View>
          <StatusTwins view={view} name={name} scheme={scheme} />
        </View>
      ) : (
        <View className="min-h-0 flex-1 px-3">
          <View className="min-h-0 flex-1">{lcd}</View>
          {keys}
        </View>
      )}
      {ui.layer === 'pause-confirm' ? (
        <View className="absolute inset-x-0 bottom-0">
          <SheetSurface
            placement="in-screen"
            scheme={scheme === 'night' ? 'night' : 'system'}
            title={companionCopy('monspace.pause.confirm.title', { name })}
            onClose={() => press('cancel')}
            closeLabel={companionCopy('monspace.pause.confirm.cancel')}
            testID="m32-pause-confirm"
          >
            <View className="gap-target-gap">
              <Text className="text-type-body text-text">{companionCopy('monspace.pause.confirm.body')}</Text>
              <Button variant="outline" size="lg" fullWidth title={companionCopy('monspace.pause.confirm.cancel')} onPress={() => press('cancel')} className="min-h-target" />
              <Button size="lg" fullWidth title={companionCopy('monspace.pause.confirm.action')} onPress={() => press('select')} className="min-h-target" />
            </View>
          </SheetSurface>
        </View>
      ) : null}
      {askOpen && ui.layer === 'bar' ? (
        <View className="absolute inset-x-0 bottom-0">
          <SheetSurface
            placement="in-screen"
            scheme={scheme === 'night' ? 'night' : 'system'}
            title={companionCopy('monspace.notify.ask.title', { name })}
            onClose={() => answerAsk(false)}
            closeLabel={companionCopy('monspace.notify.ask.cancel')}
            testID="m32-notify-ask"
          >
            <View className="gap-target-gap">
              <Text className="text-type-body text-text">{companionCopy('monspace.notify.ask.body', { name })}</Text>
              <Button size="lg" fullWidth title={companionCopy('monspace.notify.ask.action')} onPress={() => answerAsk(true)} className="min-h-target" />
              <Button variant="outline" size="lg" fullWidth title={companionCopy('monspace.notify.ask.cancel')} onPress={() => answerAsk(false)} className="min-h-target" />
            </View>
          </SheetSurface>
        </View>
      ) : null}
    </SafeArea>
  );
}

/** Tablets and open foldables: the readable twins beside the LCD (Dynamic Type scales these; the LCD cannot). */
function StatusTwins({ view, name, scheme }: { view: MonCareView; name: string; scheme: 'daylit' | 'night' }) {
  const age = ageLine(view.ageDays);
  const rows: readonly [string, CompanionCopyId, number][] = [
    ['fullness', 'monspace.hearts.fullness', view.hearts.fullness],
    ['energy', 'monspace.hearts.energy', view.hearts.energy],
    ['social', 'monspace.hearts.social', view.hearts.social],
  ];
  return (
    <View className="w-80 gap-4 pt-2" testID="m32-twins">
      <Heading level={2} className="text-type-label text-text">{companionCopy('monspace.menu.status')}</Heading>
      {rows.map(([id, label, count]) => (
        <HeartRow
          key={id}
          filled={count}
          label={companionCopy(label)}
          accessibilityLabel={`${companionCopy(label)}, ${companionCopy('monspace.a11y.hearts', { count })}`}
          scheme={scheme}
          cell={4}
          labelClassName="text-type-body text-text"
        />
      ))}
      <KeyValueList
        columns={1}
        items={[
          { key: 'boundaries', label: companionCopy('monspace.status.boundaries'), value: companionCopy('monspace.status.boundaries.value', { level: view.discipline }) },
          { key: 'weight', label: companionCopy('monspace.status.weight'), value: companionCopy('monspace.status.weight.value', { weight: view.weight }) },
          { key: 'age', label: companionCopy('monspace.status.age'), value: companionCopy(age.copy, { name, ...age.tokens }) },
        ]}
      />
      <Text className="text-type-body text-text">{companionCopy('monspace.status.stage', { stage: view.stage })}</Text>
    </View>
  );
}
