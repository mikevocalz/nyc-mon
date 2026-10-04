import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavBar, type NavItem } from './nav/NavBar';
import { SiteFooter, type FooterLinkGroup } from './nav/SiteFooter';
import { SkylineBand } from './nav/SkylineBand';
import { Heading, Main, Paragraph, Section } from './html';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const districtControl = { control: 'inline-radio', options: DISTRICTS } as const;
const toneControl = { control: 'inline-radio', options: ['orange', 'royal', 'carolina', 'leaf', 'apple'] } as const;

const ITEMS: NavItem[] = [
  { label: 'Map', href: '#map', active: true },
  { label: 'Legends', href: '#legends' },
  {
    label: 'Districts',
    children: [
      { label: 'Downtown', href: '#downtown' },
      { label: 'Midtown', href: '#midtown' },
      { label: 'Harlem', href: '#harlem' },
      { label: 'Mega City', href: '#megacity' },
    ],
  },
  { label: 'Crew', href: '#crew' },
];

const GROUPS: FooterLinkGroup[] = [
  { title: 'Play', links: [{ label: 'Map', href: '#map' }, { label: 'Legends', href: '#legends' }, { label: 'Crew', href: '#crew' }] },
  { title: 'Districts', links: DISTRICTS.map((d) => ({ label: DISTRICT_NAME[d], href: `#${d}` })) },
  { title: 'Help', links: [{ label: 'Safety on the street', href: '#safety' }, { label: 'Contact', href: '#contact' }] },
];

const meta: Meta = {
  title: 'Nav',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
};
export default meta;

function Page() {
  return (
    <Main id="story-main" className="gap-3 px-4 py-10 md:px-6">
      <Heading level={1} className="my-0 font-display text-4xl text-white">Every block has a legend</Heading>
      <Paragraph className="my-0 max-w-xl text-base text-silver-300">
        The header holds the wordmark, the pages and the district skyline. Open Districts for the dropdown;
        on a phone the menu button opens the full list.
      </Paragraph>
    </Main>
  );
}

export const NavBarStory: StoryObj<typeof NavBar> = {
  name: 'Nav bar',
  args: { items: ITEMS, district: 'midtown', position: 'static', transparency: 'solid', navAlign: 'right', skyline: true, skipTo: 'story-main' },
  argTypes: {
    district: districtControl,
    color: toneControl,
    position: { control: 'inline-radio', options: ['sticky', 'fixed', 'floating', 'static'] },
    transparency: { control: 'inline-radio', options: ['solid', 'glass', 'transparent'] },
    navAlign: { control: 'inline-radio', options: ['left', 'center', 'right'] },
  },
  render: (args) => (
    <View className="min-h-screen bg-ink-900">
      <NavBar {...args} />
      <Page />
    </View>
  ),
};

/**
 * The site header shape: one primary action after the links (the last row of
 * the phone menu), a trailing slot that stays on phones, and a skip link that
 * appears on the first Tab.
 */
export const WithAction: StoryObj<typeof NavBar> = {
  name: 'With primary action',
  args: {
    items: ITEMS,
    district: 'midtown',
    position: 'static',
    cta: { label: 'Walk the district', href: '#walk' },
    skipTo: 'story-main',
  },
  argTypes: { district: districtControl, color: toneControl },
  render: (args) => (
    <View className="min-h-screen bg-ink-900">
      <NavBar {...args} />
      <Page />
    </View>
  ),
};

/** The same bar in each district: skyline and accent follow the neighbourhood. */
export const Districts: StoryObj = {
  render: () => (
    <View className="min-h-screen gap-8 bg-ink-900 py-6">
      {DISTRICTS.map((district) => (
        <NavBar key={district} items={ITEMS} district={district} position="static" />
      ))}
    </View>
  ),
};

export const Footer: StoryObj<typeof SiteFooter> = {
  args: {
    variant: 'columns',
    district: 'harlem',
    description: 'A field guide to the creatures that live on New York blocks, from the bodegas to the sky bridges.',
    linkGroups: GROUPS,
    navLinks: GROUPS[0]!.links,
    scene: 'river-tide',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['minimal', 'columns', 'centered', 'mega'] },
    scene: { control: 'inline-radio', options: ['river-tide', 'skyline', 'none'] },
    mark: { control: 'inline-radio', options: ['wordmark', 'badge'] },
    district: districtControl,
    color: toneControl,
  },
  render: (args) => (
    <View className="min-h-screen justify-end bg-ink-900">
      <SiteFooter {...args} />
    </View>
  ),
};

/** The badge in place of the wordmark, as the site footer uses it. No text label sits beside it. */
export const FooterBadge: StoryObj<typeof SiteFooter> = {
  name: 'Footer with badge',
  args: {
    variant: 'columns',
    mark: 'badge',
    district: 'harlem',
    description: 'A field guide to the creatures that live on New York blocks, from the bodegas to the sky bridges.',
    linkGroups: GROUPS,
  },
  argTypes: { district: districtControl, color: toneControl },
  render: (args) => (
    <View className="min-h-screen justify-end bg-ink-900">
      <SiteFooter {...args} />
    </View>
  ),
};

/** The three top bands: the Harlem river (default), the flat skyline, and none. */
export const FooterScenes: StoryObj = {
  name: 'Footer scenes',
  render: () => (
    <View className="gap-10 bg-ink-900">
      <SiteFooter variant="columns" mark="badge" linkGroups={GROUPS} scene="river-tide" />
      <SiteFooter variant="columns" mark="badge" linkGroups={GROUPS} scene="skyline" />
      <SiteFooter variant="columns" mark="badge" linkGroups={GROUPS} scene="none" />
    </View>
  ),
};

/** All four footer layouts, top to bottom. */
export const Footers: StoryObj = {
  render: () => (
    <View className="gap-10 bg-ink-900">
      <SiteFooter variant="minimal" navLinks={GROUPS[0]!.links} district="downtown" />
      <SiteFooter variant="centered" navLinks={GROUPS[0]!.links} district="harlem" description="A field guide to the creatures that live on New York blocks." />
      <SiteFooter variant="mega" linkGroups={GROUPS} district="megacity" description="A field guide to the creatures that live on New York blocks." />
    </View>
  ),
};

export const Skyline: StoryObj<typeof SkylineBand> = {
  args: { district: 'midtown', tone: 'royal', count: 36, windows: true },
  argTypes: { district: districtControl, tone: toneControl, count: { control: { type: 'range', min: 8, max: 80, step: 1 } } },
  render: (args) => (
    <View className="min-h-screen justify-center gap-6 bg-ink-950 p-4">
      {DISTRICTS.map((d) => (
        <Section key={d} className="gap-1">
          <Heading level={2} className="my-0 text-sm text-silver-400">{d}</Heading>
          <SkylineBand {...args} district={d} className="h-24" />
        </Section>
      ))}
    </View>
  ),
};
