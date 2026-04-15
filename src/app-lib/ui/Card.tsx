/**
 * Card — surface container primitive.
 * Single variant. Token authority: ADR §6 (surface, border) and §7 (radius, spacing).
 *
 * App-layer purity: src/app-lib/ui/** is route-agnostic and cannot import
 * from app/**.
 */
import * as React from 'react';
import { View } from 'react-native';

type CardProps = {
  children: React.ReactNode;
};

export function Card({ children }: CardProps) {
  return (
    <View className="bg-surface border border-border rounded-md p-4">
      {children}
    </View>
  );
}