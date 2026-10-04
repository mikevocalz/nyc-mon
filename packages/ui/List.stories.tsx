import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, ListItem } from './List';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/List',
  component: List,
  args: { children: null },
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No props: the night slab, Midtown accent. Hover a row for the accent bar; Daniel is `selected`. */
export const Roster: Story = {
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: (args) => (
    <View className="max-w-content-form p-4">
      <List district={args.district}>
        <ListItem
          leading={<Avatar name="Maya Rodriguez" size="sm" />}
          trailing={<Badge label="Owner" tone="primary" />}
          supportingText="Soprano · joined 2019"
          onPress={() => {}}
        >
          Maya Rodriguez
        </ListItem>
        <ListItem
          leading={<Avatar name="Daniel Okafor" size="sm" />}
          trailing={<Badge label="Admin" tone="accent" />}
          supportingText="Tenor · joined 2021"
          selected
          onPress={() => {}}
        >
          Daniel Okafor
        </ListItem>
        <ListItem
          leading={<Avatar name="Priya Raman" size="sm" />}
          trailing={<Badge label="Invited" tone="neutral" />}
          supportingText="Alto"
        >
          Priya Raman
        </ListItem>
      </List>
    </View>
  ),
};

export const PlainRows: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <List>
        <ListItem supportingText="9:00 AM · Main hall">Tuesday standup</ListItem>
        <ListItem supportingText="6:30 PM · Rehearsal room">Sectional practice</ListItem>
        <ListItem supportingText="Saturday · 4:00 PM">Dress rehearsal</ListItem>
      </List>
    </View>
  ),
};

/** A selected row in each district. */
export const Districts: Story = {
  render: () => (
    <View className="gap-6 p-4 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <View key={d} className="md:w-80">
          <List district={d}>
            <ListItem supportingText="Selected" selected onPress={() => {}}>{DISTRICT_NAME[d]}</ListItem>
            <ListItem supportingText="Hover me" onPress={() => {}}>Next stop</ListItem>
          </List>
        </View>
      ))}
    </View>
  ),
};

/** G14: nav items are links; the current section carries aria-current="page". */
export const Navigation: Story = {
  render: () => (
    <View className="w-64 p-4">
      <List>
        <ListItem href="/admin/overview">Overview</ListItem>
        <ListItem href="/admin/callers" current>Callers</ListItem>
        <ListItem href="/admin/consent">Consent queue</ListItem>
        <ListItem href="/admin/audit">Audit log</ListItem>
      </List>
    </View>
  ),
};
