import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useManuscriptStore } from '../src/app-lib/state/store';
import type { ManuscriptListItem } from '../src/app-lib/persistence';
import { Screen } from '../src/app-lib/ui/Screen';

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
          <Pressable
            accessibilityRole="button"
            className="bg-accent rounded-md px-4 py-3 self-start"
          >
            <Text className="text-base text-surface">Import a manuscript</Text>
          </Pressable>
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
      <Link href="/import" asChild>
        <Pressable
          accessibilityRole="button"
          className="bg-accent rounded-md px-4 py-3 self-start mt-4"
        >
          <Text className="text-base text-surface">Import another</Text>
        </Pressable>
      </Link>
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