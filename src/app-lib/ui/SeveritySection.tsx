/**
 * SeveritySection — heading + (N) count + either issue rows or the
 * per-section empty state.
 *
 * Per ADR §4: all three severity sections render even when empty,
 * with a muted (0) count and no expand affordance. "Empty" here means
 * the per-section EmptyState copy ("No blockers," etc.) renders below
 * the header — not a literal blank. This is the design-anchor decision
 * for what "collapsed empty" looks like in this app.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Text, View } from 'react-native';
import type { ValidationIssue } from '../../validation/types';
import { EmptyState } from './EmptyState';
import { SectionHeader } from './SectionHeader';
import { SeverityRow } from './SeverityRow';

type SeveritySectionProps = {
  title: string;
  issues: ReadonlyArray<ValidationIssue>;
  emptyCopy: string;
  onIssuePress: (issue: ValidationIssue) => void;
};

export function SeveritySection({
  title,
  issues,
  emptyCopy,
  onIssuePress,
}: SeveritySectionProps) {
  const count = issues.length;
  return (
    <View className="mb-6">
      <SectionHeader
        title={title}
        trailing={<Text className="text-sm text-text-muted">({count})</Text>}
      />
      {count === 0 ? (
        <View className="py-3 items-center">
          <Text className="text-sm text-text-muted">{emptyCopy}</Text>
        </View>
      ) : (
        <View>
          {issues.map((issue) => (
            <SeverityRow key={issue.key} issue={issue} onPress={onIssuePress} />
          ))}
        </View>
      )}
    </View>
  );
}