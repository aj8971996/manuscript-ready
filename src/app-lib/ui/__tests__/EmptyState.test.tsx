/**
 * EmptyState primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { EmptyState } from '../EmptyState';
import { renderInProvider, unmount } from './_render-helper';

describe('EmptyState smoke', () => {
  it('renders title only', () => {
    const tree = renderInProvider(<EmptyState title="Nothing here" />);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders title and body', () => {
    const tree = renderInProvider(
      <EmptyState title="Nothing here" body="Try importing a draft." />
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});