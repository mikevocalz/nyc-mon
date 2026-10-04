import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthProviderButton, type AuthProvider } from './AuthProviderButton';
import { ErrorMessage } from './ErrorMessage';
import { Text } from './Text';
import { View } from './tw';

const PROVIDERS = ['apple', 'google', 'passkey', 'email'] as const satisfies readonly AuthProvider[];

const meta = {
  title: 'UI/AuthProviderButton',
  component: AuthProviderButton,
  args: { provider: 'apple', intent: 'create', onPress: () => {} },
  argTypes: {
    provider: { control: 'inline-radio', options: PROVIDERS },
    intent: { control: 'inline-radio', options: ['create', 'sign-in'] },
  },
} satisfies Meta<typeof AuthProviderButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllProviders: Story = {
  render: () => (
    <View className="scheme-light max-w-content-form gap-3 bg-bg p-4">
      {PROVIDERS.map((provider) => (
        <AuthProviderButton key={provider} provider={provider} intent="create" onPress={() => {}} />
      ))}
    </View>
  ),
};

export const Loading: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 bg-bg p-4">
      <AuthProviderButton provider="google" intent="sign-in" loading onPress={() => {}} />
      <AuthProviderButton provider="email" intent="create" disabled onPress={() => {}} />
    </View>
  ),
};

export const Error: Story = {
  render: () => (
    <View className="max-w-content-form gap-2 bg-bg p-4">
      <AuthProviderButton provider="passkey" intent="sign-in" onPress={() => {}} />
      <ErrorMessage message="No passkey was found on this device." />
    </View>
  ),
};

export const PasskeyHidden: Story = {
  render: () => (
    <View className="max-w-content-form gap-2 bg-bg p-4">
      <Text variant="caption" tone="muted">Unsupported passkey action (no button is rendered below)</Text>
      <AuthProviderButton provider="passkey" intent="sign-in" supported={false} onPress={() => {}} />
    </View>
  ),
};

export const Dark: Story = {
  render: () => (
    <View className="scheme-dark max-w-content-form gap-3 bg-bg p-4">
      {PROVIDERS.map((provider) => (
        <AuthProviderButton key={provider} provider={provider} intent="sign-in" onPress={() => {}} />
      ))}
    </View>
  ),
};
