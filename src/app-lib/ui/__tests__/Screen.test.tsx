/**
 * Screen wrapper smoke tests (app-rn project).
 * Verifies the wrapper renders in all prop combinations without throwing.
 * Visual correctness is verified on-device.
 */
import * as React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Screen } from '../Screen';

const mockMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

function wrap(node: React.ReactElement) {
  return <SafeAreaProvider initialMetrics={mockMetrics}>{node}</SafeAreaProvider>;
}

describe('Screen wrapper smoke', () => {
  it('renders default (no header, non-scrollable) with children', () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(
        wrap(
          <Screen>
            <Text>child</Text>
          </Screen>
        )
      );
    });
    expect(tree!.toJSON()).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });

  it('renders with hasHeader=true', () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(
        wrap(
          <Screen hasHeader>
            <Text>child</Text>
          </Screen>
        )
      );
    });
    expect(tree!.toJSON()).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });

  it('renders with scrollable=true', () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(
        wrap(
          <Screen scrollable>
            <Text>child</Text>
          </Screen>
        )
      );
    });
    expect(tree!.toJSON()).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });
});