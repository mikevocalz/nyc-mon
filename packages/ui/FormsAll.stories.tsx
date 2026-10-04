import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppForm, useFormStore } from './form';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { TextField } from './TextField';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Switch } from './Switch';
import { DISTRICT_NAME, DISTRICT_TONE, DISTRICTS, TONE_CLASSES, type District } from './district';
import { Form, Heading, Main, Paragraph, Section } from './html';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

const meta = {
  title: 'Forms/All',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const DISTRICT_OPTIONS = DISTRICTS.map((d) => ({ value: d, label: DISTRICT_NAME[d] }));

function DistrictRow({ district }: { district: District }) {
  const store = useInstanceStore(() => ({ on: true, follow: district !== 'midtown' }));
  const { on, follow } = useStore(store);
  return (
    <Section aria-label={DISTRICT_NAME[district]} className="gap-4">
      <Heading level={2} className="my-0 font-display text-xl text-ink-50">{DISTRICT_NAME[district]}</Heading>
      <View className="gap-4 md:flex-row md:items-start">
        <TextField containerClassName="md:flex-1" variant="neon" district={district} label="Crew name" placeholder="Block Kings" />
        <Select containerClassName="md:flex-1" variant="neon" district={district} label="Rival" value={district} options={DISTRICT_OPTIONS} />
      </View>
      <View className="gap-4 md:flex-row md:items-center">
        <View className="md:flex-1">
          <Checkbox variant="neon" district={district} checked={follow} onChange={(v) => store.setState({ follow: v })} label="Follow this district" />
        </View>
        <View className="md:flex-1">
          <Switch variant="neon" district={district} value={on} onChange={(v) => store.setState({ on: v })} label="Game alerts" />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-4">
        <Button variant="cornerCut" district={district} title="Claim block" onPress={() => {}} />
        <IconButton variant="cornerCut" district={district} aria-label="Add a block" icon={<Text className={`font-display ${TONE_CLASSES[DISTRICT_TONE[district]].onFace}`}>＋</Text>} />
      </View>
    </Section>
  );
}

type Signup = { crew: string; district: string; story: string; alerts: boolean; rules: boolean };

function SignupForm() {
  const result = useInstanceStore<{ submitted: Signup | null }>(() => ({ submitted: null }));
  const submitted = useStore(result, (s) => s.submitted);
  const form = useAppForm({
    defaultValues: { crew: '', district: '', story: '', alerts: true, rules: false } as Signup,
    onSubmit: async ({ value }) => {
      result.setState({ submitted: value });
    },
  });
  const district = useFormStore(form.store, (s) => s.values.district) as District | '';
  const tone = district ? DISTRICT_TONE[district] : 'orange';

  return (
    <Section aria-label="Join a crew" className="max-w-content-form gap-5">
      <Heading level={2} className="my-0 font-display text-2xl text-ink-50">Join a crew</Heading>
      <Paragraph className="my-0 text-silver-300">
        The form takes the colour of the district you pick. Submit with empty fields to see the errors.
      </Paragraph>
      <Form
        className="gap-5"
        aria-label="Join a crew"
        // Web: Enter in a field submits through TanStack Form instead of reloading the page.
        {...({ onSubmit: (e: { preventDefault: () => void }) => { e.preventDefault(); void form.handleSubmit(); } } as object)}
      >
        <form.AppField
          name="crew"
          validators={{
            onChange: ({ value }) =>
              !value.trim() ? 'Give your crew a name.' : value.trim().length < 3 ? 'Use at least 3 characters.' : undefined,
          }}
        >
          {(field) => <field.NeonTextField tone={tone} label="Crew name" placeholder="Lenox Legends" />}
        </form.AppField>
        <form.AppField name="district" validators={{ onChange: ({ value }) => (!value ? 'Choose a home district.' : undefined) }}>
          {(field) => (
            <field.NeonSelect
              tone={tone}
              label="Home district"
              options={[{ value: '', label: 'Choose one' }, ...DISTRICT_OPTIONS]}
            />
          )}
        </form.AppField>
        <form.AppField
          name="story"
          validators={{ onChange: ({ value }) => (value.length > 140 ? 'Keep it under 140 characters.' : undefined) }}
        >
          {(field) => <field.NeonTextarea tone={tone} label="Block story" placeholder="Where you play and who you play for" hint="Optional, up to 140 characters." />}
        </form.AppField>
        <form.AppField name="alerts">
          {(field) => <field.NeonSwitch tone={tone} label="Game-day alerts" />}
        </form.AppField>
        <form.AppField name="rules" validators={{ onChange: ({ value }) => (!value ? 'Accept the house rules to join.' : undefined) }}>
          {(field) => <field.NeonCheckbox tone={tone} label="I accept the house rules" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton variant="cornerCut" tone={tone} title="Join crew" />
        </form.AppForm>
      </Form>
      {submitted ? (
        <View role="status" aria-live="polite" className="gap-1 border-2 border-leaf-500 bg-ink-900 p-4">
          <Text className="font-display text-leaf-400">Joined {submitted.crew}</Text>
          <Text className="text-sm text-silver-300">
            {DISTRICT_NAME[submitted.district as District]}, alerts {submitted.alerts ? 'on' : 'off'}.
          </Text>
        </View>
      ) : null}
    </Section>
  );
}

/** Every NeonBlade input variant in every district, then a TanStack form that validates and submits. */
export const All: Story = {
  render: () => (
    <Main className="min-h-screen gap-12 bg-ink-950 px-4 py-8 md:px-10">
      <SignupForm />
      {DISTRICTS.map((d) => <DistrictRow key={d} district={d} />)}
    </Main>
  ),
};

/** Just the form, for testing validation and submit. */
export const SignupValidation: Story = {
  render: () => (
    <Main className="min-h-screen bg-ink-950 px-4 py-8 md:px-10">
      <SignupForm />
    </Main>
  ),
};
