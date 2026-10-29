import { Stack } from 'expo-router';

/** M21 and M22: full-window system screens over whatever was open (Shell: none). */
export default function SystemLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
