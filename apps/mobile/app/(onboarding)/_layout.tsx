import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* M06: medium/large form sheet over M10 — daylit inside via SheetSurface scheme="system". */}
      <Stack.Screen
        name="notify"
        options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 1.0] }}
      />
    </Stack>
  );
}
