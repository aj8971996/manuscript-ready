/**
 * Shared render helper for src/app-lib/ui primitive smoke tests.
 * Wraps in SafeAreaProvider with mock insets for consistency with
 * Screen.test.tsx, even though most primitives don't consume insets.
 */
import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

export function renderInProvider(
  node: React.ReactElement
): TestRenderer.ReactTestRenderer {
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={mockMetrics}>{node}</SafeAreaProvider>
    );
  });
  return tree!;
}

export function unmount(tree: TestRenderer.ReactTestRenderer): void {
  act(() => {
    tree.unmount();
  });
}