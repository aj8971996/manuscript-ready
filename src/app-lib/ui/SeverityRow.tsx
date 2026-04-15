/**
 * SeverityRow — single issue row in a severity section.
 * Leading Feather icon (alert-circle / alert-triangle / info) colored
 * per ADR §6 severity tokens, then the issue message. Row is pressable;
 * press surfaces the issue detail in the parent's sheet via onPress.
 *
 * Icon color is resolved from theme tokens at render time so it tracks
 * light/dark correctly. Feather's `color` prop is a string, not a
 * className — we cannot route it through NativeWind.
 *
 * No background fill, no border per ADR §4.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ValidationIssue } from '../../validation/types';
import { darkTokens, lightTokens, type TokenName } from '../theme/tokens';
import { useResolvedTheme } from '../theme/use-theme';

type SeverityRowProps = {
  issue: ValidationIssue;
  onPress: (issue: ValidationIssue) => void;
};

const iconName: Record<ValidationIssue['severity'], React.ComponentProps<typeof Feather>['name']> = {
  blocker: 'alert-circle',
  attention: 'alert-triangle',
  info: 'info',
};

const colorToken: Record<ValidationIssue['severity'], TokenName> = {
  blocker: 'severity-blocker',
  attention: 'severity-attention',
  info: 'severity-info',
};

const ICON_SIZE = 18;

export function SeverityRow({ issue, onPress }: SeverityRowProps) {
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;
  const color = tokens[colorToken[issue.severity]];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.severity} issue: ${issue.message}`}
      onPress={() => onPress(issue)}
      className="flex-row items-start py-3"
    >
      <View className="w-7 pt-0.5">
        <Feather name={iconName[issue.severity]} size={ICON_SIZE} color={color} />
      </View>
      <Text className="flex-1 text-base text-text-primary">{issue.message}</Text>
    </Pressable>
  );
}