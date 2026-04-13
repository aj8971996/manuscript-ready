import { Pressable, Text, View } from 'react-native';

export default function ImportScreen() {
  return (
    <View className="flex-1 bg-bg px-5 pt-7">
      <Text className="text-2xl text-text-primary mb-3">Import</Text>
      <Text className="text-base text-text-secondary mb-6">
        Pick a .docx or .txt file from your device. We never upload — parsing happens locally.
      </Text>
      <Pressable
        accessibilityRole="button"
        className="bg-accent rounded-md px-4 py-3 self-start"
      >
        <Text className="text-base text-surface">Choose file</Text>
      </Pressable>
    </View>
  );
}