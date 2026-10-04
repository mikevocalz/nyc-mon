import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldGroup } from './FieldGroup';
import { TextField } from './TextField';
import { Switch } from './Switch';
import { Checkbox } from './Checkbox';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/FieldGroup',
  component: FieldGroup,
  args: { children: null },
} satisfies Meta<typeof FieldGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No props: night panels with a Midtown orange cap; a Downtown section beside it. */
export const SettingsForm: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <FieldGroup>
        <FieldGroup.Section title="Profile">
          <TextField label="Full name" defaultValue="Maya Rodriguez" />
          <TextField label="Email" defaultValue="maya@example.com" hint="Used for sign-in." />
        </FieldGroup.Section>
        <FieldGroup.Section title="Notifications" district="downtown">
          <Switch district="downtown" value onChange={() => {}} label="Rehearsal reminders" />
          <Switch district="downtown" value={false} onChange={() => {}} label="Weekly digest" />
          <FieldGroup.SectionFooter>
            Reminders arrive the evening before a rehearsal.
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </View>
  ),
};

/** District showcase, on a light page: the panels scope the dark theme, so labels stay legible. */
export const Districts: Story = {
  render: () => (
    <View className="scheme-light bg-ink-50 p-4">
      <View className="max-w-content-form">
        <FieldGroup>
          {DISTRICTS.map((d) => (
            <FieldGroup.Section key={d} title={DISTRICT_NAME[d]} district={d}>
              <Checkbox district={d} checked onChange={() => {}} label={`Follow ${DISTRICT_NAME[d]}`} />
              <Switch district={d} value={false} onChange={() => {}} label="Game-day alerts" />
            </FieldGroup.Section>
          ))}
        </FieldGroup>
      </View>
    </View>
  ),
};
