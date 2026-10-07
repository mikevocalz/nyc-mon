'use client';
import { useAppForm } from '../form';
import { View } from '../tw';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The footer's email sign-up. Its own module so SiteFooter can load it lazily. */
export default function Newsletter({
  placeholder, button, onSubmit, className,
}: { placeholder: string; button: string; onSubmit?: (email: string) => void | Promise<void>; className: string }) {
  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit?.(value.email.trim());
      formApi.reset();
    },
  });
  return (
    <View className={className}>
      <form.AppField
        name="email"
        validators={{ onBlur: ({ value }) => (EMAIL.test(value.trim()) ? undefined : 'Enter an email address, like name@example.com') }}
      >
        {(field) => (
          <field.TextField label="Block report by email" placeholder={placeholder} returnKeyType="send" onSubmitEditing={() => form.handleSubmit()} />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton title={button} />
      </form.AppForm>
    </View>
  );
}
