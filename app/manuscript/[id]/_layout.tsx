import { Stack } from 'expo-router';

export default function ManuscriptLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Manuscript' }} />
      <Stack.Screen name="metadata" options={{ title: 'Metadata' }} />
      <Stack.Screen name="review" options={{ title: 'Review & export' }} />
    </Stack>
  );
}