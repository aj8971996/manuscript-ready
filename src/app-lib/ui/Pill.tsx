/**
 * Pill — status badge primitive.
 * Variants: 'ready' (status-ready-*), 'attention' (status-attention-*).
 * Token authority: ADR §6 status-* tokens.
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { Text, View } from 'react-native';

type PillVariant = 'ready' | 'attention';

type PillProps = {
  variant: PillVariant;
  children: React.ReactNode;
};

const containerClass: Record<PillVariant, string> = {
  ready: 'bg-status-ready-bg rounded-lg px-3 py-1',
  attention: 'bg-status-attention-bg rounded-lg px-3 py-1',
};

const textClass: Record<PillVariant, string> = {
  ready: 'text-sm text-status-ready-text',
  attention: 'text-sm text-status-attention-text',
};

export function Pill({ variant, children }: PillProps) {
  return (
    <View className={containerClass[variant]}>
      <Text className={textClass[variant]}>{children}</Text>
    </View>
  );
}