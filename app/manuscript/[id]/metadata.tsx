import { Text } from 'react-native';
import { Screen } from '../../../src/app-lib/ui/Screen';

export default function MetadataEditorScreen() {
  return (
    <Screen hasHeader>
      <Text className="text-2xl text-text-primary mb-3">Metadata</Text>
      <Text className="text-base text-text-secondary">
        Title, byline, contact, and category will live here. Nothing to edit yet.
      </Text>
    </Screen>
  );
}