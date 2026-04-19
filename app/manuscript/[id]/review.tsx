import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';

import { loadById } from '../../../src/app-lib/manuscript-loader/load-by-id';
import { getSqliteAdapter } from '../../../src/app-lib/persistence/native-singleton';
import { buildReviewModel, type ReviewModel } from '../../../src/app-lib/review-model/review-model';
import { Screen } from '../../../src/app-lib/ui/Screen';
import { Pill } from '../../../src/app-lib/ui/Pill';
import { Card } from '../../../src/app-lib/ui/Card';
import { Button } from '../../../src/app-lib/ui/Button';
import { SeveritySection } from '../../../src/app-lib/ui/SeveritySection';
import {
  IssueDetailSheet,
  type IssueDetailSheetHandle,
} from '../../../src/app-lib/ui/IssueDetailSheet';
import { darkTokens, lightTokens } from '../../../src/app-lib/theme/tokens';
import { useResolvedTheme } from '../../../src/app-lib/theme/use-theme';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; model: ReviewModel };

export default function ReviewExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const sheetRef = useRef<IssueDetailSheetHandle>(null);
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = await getSqliteAdapter();
        const result = await loadById(adapter, id ?? '');
        if (cancelled) return;
        if (!result.ok) {
          setState({ kind: 'error' });
          return;
        }
        try {
          const model = buildReviewModel(result.manuscript);
          if (!cancelled) setState({ kind: 'loaded', model });
        } catch {
          if (!cancelled) setState({ kind: 'error' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Review & export' }} />
        <Text className="text-base text-text-muted">Loading{'\u2026'}</Text>
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Review & export' }} />
        <Text className="text-2xl text-text-primary mb-3">Unable to load</Text>
        <Text className="text-base text-text-muted">
          Something went wrong reading this manuscript for review.
        </Text>
      </Screen>
    );
  }

  const { model } = state;
  const totalIssues = model.blockers.length + model.attentions.length + model.infos.length;
  const blockersPresent = model.blockers.length > 0;
  const isReady = model.status === 'ready';

  return (
    <BottomSheetModalProvider>
      <Screen scrollable hasHeader>
        <Stack.Screen options={{ title: 'Review & export' }} />

        {/* Status card */}
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <Feather
                name={isReady ? 'check-circle' : 'alert-triangle'}
                size={20}
                color={isReady ? tokens['status-ready-text'] : tokens['status-attention-text']}
                style={{ marginRight: 10 }}
              />
              <Text className="text-base text-text-primary">
                {isReady
                  ? totalIssues === 0
                    ? 'No issues found'
                    : 'Ready with notes'
                  : 'Issues need attention'}
              </Text>
            </View>
            <Pill variant={isReady ? 'ready' : 'attention'}>
              {isReady ? 'Submission Ready' : 'Needs Attention'}
            </Pill>
          </View>
        </Card>

        {/* Severity sections */}
        <View className="mt-5">
          <SeveritySection
            title="Must Fix"
            issues={model.blockers}
            emptyCopy="No blockers"
            onIssuePress={(issue) => sheetRef.current?.present(issue)}
          />
          <SeveritySection
            title="Should Review"
            issues={model.attentions}
            emptyCopy="No issues needing attention"
            onIssuePress={(issue) => sheetRef.current?.present(issue)}
          />
          <SeveritySection
            title="Advisory"
            issues={model.infos}
            emptyCopy="No info notes"
            onIssuePress={(issue) => sheetRef.current?.present(issue)}
          />
        </View>

        {/* Export CTA */}
        <View className="mt-2">
          <Button variant="primary" fullWidth disabled={true}>
            {blockersPresent ? 'Fix blockers to export' : 'Export (not yet available)'}
          </Button>
        </View>
      </Screen>
      <IssueDetailSheet ref={sheetRef} />
    </BottomSheetModalProvider>
  );
}