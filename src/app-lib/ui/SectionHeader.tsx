/**
 * SectionHeader — heading for grouped content.
 * First consumer is R&E's three severity sections (Design Commit 3).
 * Optional `trailing` slot for counts, pills, or actions.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  trailing?: React.ReactNode;
};

export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-lg text-text-primary">{title}</Text>
      {trailing !== undefined ? <View>{trailing}</View> : null}
    </View>
  );
}