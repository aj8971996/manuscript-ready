import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { loadById, type LoadByIdResult } from '../../../src/app-lib/manuscript-loader/load-by-id';
import { getSqliteAdapter } from '../../../src/app-lib/persistence/native-singleton';
import type { ProseManuscript } from '../../../src/engine/ir/prose';

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
  return text.slice(0, SUMMARY_MAX).trimEnd() + 'â€¦';
}

export default function ManuscriptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });

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
      <View className="flex-1 bg-bg px-5 pt-7">
        <Text className="text-base text-text-muted">Loadingâ€¦</Text>
      </View>
    );
  }

  const { result } = state;

  if (!result.ok && result.failure === 'not-found') {
    return (
      <View className="flex-1 bg-bg px-5 pt-7">
        <Text className="text-2xl text-text-primary mb-3">Not found</Text>
        <Text className="text-base text-text-muted">
          This manuscript could not be located.
        </Text>
      </View>
    );
  }

  if (!result.ok) {
    return (
      <View className="flex-1 bg-bg px-5 pt-7">
        <Text className="text-2xl text-text-primary mb-3">Unable to load</Text>
        <Text className="text-base text-text-muted">
          Something went wrong reading this manuscript.
        </Text>
      </View>
    );
  }

  const { manuscript } = result;
  const summary = deriveBodySummary(manuscript.irJson);
  const displayTitle = manuscript.title || 'Untitled';

  return (
    <View className="flex-1 bg-bg px-5 pt-7">
      <Text className="text-2xl text-text-primary mb-1">{displayTitle}</Text>
      <Text className="text-sm text-text-muted mb-6">{manuscript.category}</Text>
      {summary.length > 0 ? (
        <Text className="text-base text-text-secondary mb-6">{summary}</Text>
      ) : (
        <Text className="text-base text-text-muted italic mb-6">No body content</Text>
      )}
      <View className="flex-row gap-3">
        <Link href={`/manuscript/${manuscript.id}/metadata`} asChild>
          <Pressable className="bg-surface-muted rounded-md px-4 py-3 border border-border">
            <Text className="text-base text-text-primary">Edit metadata</Text>
          </Pressable>
        </Link>
        <Link href={`/manuscript/${manuscript.id}/review`} asChild>
          <Pressable className="bg-accent rounded-md px-4 py-3">
            <Text className="text-base text-surface">Review &amp; export</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}