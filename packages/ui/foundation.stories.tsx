import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  brand, palette, semantic, typeScale, contentWidths, radius, motion,
} from '@acme/theme';
import { BrandLogo } from './brand/BrandLogo';
import { View, Text, H2 } from './tw';

// PROMPT-2 foundation stories: Colors, Typography, Spacing, Content Widths.
// Light + dark rendered side by side (light-dark() resolves per color-scheme).

const meta = { title: 'Foundation' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View className="items-center gap-1">
      <View
        className="h-14 w-14 rounded-md border border-border"
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
  { key: 'orange', role: 'Hero accent, primary actions, grid lines' },
  { key: 'royal', role: 'Structure: outlines, rules, grid glow' },
  { key: 'carolina', role: 'Secondary, info, focus on dark' },
  { key: 'leaf', role: 'Success' },
  { key: 'apple', role: 'Danger (text uses apple-400 on dark)' },
  { key: 'night', role: 'Base background' },
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
                <View className="h-14 w-7 rounded-l-md" style={{ backgroundColor: light }} />
                <View className="h-14 w-7 rounded-r-md" style={{ backgroundColor: dark }} />
              </View>
              <Text className="text-xs text-text-muted">{name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ),
};

export const Typography: Story = {
  render: () => (
    <View className="gap-4 p-6 bg-surface">
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

export const Spacing: Story = {
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(radius).map(([name, value]) => (
        <View key={name} className="flex-row items-center gap-3">
          <View className="h-10 w-20 bg-primary" style={{ borderRadius: value as never }} />
          <Text className="text-sm text-text-muted">radius-{name}: {value}</Text>
        </View>
      ))}
      {Object.entries(motion.duration).map(([name, value]) => (
        <Text key={name} className="text-sm text-text-muted">duration-{name}: {value}</Text>
      ))}
    </View>
  ),
};

export const ContentWidths: Story = {
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(contentWidths).map(([name, width]) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{name}: {width}</Text>
          <View className="h-8 rounded-sm bg-accent" style={{ maxWidth: width as never, width: '100%' }} />
        </View>
      ))}
    </View>
  ),
};
