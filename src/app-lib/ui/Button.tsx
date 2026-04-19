/**
 * Button — pressable CTA primitive.
 * Variants: 'primary' (bg-accent), 'secondary' (bg-accent-subtle), 'disabled' (bg-surface-muted).
 *
 * Pass `disabled` prop to runtime-disable a primary/secondary button — it
 * renders with the disabled visual and blocks press. Use variant='disabled'
 * for explicit by-design disabled states.
 *
 * Disabled treatment (Commit 29, P2): `bg-surface-muted` + `text-text-secondary`
 * clears WCAG AA at ~6.15:1 (light) / ~6.24:1 (dark). Previous `bg-accent/40` +
 * `text-surface` treatment failed at ~1.88:1 in both modes — the alpha-composited
 * accent-tint fill against white-or-dark text was pale-on-pale.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Pressable, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'disabled';

type ButtonProps = {
  variant: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent rounded-md px-4 py-3 self-start',
  secondary: 'bg-accent-subtle rounded-md px-4 py-3 self-start',
  disabled: 'bg-surface-muted rounded-md px-4 py-3 self-start',
};

const textClass: Record<ButtonVariant, string> = {
  primary: 'text-base text-surface',
  secondary: 'text-base text-accent',
  disabled: 'text-base text-text-secondary',
};

export function Button({
  variant,
  onPress,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  children,
}: ButtonProps) {
  const effectiveVariant: ButtonVariant = disabled ? 'disabled' : variant;
  const isDisabled = effectiveVariant === 'disabled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={containerClass[effectiveVariant]}
      style={fullWidth ? { alignSelf: 'stretch' } : undefined}
    >
      <Text className={textClass[effectiveVariant]} style={fullWidth ? { textAlign: 'center' } : undefined}>{children}</Text>
    </Pressable>
  );
}