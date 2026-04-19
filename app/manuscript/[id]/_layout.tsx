import { Stack } from 'expo-router';
import { useResolvedTheme } from '../../../src/app-lib/theme/use-theme';
import { darkTokens, lightTokens } from '../../../src/app-lib/theme/tokens';

export default function ManuscriptLayout() {
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: tokens['bg'] },
        headerTintColor: tokens['text-primary'],
        headerTitleStyle: { color: tokens['text-primary'] },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Manuscript' }} />
      <Stack.Screen name="metadata" options={{ title: 'Metadata' }} />
      <Stack.Screen name="review" options={{ title: 'Review & export' }} />
    </Stack>
  );
}