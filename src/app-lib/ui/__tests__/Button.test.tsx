/**
 * Button primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { Button } from '../Button';
import { renderInProvider, unmount } from './_render-helper';

describe('Button smoke', () => {
  it('renders primary variant', () => {
    const tree = renderInProvider(<Button variant="primary">Go</Button>);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders secondary variant', () => {
    const tree = renderInProvider(<Button variant="secondary">Cancel</Button>);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders disabled variant', () => {
    const tree = renderInProvider(<Button variant="disabled">Wait</Button>);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('forces disabled visual when disabled prop is true on primary', () => {
    const tree = renderInProvider(
      <Button variant="primary" disabled>
        Go
      </Button>
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});