import { Text, View } from 'react-native';
import { Screen } from '../../../src/app-lib/ui/Screen';
import { Pill } from '../../../src/app-lib/ui/Pill';

export default function ReviewExportScreen() {
  return (
    <Screen hasHeader>
      <Text className="text-2xl text-text-primary mb-3">Review & export</Text>
      <Text className="text-base text-text-secondary mb-6">
        Issues grouped by severity and the export action will appear here after the pipeline runs.
      </Text>
      <View className="flex-row items-center gap-2">
        <Pill variant="ready">Ready</Pill>
        <Text className="text-xs text-text-muted">(placeholder status pill)</Text>
      </View>
    </Screen>
  );
}