import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { loadById, type LoadByIdResult } from '../../../src/app-lib/manuscript-loader/load-by-id';
import { getSqliteAdapter } from '../../../src/app-lib/persistence/native-singleton';
import type { ProseManuscript } from '../../../src/engine/ir/prose';
import { Screen } from '../../../src/app-lib/ui/Screen';
import { Card } from '../../../src/app-lib/ui/Card';
import { Button } from '../../../src/app-lib/ui/Button';
import { SectionHeader } from '../../../src/app-lib/ui/SectionHeader';
import { darkTokens, lightTokens } from '../../../src/app-lib/theme/tokens';
import { useResolvedTheme } from '../../../src/app-lib/theme/use-theme';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'loaded'; result: LoadByIdResult };

const SUMMARY_MAX = 200;

function deriveBodySummary(irJson: string): string {
  let ir: ProseManuscript;
  try {
    ir = JSON.parse(irJson) as ProseManuscript;
  } catch {
    return '';
  }
  const firstParagraph = ir.body?.find((b) => b.type === 'paragraph');
  if (!firstParagraph || firstParagraph.type !== 'paragraph') return '';
  const text = firstParagraph.runs.map((r) => r.text).join('');
  if (text.length <= SUMMARY_MAX) return text;
  return text.slice(0, SUMMARY_MAX).trimEnd() + '\u2026';
}

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function ManuscriptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = await getSqliteAdapter();
        const result = await loadById(adapter, id ?? '');
        if (!cancelled) setState({ kind: 'loaded', result });
      } catch {
        if (!cancelled) {
          setState({ kind: 'loaded', result: { ok: false, failure: 'storage-failure' } });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Manuscript' }} />
        <Text className="text-base text-text-muted">Loading\u2026</Text>
      </Screen>
    );
  }

  const { result } = state;

  if (!result.ok && result.failure === 'not-found') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-2xl text-text-primary mb-3">Not found</Text>
        <Text className="text-base text-text-muted">
          This manuscript could not be located.
        </Text>
      </Screen>
    );
  }

  if (!result.ok) {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Error' }} />
        <Text className="text-2xl text-text-primary mb-3">Unable to load</Text>
        <Text className="text-base text-text-muted">
          Something went wrong reading this manuscript.
        </Text>
      </Screen>
    );
  }

  const { manuscript } = result;
  const summary = deriveBodySummary(manuscript.irJson);
  const displayTitle = manuscript.title || 'Untitled';

  return (
    <Screen scrollable hasHeader>
      <Stack.Screen options={{ title: displayTitle }} />

      {/* Manuscript identity card */}
      <Card>
        <View className="flex-row items-start">
          <View className="mr-3 pt-1">
            <Feather
              name="file-text"
              size={20}
              color={tokens['text-secondary']}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xl text-text-primary mb-1">{displayTitle}</Text>
            <View className="flex-row items-center">
              <View className="bg-surface-muted rounded-sm px-2 py-0.5 mr-2">
                <Text className="text-xs text-text-secondary">
                  {formatCategory(manuscript.category)}
                </Text>
              </View>
              <Text className="text-xs text-text-muted">
                Imported {new Date(manuscript.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Body preview */}
      <View className="mt-5">
        <SectionHeader title="Preview" />
        <Card>
          {summary.length > 0 ? (
            <Text className="text-base text-text-secondary leading-relaxed">
              {summary}
            </Text>
          ) : (
            <Text className="text-base text-text-muted">
              No body content to preview.
            </Text>
          )}
        </Card>
      </View>

      {/* Actions */}
      <View className="mt-5">
        <SectionHeader title="Actions" />
        <View className="flex-row">
          <View className="flex-1 mr-2">
            <Link href={`/manuscript/${manuscript.id}/metadata`} asChild>
              <Button
                variant="secondary"
                fullWidth
                accessibilityLabel="Edit metadata"
              >
                Edit metadata
              </Button>
            </Link>
          </View>
          <View className="flex-1 ml-2">
            <Link href={`/manuscript/${manuscript.id}/review`} asChild>
              <Button
                variant="primary"
                fullWidth
                accessibilityLabel="Review and export"
              >
                Review & export
              </Button>
            </Link>
          </View>
        </View>
      </View>
    </Screen>
  );
}