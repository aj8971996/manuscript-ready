import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useResolvedTheme } from '../src/app-lib/theme/use-theme';
import { getSqliteAdapter } from '../src/app-lib/persistence/native-singleton';
import { useManuscriptStore } from '../src/app-lib/state/store';

export default function RootLayout() {
  const theme = useResolvedTheme();
  const hydrate = useManuscriptStore((s) => s.hydrate);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const adapter = await getSqliteAdapter();
      if (cancelled) return;
      await hydrate(adapter);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}