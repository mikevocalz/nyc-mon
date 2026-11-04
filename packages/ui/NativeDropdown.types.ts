/** A single semantic choice contract, rendered by each platform's own native UI. */
export type NativeDropdownOption = Readonly<{
  value: string;
  label: string;
  supportingText?: string;
  disabled?: boolean;
}>;
export type NativeDropdownGroup = Readonly<{
  id: string;
  label?: string;
  options: readonly NativeDropdownOption[];
}>;
export interface NativeDropdownProps {
  /** Visible and spoken name of the value being edited, e.g. "Blend mode". */
  label: string;
  /** Value is controlled by the document or an explicitly scoped Zustand store. */
  value: string;
  groups: readonly NativeDropdownGroup[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Optional human-friendly description of this choice, not an arbitrary tooltip. */
  hint?: string;
  /** The host may arrange the trigger, but does not supply a separate popup. */
  testID?: string;
}
