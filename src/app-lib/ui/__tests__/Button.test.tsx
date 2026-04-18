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

describe('Button fullWidth', () => {
  it('renders primary with fullWidth', () => {
    const tree = renderInProvider(
      <Button variant="primary" fullWidth>
        Go
      </Button>
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders secondary with fullWidth', () => {
    const tree = renderInProvider(
      <Button variant="secondary" fullWidth>
        Cancel
      </Button>
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('applies alignSelf stretch to the outer Pressable when fullWidth is true', () => {
    const withFullWidth = renderInProvider(
      <Button variant="primary" fullWidth>
        Go
      </Button>
    );
    const withoutFullWidth = renderInProvider(
      <Button variant="primary">Go</Button>
    );
    const withPressable = withFullWidth.root.findAllByProps({
      accessibilityRole: 'button',
    })[0];
    const withoutPressable = withoutFullWidth.root.findAllByProps({
      accessibilityRole: 'button',
    })[0];
    expect(withPressable).toBeDefined();
    expect(withoutPressable).toBeDefined();
    expect(withPressable!.props.style).toEqual({ alignSelf: 'stretch' });
    expect(withoutPressable!.props.style).toBeUndefined();
    unmount(withFullWidth);
    unmount(withoutFullWidth);
  });
});