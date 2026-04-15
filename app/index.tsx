import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useManuscriptStore } from '../src/app-lib/state/store';
import type { ManuscriptListItem } from '../src/app-lib/persistence';
import { Screen } from '../src/app-lib/ui/Screen';
import { Button } from '../src/app-lib/ui/Button';

export default function LibraryScreen() {
  const items = useManuscriptStore((s) => s.manuscriptIndex);

  if (items.length === 0) {
    return (
      <Screen>
        <Text className="text-2xl text-text-primary mb-3">Your manuscripts</Text>
        <Text className="text-base text-text-secondary mb-6">
          Nothing here yet. Import a draft to get started — everything stays on this device.
        </Text>
        <Link href="/import" asChild>
          <Button variant="primary">Import a manuscript</Button>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-2xl text-text-primary mb-3">Your manuscripts</Text>
      {items.map((item) => (
        <ManuscriptRow key={item.id} item={item} />
      ))}
      <View className="mt-4">
        <Link href="/import" asChild>
          <Button variant="primary">Import another</Button>
        </Link>
      </View>
    </Screen>
  );
}

function ManuscriptRow({ item }: { item: ManuscriptListItem }) {
  return (
    <Link href={{ pathname: '/manuscript/[id]', params: { id: item.id } }} asChild>
      <Pressable accessibilityRole="button" className="py-3">
        <Text className="text-base text-text-primary">{item.title || 'Untitled'}</Text>
        <Text className="text-sm text-text-secondary">
          {item.category} · {formatDate(item.createdAt)}
        </Text>
      </Pressable>
    </Link>
  );
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}