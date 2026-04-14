import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useResolvedTheme } from '../src/app-lib/theme/use-theme';

export default function RootLayout() {
  const theme = useResolvedTheme();
  return (
    <View style={{ flex: 1 }} className={theme === 'dark' ? 'dark' : undefined}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}