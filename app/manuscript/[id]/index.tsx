import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function ManuscriptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View className="flex-1 bg-bg px-5 pt-7">
      <Text className="text-2xl text-text-primary mb-3">Manuscript</Text>
      <Text className="text-sm text-text-muted mb-6">id: {id ?? '—'}</Text>
      <Text className="text-base text-text-secondary mb-6">
        This manuscript has no content yet. Metadata and review will appear here.
      </Text>
      <View className="flex-row gap-3">
        <Link href={`/manuscript/${id}/metadata`} asChild>
          <Pressable className="bg-surface-muted rounded-md px-4 py-3 border border-border">
            <Text className="text-base text-text-primary">Edit metadata</Text>
          </Pressable>
        </Link>
        <Link href={`/manuscript/${id}/review`} asChild>
          <Pressable className="bg-accent rounded-md px-4 py-3">
            <Text className="text-base text-surface">Review & export</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}