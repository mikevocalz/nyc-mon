'use client';
/**
 * TanStack Form bound to the kit's inputs. Form state lives in TanStack
 * Form's own store (not React state — repo rule).
 *
 * Usage:
 *   const form = useAppForm({ defaultValues: { name: '' }, onSubmit: ... });
 *   <form.AppField name="name" validators={{ onChange: ({ value }) => !value ? 'Required' : undefined }}>
 *     {(field) => <field.TextField label="Name" placeholder="Ada" />}
 *   </form.AppField>
 *   <form.AppForm><form.SubmitButton title="Save" /></form.AppForm>
 */
import {
  createFormHook,
  createFormHookContexts,
  useStore,
} from '@tanstack/react-form';
import { TextField, type TextFieldProps } from './TextField';
import { Textarea, type TextareaProps } from './Textarea';
import { Checkbox, type CheckboxProps } from './Checkbox';
import { Switch, type SwitchProps } from './Switch';
import { Select, type SelectProps } from './Select';
import { NeonCheckbox as NeonCheckboxControl, type NeonCheckboxProps } from './cards/NeonCheckbox';
import { Button, type ButtonProps } from './Button';

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

const errorText = (errors: unknown[]): string | undefined => {
  const first = errors[0];
  if (first == null) return undefined;
  if (typeof first === 'string') return first;
  if (typeof first === 'object' && 'message' in first) return String((first as { message: unknown }).message);
  return String(first);
};

function FormTextField(props: Omit<TextFieldProps, 'value' | 'onChangeText' | 'error'>) {
  const field = useFieldContext<string>();
  const errors = useStore(field.store, (s) => s.meta.errors);
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  return (
    <TextField
      value={field.state.value}
      onChangeText={field.handleChange}
      onBlur={field.handleBlur}
      error={isTouched ? errorText(errors) : undefined}
      {...props}
    />
  );
}

function FormTextarea(props: Omit<TextareaProps, 'value' | 'onChangeText' | 'error'>) {
  const field = useFieldContext<string>();
  const errors = useStore(field.store, (s) => s.meta.errors);
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  return (
    <Textarea
      value={field.state.value}
      onChangeText={field.handleChange}
      onBlur={field.handleBlur}
      error={isTouched ? errorText(errors) : undefined}
      {...props}
    />
  );
}

function FormCheckbox(props: Omit<CheckboxProps, 'checked' | 'onChange'>) {
  const field = useFieldContext<boolean>();
  const value = useStore(field.store, (s) => s.value);
  return <Checkbox checked={value} onChange={field.handleChange} {...props} />;
}

function FormSwitch(props: Omit<SwitchProps, 'value' | 'onChange'>) {
  const field = useFieldContext<boolean>();
  const value = useStore(field.store, (s) => s.value);
  return <Switch value={value} onChange={field.handleChange} {...props} />;
}

function FormSelect(props: Omit<SelectProps, 'value' | 'onValueChange' | 'error'>) {
  const field = useFieldContext<string>();
  const value = useStore(field.store, (s) => s.value);
  const errors = useStore(field.store, (s) => s.meta.errors);
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  return (
    <Select
      value={value}
      onValueChange={(next: string) => {
        field.handleChange(next);
        // A select has no typing phase: picking a value is the whole edit, so it counts as touched.
        field.handleBlur();
      }}
      error={isTouched ? errorText(errors) : undefined}
      {...props}
    />
  );
}

// NeonBlade input ports: the same bindings with `variant="neon"` fixed, so a
// form reads `field.NeonTextField` the way NeonBlade reads `<NeonInput>`.
// Value and errors come only from the field context (TanStack Form's store).
type NeonOnly<P> = Omit<P, 'variant'>;
const NeonTextField = (p: NeonOnly<Parameters<typeof FormTextField>[0]>) => <FormTextField {...p} variant="neon" />;
const NeonTextarea = (p: NeonOnly<Parameters<typeof FormTextarea>[0]>) => <FormTextarea {...p} variant="neon" />;
const NeonSelect = (p: NeonOnly<Parameters<typeof FormSelect>[0]>) => <FormSelect {...p} variant="neon" />;
function NeonCheckbox(props: NeonOnly<Omit<NeonCheckboxProps, 'checked' | 'onChange' | 'error'>>) {
  const field = useFieldContext<boolean>();
  const value = useStore(field.store, (s) => s.value);
  const errors = useStore(field.store, (s) => s.meta.errors);
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  return (
    <NeonCheckboxControl
      checked={value}
      onChange={(next) => { field.handleChange(next); field.handleBlur(); }}
      error={isTouched ? errorText(errors) : undefined}
      {...props}
    />
  );
}
const NeonSwitch = (p: NeonOnly<Parameters<typeof FormSwitch>[0]>) => <FormSwitch {...p} variant="neon" />;

function SubmitButton(props: Omit<ButtonProps, 'onPress' | 'loading' | 'disabled'>) {
  const form = useFormContext();
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  return (
    <Button
      onPress={() => form.handleSubmit()}
      disabled={!canSubmit}
      loading={isSubmitting}
      {...props}
    />
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField: FormTextField,
    Textarea: FormTextarea,
    Checkbox: FormCheckbox,
    Switch: FormSwitch,
    Select: FormSelect,
    NeonTextField,
    NeonTextarea,
    NeonSelect,
    NeonCheckbox,
    NeonSwitch,
  },
  formComponents: {
    SubmitButton,
  },
});

/** TanStack Form's store subscriber. Re-exported so consumers can subscribe
 * to form values reactively — `form.state` is a snapshot and will NOT
 * re-render on change. */
export { useStore as useFormStore } from '@tanstack/react-form';
