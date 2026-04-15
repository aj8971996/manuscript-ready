/**
 * Screen — app-shell layout wrapper.
 *
 * Presentational chrome only. Owns safe-area padding, horizontal gutters,
 * background color, and optional scroll behavior. Does NOT emit router
 * configuration — routes own their own <Stack.Screen>.
 *
 * Token authority: ADR §6 (`bg`) and ADR §7 (spacing scale).
 * No hex literals here; spacing values come from tokens.ts.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';

type ScreenProps = {
  /**
   * Set true when the containing Stack renders a native header bar.
   * Top padding shrinks because navigation owns the status-bar inset.
   */
  hasHeader?: boolean;
  /** Wrap children in a ScrollView instead of a flex-1 View. */
  scrollable?: boolean;
  children: React.ReactNode;
};

export function Screen({
  hasHeader = false,
  scrollable = false,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const paddingTop = hasHeader ? spacing[5] : insets.top + spacing[5];
  const paddingBottom = insets.bottom + spacing[4];
  const paddingHorizontal = spacing[5];

  if (scrollable) {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingTop, paddingBottom, paddingHorizontal }}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      className="flex-1 bg-bg"
      style={{ paddingTop, paddingBottom, paddingHorizontal }}
    >
      {children}
    </View>
  );
}