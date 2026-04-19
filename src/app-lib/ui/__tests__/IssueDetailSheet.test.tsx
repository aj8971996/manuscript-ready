/**
 * IssueDetailSheet primitive smoke test (app-rn project).
 *
 * Render-only. Sheet present/dismiss interaction is verified on-device,
 * not in jest — gorhom's BottomSheetModal needs reanimated worklets and
 * gesture-handler runtime that aren't worth wiring beyond the provider.
 *
 * The BottomSheetModalProvider wrapper here mirrors what the Review
 * screen does at runtime; gorhom's BottomSheetModal asserts on its
 * internal context at mount time and crashes without the provider.
 */
import * as React from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { IssueDetailSheet, type IssueDetailSheetHandle } from '../IssueDetailSheet';
import { renderInProvider, unmount } from './_render-helper';

describe('IssueDetailSheet smoke', () => {
  it('mounts and exposes the imperative handle', () => {
    const ref = React.createRef<IssueDetailSheetHandle>();
    const tree = renderInProvider(
      <BottomSheetModalProvider>
        <IssueDetailSheet ref={ref} />
      </BottomSheetModalProvider>,
    );
    expect(tree.toJSON()).toBeTruthy();
    expect(typeof ref.current?.present).toBe('function');
    expect(typeof ref.current?.dismiss).toBe('function');
    unmount(tree);
  });
});