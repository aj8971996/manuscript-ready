/**
 * Screen smoke tests (app-rn project).
 * Renders each screen with React Test Renderer; asserts no throw.
 * Token values + visual correctness are verified on-device, not here.
 */
import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: () => null,
  useLocalSearchParams: () => ({ id: 'test-manuscript-id' }),
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

import LibraryScreen from '../index';
import ImportScreen from '../import';
import ManuscriptDetailScreen from '../manuscript/[id]';
import MetadataEditorScreen from '../manuscript/[id]/metadata';
import ReviewExportScreen from '../manuscript/[id]/review';

describe('screen smoke — renders without throwing', () => {
  const cases: [string, React.ComponentType][] = [
    ['Library', LibraryScreen],
    ['Import', ImportScreen],
    ['ManuscriptDetail', ManuscriptDetailScreen],
    ['MetadataEditor', MetadataEditorScreen],
    ['ReviewExport', ReviewExportScreen],
  ];

  it.each(cases)('%s renders', (_name, Component) => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(React.createElement(Component));
    });
    expect(tree!.toJSON()).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });
});