import { Text, View } from 'react-native';

export default function ReviewExportScreen() {
  return (
    <View className="flex-1 bg-bg px-5 pt-7">
      <Text className="text-2xl text-text-primary mb-3">Review & export</Text>
      <Text className="text-base text-text-secondary mb-6">
        Issues grouped by severity and the export action will appear here after the pipeline runs.
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="bg-status-ready-bg rounded-lg px-3 py-1">
          <Text className="text-sm text-status-ready-text">Ready</Text>
        </View>
        <Text className="text-xs text-text-muted">(placeholder status pill)</Text>
      </View>
    </View>
  );
}