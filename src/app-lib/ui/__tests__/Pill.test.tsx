/**
 * Pill primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { Pill } from '../Pill';
import { renderInProvider, unmount } from './_render-helper';

describe('Pill smoke', () => {
  it('renders ready variant', () => {
    const tree = renderInProvider(<Pill variant="ready">Ready</Pill>);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders attention variant', () => {
    const tree = renderInProvider(<Pill variant="attention">Needs work</Pill>);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});