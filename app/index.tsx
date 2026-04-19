import { useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useManuscriptStore } from '../src/app-lib/state/store';
import type { ManuscriptListItem } from '../src/app-lib/persistence';
import { Screen } from '../src/app-lib/ui/Screen';
import { Button } from '../src/app-lib/ui/Button';
import { EmptyState } from '../src/app-lib/ui/EmptyState';
import { ManuscriptRow } from '../src/app-lib/ui/ManuscriptRow';
import { darkTokens, lightTokens } from '../src/app-lib/theme/tokens';
import { useResolvedTheme } from '../src/app-lib/theme/use-theme';

export default function LibraryScreen() {
  const items = useManuscriptStore((s) => s.manuscriptIndex);
  const router = useRouter();
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  const navigateToManuscript = useCallback(
    (id: string) => {
      router.push({ pathname: '/manuscript/[id]', params: { id } });
    },
    [router],
  );

  if (items.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Feather
            name="file-plus"
            size={48}
            color={tokens['text-muted']}
            style={{ marginBottom: 16 }}
          />
          <EmptyState
            title="No manuscripts yet"
            body="Import a draft to get started — everything stays on this device."
          />
          <View className="mt-5">
            <Link href="/import" asChild>
              <Button variant="primary">Import a manuscript</Button>
            </Link>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center mb-5">
        <Feather
          name="book-open"
          size={22}
          color={tokens['text-primary']}
          style={{ marginRight: 10 }}
        />
        <Text className="text-2xl text-text-primary">Your manuscripts</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ManuscriptRow
            title={item.title}
            category={item.category}
            createdAt={item.createdAt}
            onPress={() => navigateToManuscript(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      />

      <View className="pt-4 mt-2 flex-row">
        <View className="flex-1 mr-2">
          <Link href="/import" asChild>
            <Button variant="primary" fullWidth accessibilityLabel="Import a manuscript">
              Import
            </Button>
          </Link>
        </View>
        <View className="flex-1 ml-2">
          <Button variant="disabled" fullWidth accessibilityLabel="Manage manuscripts, coming soon">
            Manage
          </Button>
        </View>
      </View>
    </Screen>
  );
}