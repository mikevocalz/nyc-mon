import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { View } from './tw';
import { YearGrid, type YearGridStep } from './YearGrid';

const useYearGridStory = create<{
  value: number | null;
  step: YearGridStep;
  setValue: (value: number) => void;
  setStep: (step: YearGridStep) => void;
}>((set) => ({
  value: null,
  step: 'decade',
  setValue: (value) => set({ value }),
  setStep: (step) => set({ step }),
}));

const meta = {
  title: 'UI/YearGrid',
  component: YearGrid,
  args: {
    value: null,
    minYear: 1900,
    maxYear: 2026,
    step: 'decade',
    groupLabel: 'Decades',
    onChange: () => {},
  },
  decorators: [(Story) => <View className="max-w-content-form bg-bg p-4"><Story /></View>],
} satisfies Meta<typeof YearGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first controlled step offers every decade in the allowed range. */
export const DecadeStep: Story = {};

/** A controlled year step, showing the decade identified by `value`. */
export const YearStep: Story = {
  args: { value: 2000, step: 'year' },
};

/** The selected year exposes its checked and selected state. */
export const Selected: Story = {
  args: { value: 2004, step: 'year' },
};

/** The complete controlled flow starts without selecting a default year. */
export const NoDefault: Story = {
  render: function Render() {
    const { value, step, setValue, setStep } = useYearGridStory();
    return (
      <YearGrid
        value={value}
        onChange={setValue}
        minYear={1900}
        maxYear={2026}
        step={step}
        onStepChange={setStep}
        groupLabel={step === 'decade' ? 'Decades' : `Years in the ${Math.floor((value ?? 2000) / 10) * 10}s`}
      />
    );
  },
};

/** Tiles remain usable when the browser or device increases text size. */
export const LargeText: Story = {
  args: { value: 1994, step: 'year' },
  parameters: { docs: { description: { story: 'Verify at 200% browser zoom or the platform large-text setting.' } } },
};
