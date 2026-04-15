/**
 * IssueDetailSheet — bottom-sheet modal that displays a single
 * ValidationIssue's details (severity, key, message, detail).
 *
 * Imperative handle: parent calls present(issue) to open with content,
 * dismiss() to close. The BottomSheetModalProvider must be mounted
 * above this component in the tree (Review screen does this).
 *
 * No "Fix this" deep-link buttons in this commit. First-cut display
 * only. Rich per-key explainer copy is a future content pass.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import type { ValidationIssue } from '../../validation/types';
import { darkTokens, lightTokens, type TokenName } from '../theme/tokens';
import { useResolvedTheme } from '../theme/use-theme';

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

const severityLabel: Record<ValidationIssue['severity'], string> = {
  blocker: 'Must fix',
  attention: 'Should review',
  info: 'Advisory',
};

const ICON_SIZE = 18;
const SNAP_POINTS: Array<string> = ['50%'];

export type IssueDetailSheetHandle = {
  present: (issue: ValidationIssue) => void;
  dismiss: () => void;
};

export const IssueDetailSheet = React.forwardRef<IssueDetailSheetHandle>(
  function IssueDetailSheet(_props, ref) {
    const modalRef = React.useRef<BottomSheetModal>(null);
    const [issue, setIssue] = React.useState<ValidationIssue | null>(null);
    const theme = useResolvedTheme();
    const tokens = theme === 'dark' ? darkTokens : lightTokens;

    React.useImperativeHandle(ref, () => ({
      present: (next: ValidationIssue) => {
        setIssue(next);
        modalRef.current?.present();
      },
      dismiss: () => modalRef.current?.dismiss(),
    }));

    return (
      <BottomSheetModal ref={modalRef} snapPoints={SNAP_POINTS}>
        <BottomSheetView style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          {issue !== null ? (
            <View>
              <View className="flex-row items-center mb-3">
                <Feather
                  name={iconName[issue.severity]}
                  size={ICON_SIZE}
                  color={tokens[colorToken[issue.severity]]}
                />
                <Text className="ml-2 text-sm text-text-secondary">
                  {severityLabel[issue.severity]}
                </Text>
              </View>
              <Text className="text-base text-text-primary mb-3">{issue.message}</Text>
              {issue.detail !== undefined ? (
                <Text className="text-sm text-text-muted font-mono mb-3">
                  {issue.detail}
                </Text>
              ) : null}
              <Text className="text-xs text-text-muted font-mono">{issue.key}</Text>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);