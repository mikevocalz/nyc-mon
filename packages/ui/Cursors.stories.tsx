import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Crosshair } from './cursors/Crosshair';
import { CityMouse } from './cursors/mouse';
import { MouseCursor } from './cursors/MouseCursor';
import { PointerCursor } from './cursors/PointerCursor';
import { CursorArrow, ReticleShape } from './cursors/shapes';
import { Button } from './Button';
import { Heading, Link, Paragraph, Section } from './html';
import { View } from './tw';

const meta: Meta = {
  title: 'Cursors',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    docs: { description: { component: 'NeonBlade fox-cursor (Fox Cursor) is the city mouse; NeonBlade crosshair (Crosshair) is the reticle; the arrow pointer is a separate cursor.' } },
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
        <Arena title="City mouse" note="NeonBlade's fox cursor as a city mouse: it chases the pointer, then sits and nibbles its pizza.">
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
          <CityMouse size={64} pose="idle" />
          <CityMouse size={64} pose="run" facingLeft />
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

/** NeonBlade: Fox Cursor. The city mouse chases the pointer around the arena. */
export const Mouse: StoryObj<typeof MouseCursor> = {
  name: 'City mouse (NeonBlade: Fox Cursor)',
  args: { size: 48, follow: 'chase', speed: 8, idleAfter: 900, pizza: true, glowColor: 'royal', glowIntensity: 'low', hideNativeCursor: false, disabled: false },
  argTypes: {
    follow: { control: 'inline-radio', options: ['chase', 'snap'] },
    glowColor: colorControl,
    glowIntensity: glowControl,
    size: { control: { type: 'range', min: 24, max: 120, step: 4 } },
    speed: { control: { type: 'range', min: 2, max: 30, step: 1 } },
    idleAfter: { control: { type: 'range', min: 200, max: 4000, step: 100 } },
  },
  render: (args) => (
    <View className="min-h-screen gap-6 bg-ink-950 p-4 md:p-8">
      <Arena title="City mouse" note="Move inside the box. It runs after the pointer, faces the way it runs, and sits down to eat when you stop. Reduced motion pins it to the pointer and holds it still.">
        {(ref) => <MouseCursor {...args} containerRef={ref} />}
      </Arena>
      <View className="flex-row flex-wrap items-end gap-10">
        <CityMouse size={96} pose="idle" />
        <CityMouse size={96} pose="run" />
        <CityMouse size={96} pose="run" facingLeft />
        <CityMouse size={96} pose="idle" pizza={false} still />
      </View>
    </View>
  ),
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

/** The cursor drawings on their own: the city mouse running and sitting, and the reticle. */
export const Drawings: StoryObj = {
  name: 'Drawings',
  render: () => (
    <View className="min-h-screen flex-row flex-wrap items-center gap-10 bg-ink-950 p-8">
      <CityMouse size={150} pose="idle" />
      <CityMouse size={150} pose="run" facingLeft />
      <ReticleShape size={110} />
    </View>
  ),
};
