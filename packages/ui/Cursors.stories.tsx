import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Crosshair } from './cursors/Crosshair';
import { PointerCursor } from './cursors/PointerCursor';
import { CursorArrow, ReticleShape } from './cursors/shapes';
import { Button } from './Button';
import { Heading, Link, Paragraph, Section } from './html';
import { View } from './tw';

const meta: Meta = {
  title: 'Cursors',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
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
        <Arena title="Pointer" note="Replaces NeonBlade's fox: the NYC-MON arrow, orange on a royal outline.">
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

export const Pointer: StoryObj<typeof PointerCursor> = {
  args: { color: 'orange', outlineColor: 'royal', glowColor: 'royal', glowIntensity: 'low', size: 28, hideNativeCursor: true, disabled: false },
  argTypes: { color: colorControl, outlineColor: colorControl, glowColor: colorControl, glowIntensity: glowControl, size: { control: { type: 'range', min: 16, max: 64, step: 2 } } },
  render: (args) => (
    <Arena title="Pointer" note="Every prop is a control.">
      {(ref) => <PointerCursor {...args} containerRef={ref} />}
    </Arena>
  ),
};

export const Reticle: StoryObj<typeof Crosshair> = {
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
