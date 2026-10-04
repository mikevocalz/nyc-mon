import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Crosshair } from './cursors/Crosshair';
import { MouseCursor } from './cursors/MouseCursor';
import { PointerCursor } from './cursors/PointerCursor';
import { CursorArrow, MouseFace, ReticleShape } from './cursors/shapes';
import type { CursorGlow, MouseCursorProps } from './cursors/types';
import { Button } from './Button';
import type { ControlTone } from './cards/tones';
import { Heading, Link, Paragraph, Section, Text } from './html';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

const meta: Meta = {
  title: 'Cursors',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    docs: { description: { component: 'NeonBlade fox-cursor (Fox Cursor) is the mouse face cursor; NeonBlade crosshair (Crosshair) is the reticle; the arrow pointer is a separate cursor.' } },
  },
};
export default meta;

const glowControl = { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] } as const;
const colorControl = { control: 'inline-radio', options: ['orange', 'royal', 'carolina', 'leaf', 'apple', 'white'] } as const;

function Arena({ title, note, children }: { title: string; note: string; children: (ref: React.RefObject<HTMLElement | null>) => React.ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  return (
    <Section className="gap-2 md:flex-1">
      <Heading level={2} className="my-0 font-display text-xl text-white">{title}</Heading>
      <Paragraph className="my-0 text-sm text-silver-400">{note}</Paragraph>
      <View
        ref={ref as never}
        className="relative h-72 items-center justify-center gap-4 overflow-hidden border-2 border-ink-700 bg-ink-900"
      >
        <View className="items-center">
          <Button title="Catch it" />
        </View>
        <Link href="#map" className="text-sm font-semibold text-carolina-400">Open the map</Link>
        {children(ref)}
      </View>
    </Section>
  );
}

/**
 * Both cursors, each contained to its own area so the page keeps its OS
 * cursor. Move over the button and the link to see the hover state; press
 * to see it dip. Touch screens show no custom cursor.
 */
export const All: StoryObj = {
  render: () => (
    <View className="min-h-screen gap-8 bg-ink-950 p-4 md:p-8">
      <View className="gap-6 md:flex-row">
        <Arena title="Mouse" note="NeonBlade's fox cursor with a mouse face, centred on the pointer.">
          {(ref) => <MouseCursor containerRef={ref} />}
        </Arena>
        <Arena title="Pointer" note="The NYC-MON arrow, orange on a royal outline.">
          {(ref) => <PointerCursor containerRef={ref} />}
        </Arena>
        <Arena title="Reticle" note="NeonBlade's crosshair as a rounded-square reticle. It turns carolina over things you can press.">
          {(ref) => <Crosshair containerRef={ref} />}
        </Arena>
      </View>
      <Section className="gap-3">
        <Heading level={2} className="my-0 font-display text-xl text-white">The drawings</Heading>
        <Paragraph className="my-0 text-sm text-silver-400">The same marks as plain drawings, which also render on native (for example at the end of an XR controller ray).</Paragraph>
        <View className="flex-row flex-wrap items-center gap-8">
          <MouseFace size={64} />
          <MouseFace size={64} color="carolina" />
          <CursorArrow size={48} />
          <CursorArrow size={48} color="white" outlineColor="orange" />
          <CursorArrow size={48} color="carolina" />
          <ReticleShape size={64} animated={false} />
          <ReticleShape size={64} color="carolina" accentColor="orange" animated={false} />
          <ReticleShape size={64} color="leaf" animated={false} />
        </View>
      </Section>
    </View>
  ),
};

const MOUSE_COLORS: ControlTone[] = ['orange', 'carolina', 'apple', 'leaf'];

function Variant({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="min-w-36 flex-1 items-center gap-3 border-2 border-ink-700 bg-ink-900 px-4 py-6">
      <View className="h-24 items-center justify-center">{children}</View>
      <Text className="text-sm text-silver-400">{label}</Text>
    </View>
  );
}

function VariantRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section className="gap-3">
      <Heading level={3} className="my-0 font-display text-lg text-white">{title}</Heading>
      <View className="flex-row flex-wrap gap-4">{children}</View>
    </Section>
  );
}

/** NeonBlade's Fox Cursor demo page, with the mouse face. */
function MouseDemo(args: MouseCursorProps) {
  const ref = useRef<HTMLElement | null>(null);
  const store = useInstanceStore<{ picked: ControlTone | null }>(() => ({ picked: null }));
  const picked = useStore(store, (st) => st.picked);
  const color = picked ?? args.color ?? 'orange';
  const glows: CursorGlow[] = ['none', 'low', 'medium', 'high'];
  return (
    <View className="min-h-screen gap-8 bg-ink-950 p-4 md:p-8">
      <Section className="gap-2">
        <Heading level={2} className="my-0 font-display text-xl text-white">Move the mouse inside the box</Heading>
        <View
          ref={ref as never}
          className="relative h-72 items-center justify-center gap-4 overflow-hidden border-2 border-ink-700 bg-ink-900"
        >
          <Text className="font-display text-lg tracking-wide text-silver-300">Move cursor here</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {MOUSE_COLORS.map((c) => (
              <Button
                key={c}
                title={c[0]!.toUpperCase() + c.slice(1)}
                size="sm"
                variant={c === color ? 'cornerCut' : 'ghost'}
                tone={c}
                onPress={() => store.setState({ picked: c })}
              />
            ))}
          </View>
          <MouseCursor {...args} color={color} containerRef={ref} />
        </View>
      </Section>
      <VariantRow title="Colours">
        {MOUSE_COLORS.map((c) => (
          <Variant key={c} label={c[0]!.toUpperCase() + c.slice(1)}><MouseFace color={c} /></Variant>
        ))}
      </VariantRow>
      <VariantRow title="Sizes">
        <Variant label="Small, 36 px"><MouseFace color={color} size={36} /></Variant>
        <Variant label="Default, 64 px"><MouseFace color={color} size={64} /></Variant>
        <Variant label="Large, 96 px"><MouseFace color={color} size={96} /></Variant>
      </VariantRow>
      <VariantRow title="Glow">
        {glows.map((g) => (
          <Variant key={g} label={g[0]!.toUpperCase() + g.slice(1)}><MouseFace color={color} glowIntensity={g} /></Variant>
        ))}
      </VariantRow>
      <VariantRow title="Fill">
        <Variant label="No fill"><MouseFace color={color} fillOpacity={0} /></Variant>
        <Variant label="Subtle fill"><MouseFace color={color} fillOpacity={0.4} /></Variant>
        <Variant label="Full fill"><MouseFace color={color} fillOpacity={1} /></Variant>
      </VariantRow>
    </View>
  );
}

/** NeonBlade: Fox Cursor. A geometric mouse face centred on the pointer. */
export const Mouse: StoryObj<typeof MouseCursor> = {
  name: 'Mouse cursor (NeonBlade: Fox Cursor)',
  args: { color: 'orange', size: 64, strokeWidth: 2, glowIntensity: 'medium', fillOpacity: 0, hideNativeCursor: true, disabled: false },
  argTypes: {
    color: colorControl,
    glowColor: colorControl,
    glowIntensity: glowControl,
    size: { control: { type: 'range', min: 24, max: 128, step: 4 } },
    strokeWidth: { control: { type: 'range', min: 0.5, max: 6, step: 0.5 } },
    fillOpacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
  render: (args) => <MouseDemo {...args} />,
};

export const Pointer: StoryObj<typeof PointerCursor> = {
  name: 'Arrow pointer',
  args: { color: 'orange', outlineColor: 'royal', glowColor: 'royal', glowIntensity: 'low', size: 28, hideNativeCursor: true, disabled: false },
  argTypes: { color: colorControl, outlineColor: colorControl, glowColor: colorControl, glowIntensity: glowControl, size: { control: { type: 'range', min: 16, max: 64, step: 2 } } },
  render: (args) => (
    <Arena title="Pointer" note="Every prop is a control.">
      {(ref) => <PointerCursor {...args} containerRef={ref} />}
    </Arena>
  ),
};

export const Reticle: StoryObj<typeof Crosshair> = {
  name: 'Reticle (NeonBlade: Crosshair)',
  args: { color: 'orange', hotColor: 'carolina', outlineColor: 'royal', accentColor: 'carolina', glowIntensity: 'low', size: 44, animated: true, outerSpeed: 8, innerSpeed: 5, disabled: false },
  argTypes: {
    color: colorControl, hotColor: colorControl, outlineColor: colorControl, accentColor: colorControl, glowIntensity: glowControl,
    size: { control: { type: 'range', min: 24, max: 96, step: 2 } },
    outerSpeed: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
    innerSpeed: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
  },
  render: (args) => (
    <Arena title="Reticle" note="Every prop is a control.">
      {(ref) => <Crosshair {...args} containerRef={ref} />}
    </Arena>
  ),
};

/** The cursor drawings on their own: the mouse face, the arrow and the reticle. */
export const Drawings: StoryObj = {
  name: 'Drawings',
  render: () => (
    <View className="min-h-screen flex-row flex-wrap items-center gap-10 bg-ink-950 p-8">
      <MouseFace size={150} />
      <MouseFace size={150} color="carolina" glowIntensity="high" fillOpacity={0.4} />
      <CursorArrow size={96} />
      <ReticleShape size={110} />
    </View>
  ),
};
