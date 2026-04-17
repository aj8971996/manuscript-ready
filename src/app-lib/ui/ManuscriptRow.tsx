/**
 * ManuscriptRow — list-row primitive for the Library screen.
 * Borderless surface card with title, category chip, date, and a
 * trailing navigation chevron. Pressable; parent owns the
 * navigation target.
 *
 * Token authority: ADR §5 (text-lg title, text-sm metadata),
 * §6 (surface, text-*), §7 (radius-sm for list rows,
 * space-4 horizontal / space-3 vertical padding).
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and
 * cannot import from app/**.
 */
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { darkTokens, lightTokens } from '../theme/tokens';
import { useResolvedTheme } from '../theme/use-theme';

type ManuscriptRowProps = {
  title: string;
  category: string;
  createdAt: number;
  onPress: () => void;
};

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CHEVRON_SIZE = 16;

export function ManuscriptRow({
  title,
  category,
  createdAt,
  onPress,
}: ManuscriptRowProps) {
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatCategory(category)}`}
      onPress={onPress}
      className="bg-surface rounded-sm px-4 py-3 mb-2 flex-row items-start"
    >
      <View className="flex-1 mr-3">
        <Text className="text-lg text-text-primary" numberOfLines={1}>
          {title || 'Untitled'}
        </Text>
        <View className="flex-row items-center mt-1">
          <View className="bg-surface-muted rounded-sm px-2 py-0.5 mr-2">
            <Text className="text-xs text-text-secondary">
              {formatCategory(category)}
            </Text>
          </View>
          <Text className="text-xs text-text-muted">
            {formatDate(createdAt)}
          </Text>
        </View>
      </View>
      <View className="pt-1">
        <Feather
          name="chevron-right"
          size={CHEVRON_SIZE}
          color={tokens['text-muted']}
        />
      </View>
    </Pressable>
  );
}