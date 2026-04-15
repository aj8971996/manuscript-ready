/**
 * Button — pressable CTA primitive.
 * Variants: 'primary' (bg-accent), 'secondary' (bg-accent-subtle), 'disabled' (bg-accent/40).
 *
 * Pass `disabled` prop to runtime-disable a primary/secondary button — it
 * renders with the disabled visual and blocks press. Use variant='disabled'
 * for explicit by-design disabled states.
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
  accessibilityLabel?: string;
  children: React.ReactNode;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent rounded-md px-4 py-3 self-start',
  secondary: 'bg-accent-subtle rounded-md px-4 py-3 self-start',
  disabled: 'bg-accent/40 rounded-md px-4 py-3 self-start',
};

const textClass: Record<ButtonVariant, string> = {
  primary: 'text-base text-surface',
  secondary: 'text-base text-accent',
  disabled: 'text-base text-surface',
};

export function Button({
  variant,
  onPress,
  disabled = false,
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
    >
      <Text className={textClass[effectiveVariant]}>{children}</Text>
    </Pressable>
  );
}