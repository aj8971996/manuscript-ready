import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function LibraryScreen() {
  return (
    <View className="flex-1 bg-bg px-5 pt-7">
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
    </View>
  );
}