import { Text, View } from 'react-native';

export default function MetadataEditorScreen() {
  return (
    <View className="flex-1 bg-bg px-5 pt-7">
      <Text className="text-2xl text-text-primary mb-3">Metadata</Text>
      <Text className="text-base text-text-secondary">
        Title, byline, contact, and category will live here. Nothing to edit yet.
      </Text>
    </View>
  );
}