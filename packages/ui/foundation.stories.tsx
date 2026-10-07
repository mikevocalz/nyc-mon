import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  brand, palette, semantic, typeScale, typeRamp, contentWidths, radius, motion,
  motionTokens, space, layout, concrete, signage, hlynk, led, type MotionStep,
} from '@acme/theme';
import { BrandLogo } from './brand/BrandLogo';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME, DISTRICT_TONE, TONE_CLASSES } from './district';
import { Heading } from './Heading';
import { Text as KitText } from './Text';
import { View, Text, H2 } from './tw';

// PROMPT-2 foundation stories: Colors, Typography, Spacing, Content Widths.
// Light is daylit and the default (canon Decision #4); dark is night and the hatch.
// Light + dark rendered side by side (light-dark() resolves per color-scheme).

const meta = { title: 'Foundation' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View className="items-center gap-1">
      <View
        className="h-14 w-14 rounded-none border border-border"
        style={{ backgroundColor: value }}
      />
      <Text className="text-xs text-text-muted">{name}</Text>
    </View>
  );
}

// WCAG relative luminance, so the story shows live ratios from the tokens.
const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const BRAND_ROLES: { key: keyof typeof brand; role: string }[] = [
  { key: 'orange', role: 'CTA face and the hatch; never text on daylit' },
  { key: 'royal', role: 'Structure: outlines, rules, grid glow' },
  { key: 'carolina', role: 'Secondary, info, focus on dark' },
  { key: 'leaf', role: 'Success' },
  { key: 'apple', role: 'Danger (text uses apple-400 on dark)' },
  { key: 'night', role: 'Night and hatch background' },
  { key: 'white', role: 'Text on dark' },
  { key: 'silver', role: 'Muted text on dark, sparingly' },
];

/** The NYC Mon palette, sampled from the logo, with each colour's ratio on night and on white. */
export const BrandPalette: Story = {
  render: () => (
    <View className="gap-6 bg-bg p-6">
      <View className="flex-row items-center gap-4">
        <BrandLogo size={120} />
        <View className="gap-1">
          <H2 className="font-display text-2xl text-primary">NYC-MON palette</H2>
          <Text className="text-sm text-text-muted">Every colour below was sampled from the logo. Ratios update from the tokens.</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-4">
        {BRAND_ROLES.map(({ key, role }) => {
          const hex = brand[key];
          const onNight = contrast(hex, brand.night);
          const onWhite = contrast(hex, palette.white);
          return (
            <View key={key} className="w-56 gap-2 border border-border bg-surface-raised p-3">
              <View className="h-16 border border-border" style={{ backgroundColor: hex }} />
              <Text className="text-base font-semibold text-text">{key} {hex}</Text>
              <Text className="text-sm text-text-muted">{role}</Text>
              <Text className="text-xs text-text-muted">
                {`On night ${onNight.toFixed(2)}:1${onNight >= 4.5 ? ' AA' : ''}. On white ${onWhite.toFixed(2)}:1${onWhite >= 4.5 ? ' AA' : ''}.`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  ),
};

// Starter scale names kept as aliases of the NYC Mon families; not shown twice.
const LEGACY_ALIASES = new Set(['burgundy', 'ember', 'gold', 'forest', 'sky', 'rose', 'slate']);

export const Colors: Story = {
  render: () => (
    <View className="gap-6 p-6 bg-surface">
      {Object.entries(palette).map(([family, scale]) =>
        typeof scale === 'string' || LEGACY_ALIASES.has(family) ? null : (
          <View key={family} className="gap-2">
            <H2 className="text-lg font-semibold text-text">{family}</H2>
            <View className="flex-row flex-wrap gap-3">
              {Object.entries(scale).map(([step, hex]) => (
                <Swatch key={step} name={step} value={hex} />
              ))}
            </View>
          </View>
        ),
      )}
      <View className="gap-2">
        <H2 className="text-lg font-semibold text-text">Semantic, light then dark</H2>
        <View className="flex-row flex-wrap gap-3">
          {Object.entries(semantic).map(([name, { light, dark }]) => (
            <View key={name} className="items-center gap-1">
              <View className="flex-row">
                <View className="h-14 w-7 rounded-none" style={{ backgroundColor: light }} />
                <View className="h-14 w-7 rounded-none" style={{ backgroundColor: dark }} />
              </View>
              <Text className="text-xs text-text-muted">{name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ),
};

/**
 * The daylit page against night: the same semantic roles in each scheme, with
 * the call to action (`cta` face, `on-cta` label) and live ratios. The right
 * panel is `scheme-dark`, the class NightScope relies on.
 */
export const DaylitAndNight: Story = {
  render: () => {
    const Panel = ({ mode }: { mode: 'light' | 'dark' }) => {
      const v = (k: keyof typeof semantic) => semantic[k][mode];
      return (
        <View className={`flex-1 gap-3 bg-bg p-4 ${mode === 'dark' ? 'scheme-dark' : 'scheme-light'}`}>
          <Text className="font-display text-lg text-text">{mode === 'light' ? 'Daylit' : 'Night'}</Text>
          <Text className="text-base text-text">{`Text ${contrast(v('text'), v('bg')).toFixed(2)}:1 on the page.`}</Text>
          <Text className="text-sm text-text-muted">{`Muted ${contrast(v('text-muted'), v('bg')).toFixed(2)}:1.`}</Text>
          <Text className="text-sm text-accent">{`Link ${contrast(v('accent'), v('bg')).toFixed(2)}:1.`}</Text>
          <View className="flex-row gap-2">
            <View className="bg-surface-raised border border-border p-2">
              <Text className="text-sm text-text">Raised</Text>
            </View>
            <View className="bg-surface-sunken p-2">
              <Text className="text-sm text-text">Sunken</Text>
            </View>
          </View>
          <View className="self-start bg-cta px-4 py-3">
            <Text className="text-base font-semibold text-on-cta">
              {`Call your Mon (${contrast(v('on-cta'), v('cta')).toFixed(2)}:1)`}
            </Text>
          </View>
          <Text className="text-sm text-danger">Danger</Text>
          <Text className="text-sm text-success">Success</Text>
          <Text className="text-sm text-info">Info</Text>
        </View>
      );
    };
    return (
      <View className="gap-0 md:flex-row">
        <Panel mode="light" />
        <Panel mode="dark" />
      </View>
    );
  },
};

/** City neutrals and MTA signage ink, each with its ratio for signage-black type. */
export const ConcreteAndSignage: Story = {
  render: () => (
    <View className="gap-4 bg-surface p-6">
      <View className="flex-row flex-wrap gap-3">
        {Object.entries(concrete).map(([step, hex]) => (
          <View key={step} className="w-24 gap-1">
            <View className="h-14 border border-border" style={{ backgroundColor: hex }} />
            <Text className="text-xs text-text">{`concrete-${step}`}</Text>
            <Text className="text-xs text-text-muted">{`black ${contrast(signage.black, hex).toFixed(2)}:1`}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-3">
        {Object.entries(signage).map(([name, hex]) => (
          <Swatch key={name} name={`signage-${name}`} value={hex} />
        ))}
      </View>
    </View>
  ),
};

/** H-Lynk Core chrome tokens (Decision #16). Scheme-invariant: the body is plastic. */
export const HLynkCore: Story = {
  name: 'H-Lynk Core',
  render: () => {
    const core = hlynk.core;
    return (
      <View className="gap-4 bg-surface p-6">
        <View className="self-start gap-3 bg-hlynk-core-body p-4">
          <View className="flex-row items-center gap-3 bg-hlynk-core-black px-3 py-2">
            <View className="h-3 w-3 rounded-full bg-led-on" />
            <View className="h-3 w-3 rounded-full bg-led-off" />
          </View>
          <Text className="text-sm font-semibold text-hlynk-core-ink">H-Lynk Core</Text>
          <View className="flex-row gap-2">
            <View className="h-12 w-12 items-center justify-center bg-hlynk-core-black">
              <Text className="text-base text-hlynk-core-glyph">‹</Text>
            </View>
            <View className="h-12 w-12 items-center justify-center border-2 border-hlynk-core-ring bg-hlynk-core-black" />
            <View className="h-12 w-12 items-center justify-center border-2 border-hlynk-core-hatch-rim bg-hlynk-core-black" />
            <View className="h-12 w-12 items-center justify-center bg-hlynk-core-black">
              <Text className="text-base text-hlynk-core-glyph-disabled">›</Text>
            </View>
          </View>
        </View>
        <View className="gap-1">
          {Object.entries(core).map(([key, hex]) => (
            <Text key={key} className="text-xs text-text-muted">{`hlynk.core.${key} ${hex}`}</Text>
          ))}
          {Object.entries(led).map(([key, hex]) => (
            <Text key={key} className="text-xs text-text-muted">{`led.${key} ${hex}`}</Text>
          ))}
          <Text className="text-xs text-text-muted">
            {`Black control on body ${contrast(core.black, core.body).toFixed(2)}:1. White ink on body ${contrast(core.ink, core.body).toFixed(2)}:1. LED in head ${contrast(led.on, core.black).toFixed(2)}:1.`}
          </Text>
        </View>
      </View>
    );
  },
};

// Literal class names, so Tailwind's scanner emits each utility.
const TYPE_RAMP_CLASS: Record<keyof typeof typeRamp, string> = {
  'type-station': 'text-type-station',
  'type-title': 'text-type-title',
  'type-body': 'text-type-body',
  'type-body-strong': 'text-type-body-strong',
  'type-label': 'text-type-label',
  'type-tag': 'text-type-tag',
  'type-caption': 'text-type-caption',
};

export const Typography: Story = {
  render: () => (
    <View className="gap-4 p-6 bg-surface">
      <View className="gap-2 border-2 border-ink-800 bg-ink-950 p-4">
        <Text className="text-xs text-silver-300">Kit defaults: Heading with no props, then the Text scale</Text>
        <Heading className="text-ink-50">Every block has a legend</Heading>
        <KitText variant="title" className="text-ink-50">Title, display face</KitText>
        <KitText variant="heading" className="text-ink-50">Heading, display face</KitText>
        <KitText className="text-ink-50">Body stays in Space Grotesk, because running text in a poster face is hard to read.</KitText>
        <KitText variant="caption" className="text-silver-300">Caption</KitText>
        <KitText variant="label" tone="district" district="midtown">Label, Midtown tone</KitText>
      </View>
      {Object.entries(typeRamp).map(([name, t]) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{`${name}, ${t.sizePt}/${t.lineHeightPt} pt, ${t.family} ${t.weight}`}</Text>
          <Text className={`${t.family === 'display' ? 'font-display' : 'font-sans'} ${TYPE_RAMP_CLASS[name as keyof typeof typeRamp]} text-text`}>What year were you born?</Text>
        </View>
      ))}
      {Object.keys(typeScale).map((name) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{name}, font-display</Text>
          <Text className={`font-display text-${name} text-text`}>The quick brown fox</Text>
        </View>
      ))}
      <View className="gap-1">
        <Text className="text-xs text-text-muted">body, font-sans</Text>
        <Text className="font-sans text-base text-text">
          Body copy sample — readable, unhurried, and comfortable at length,
          educate and entertain.
        </Text>
      </View>
    </View>
  ),
};

const describeStep = (s: MotionStep): string => {
  switch (s.kind) {
    case 'tween': {
      const parts = [
        `${s.durationMs} ms ${s.easing}`,
        s.fade ? 'fade' : undefined,
        s.color ? 'colour' : undefined,
        s.scale !== undefined ? `scale ${s.scale}` : undefined,
        s.risePt !== undefined ? `rise ${s.risePt} pt` : undefined,
        s.slidePt !== undefined ? `slide ${s.slidePt} pt` : undefined,
      ];
      return parts.filter(Boolean).join(', ');
    }
    case 'breathe':
      return `${s.periodMs / 1000} s breath, ${s.minOpacity * 100}% to ${s.maxOpacity * 100}%`;
    case 'blink':
      return `${s.count} blinks (${s.onMs}/${s.offMs} ms) every ${s.intervalMs / 1000} s`;
    case 'steady':
      return `steady, ${s.cue} cue`;
    case 'instant':
      return 'instant';
    case 'absent':
      return 'absent';
  }
};

/** Spacing steps, layout constants, and every motion token beside its reduced-motion sibling. */
export const Spacing: Story = {
  name: 'Spacing and motion',
  render: () => (
    <View className="gap-6 p-6 bg-surface">
      <View className="gap-2">
        {Object.entries(space).map(([step, pt]) => (
          <View key={step} className="flex-row items-center gap-3">
            <View className="h-4 bg-accent" style={{ width: pt }} />
            <Text className="text-sm text-text-muted">{`${step}: ${pt} pt`}</Text>
          </View>
        ))}
        <Text className="text-sm text-text-muted">
          {`Gutter ${layout.gutterPt} pt (${layout.gutterMdPt} from md). Targets ${layout.minTargetIosPt} pt iOS, ${layout.minTargetAndroidDp} dp Android.`}
        </Text>
      </View>
      <View className="gap-2">
        {Object.entries(motion.duration).map(([name, value]) => (
          <Text key={name} className="text-sm text-text-muted">duration-{name}: {value}</Text>
        ))}
      </View>
      <View className="gap-3">
        {Object.entries(motionTokens).map(([name, t]) => (
          <View key={name} className="gap-1 border-l-2 border-border pl-3">
            <Text className="text-sm font-semibold text-text">{name}</Text>
            <Text className="text-sm text-text-muted">{`Full: ${describeStep(t.full)}`}</Text>
            <Text className="text-sm text-text-muted">{`Reduced: ${describeStep(t.reduced)}`}</Text>
          </View>
        ))}
      </View>
    </View>
  ),
};

export const ContentWidths: Story = {
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(contentWidths).map(([name, width]) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{name}: {width}</Text>
          <View className="h-8 rounded-none bg-accent" style={{ maxWidth: width as never, width: '100%' }} />
        </View>
      ))}
    </View>
  ),
};

// '<prefix>-<family>-<step>' class from the tone table, read back to its palette hex.
const classHex = (cls: string) => {
  const m = /-(\w+)-(\d+)$/.exec(cls.split(' ')[0] ?? '');
  const fam = m ? (palette as unknown as Record<string, Record<string, string>>)[m[1]!] : undefined;
  if (m && fam?.[m[2]!]) return fam[m[2]!]!;
  return cls.endsWith('white') ? '#FFFFFF' : brand.night;
};

/**
 * Every control tone as the components use it: the solid face with its ink,
 * and the tone's text step on night, each with its live contrast ratio.
 */
export const ToneTable: Story = {
  render: () => (
    <View className="gap-3 bg-ink-950 p-6 md:flex-row md:flex-wrap">
      {CONTROL_TONES.map((t) => {
        const c = TONE_CLASSES[t];
        const face = classHex(c.face);
        const on = classHex(c.onFace);
        const txt = classHex(c.text);
        const district = DISTRICTS.find((d) => DISTRICT_TONE[d] === t);
        return (
          <View key={t} className="w-full gap-2 border-2 border-ink-800 bg-ink-900 p-3 md:w-56">
            <View className="relative">
              <View aria-hidden className={`absolute inset-0 translate-x-[4px] translate-y-[4px] ${c.plate}`} />
              <View className={`px-3 py-2 ${c.face}`}>
                <Text className={`font-display text-base ${c.onFace}`}>{t}</Text>
              </View>
            </View>
            <Text className={`pt-1 font-display text-sm ${c.text}`}>{district ? DISTRICT_NAME[district] : 'Tone text'}</Text>
            <Text className="text-xs text-silver-300">
              {`Ink on face ${contrast(on, face).toFixed(2)}:1. Text on night ${contrast(txt, brand.night).toFixed(2)}:1.`}
            </Text>
          </View>
        );
      })}
    </View>
  ),
};

/** The radius tokens. Every step is 0 (square); `soft` is the opt-in rounding behind each component's `rounded` prop. */
export const RoundedTokens: Story = {
  name: 'Radius (opt-in rounded)',
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(radius).map(([name, value]) => (
        <View key={name} className="flex-row items-center gap-3">
          <View className="h-10 w-20 bg-primary" style={{ borderRadius: value as never }} />
          <Text className="text-sm text-text-muted">radius-{name}: {value}</Text>
        </View>
      ))}
    </View>
  ),
};
