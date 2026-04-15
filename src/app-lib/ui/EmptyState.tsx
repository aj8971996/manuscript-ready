/**
 * EmptyState — centered title + supporting copy primitive.
 * Used by SeveritySection's per-section empty wells; no icon by design
 * (ADR §4 calm-tone empty states).
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View className="items-center py-7">
      <Text className="text-lg text-text-primary mb-2">{title}</Text>
      {body !== undefined ? (
        <Text className="text-sm text-text-secondary text-center">{body}</Text>
      ) : null}
    </View>
  );
}