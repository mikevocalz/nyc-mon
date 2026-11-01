import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* M06 remains the optional in-app notification re-enable sheet. New first-run M24 is full-screen. */}
      <Stack.Screen
        name="notify"
        options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 1.0] }}
      />
    </Stack>
  );
}
