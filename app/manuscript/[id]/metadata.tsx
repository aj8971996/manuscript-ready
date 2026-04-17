/**
 * Metadata Editor screen — structured form for manuscript identity
 * and contact block fields. Tabbed layout: Identity | Contact.
 *
 * Currently a visual shell (editable={false}, Save disabled).
 * Full form state, validation, and save-to-IR semantics are a
 * separate commit — this commit targets screenshot-worthy composition.
 *
 * Deep-link target: Review & Export's "Fix this" on metadata-missing:*
 * warnings will eventually navigate here with a field-focus param.
 *
 * IR field mapping:
 *   Identity tab  → metadata.title, .byline, .legalName, .headerKeyword
 *   Contact tab   → metadata.contact (mode: 'structured') fields
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { loadById } from '../../../src/app-lib/manuscript-loader/load-by-id';
import { getSqliteAdapter } from '../../../src/app-lib/persistence/native-singleton';
import type { ProseManuscript, Metadata, ContactBlock } from '../../../src/engine/ir/prose';
import { Screen } from '../../../src/app-lib/ui/Screen';
import { Card } from '../../../src/app-lib/ui/Card';
import { Button } from '../../../src/app-lib/ui/Button';
import { darkTokens, lightTokens } from '../../../src/app-lib/theme/tokens';
import { useResolvedTheme } from '../../../src/app-lib/theme/use-theme';

/* ── Types ─────────────────────────────────────────────────────── */

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'loaded'; metadata: Metadata }
  | { kind: 'error' };

type Tab = 'identity' | 'contact';

/* ── Helpers ───────────────────────────────────────────────────── */

function extractMetadata(irJson: string): Metadata | null {
  try {
    const ir = JSON.parse(irJson) as ProseManuscript;
    return ir.metadata;
  } catch {
    return null;
  }
}

function structuredOrNull(contact: ContactBlock) {
  return contact.mode === 'structured' ? contact : null;
}

/* ── Screen ────────────────────────────────────────────────────── */

export default function MetadataEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('identity');
  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = await getSqliteAdapter();
        const result = await loadById(adapter, id ?? '');
        if (cancelled) return;
        if (!result.ok) {
          setState({ kind: 'error' });
          return;
        }
        const metadata = extractMetadata(result.manuscript.irJson);
        if (!cancelled) {
          setState(metadata ? { kind: 'loaded', metadata } : { kind: 'error' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ── Loading / error states ──────────────────────────────────── */

  if (state.kind === 'loading') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Edit metadata' }} />
        <Text className="text-base text-text-muted">Loading\u2026</Text>
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Edit metadata' }} />
        <Text className="text-2xl text-text-primary mb-3">Unable to load</Text>
        <Text className="text-base text-text-muted">
          Something went wrong reading this manuscript{'\u2019'}s metadata.
        </Text>
      </Screen>
    );
  }

  /* ── Loaded ──────────────────────────────────────────────────── */

  const { metadata } = state;
  const structured = structuredOrNull(metadata.contact);

  return (
    <Screen scrollable hasHeader>
      <Stack.Screen options={{ title: 'Edit metadata' }} />

      {/* Segmented control */}
      <View className="bg-surface-muted rounded-md flex-row mb-4" style={{ padding: 3 }}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'identity' }}
          onPress={() => setTab('identity')}
          className={
            tab === 'identity'
              ? 'flex-1 bg-surface rounded-sm py-2 items-center border border-border'
              : 'flex-1 py-2 items-center'
          }
        >
          <Text
            className={
              tab === 'identity'
                ? 'text-sm text-text-primary'
                : 'text-sm text-text-muted'
            }
          >
            Identity
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'contact' }}
          onPress={() => setTab('contact')}
          className={
            tab === 'contact'
              ? 'flex-1 bg-surface rounded-sm py-2 items-center border border-border'
              : 'flex-1 py-2 items-center'
          }
        >
          <Text
            className={
              tab === 'contact'
                ? 'text-sm text-text-primary'
                : 'text-sm text-text-muted'
            }
          >
            Contact
          </Text>
        </Pressable>
      </View>

      {/* ── Identity tab ──────────────────────────────────────── */}
      {tab === 'identity' ? (
        <Card>
          <View className="mb-4">
            <Text className="text-sm text-text-secondary mb-1">Title</Text>
            <TextInput
              className="bg-bg border border-border-strong rounded-sm px-3 py-2 text-base text-text-primary"
              value={metadata.title || ''}
              placeholder="Untitled"
              placeholderTextColor={tokens['text-muted']}
              editable={false}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-text-secondary mb-1">
              Byline (pen name)
            </Text>
            <TextInput
              className="bg-bg border border-border-strong rounded-sm px-3 py-2 text-base text-text-primary"
              value={metadata.byline || ''}
              placeholder="Author name for publication"
              placeholderTextColor={tokens['text-muted']}
              editable={false}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-text-secondary mb-1">Legal name</Text>
            <TextInput
              className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
              value={metadata.legalName || ''}
              placeholder="As it appears on contracts"
              placeholderTextColor={tokens['text-muted']}
              editable={false}
            />
            {!metadata.legalName ? (
              <View
                className="flex-row items-center mt-1 bg-status-attention-bg rounded-sm px-2 py-1"
              >
                <Feather
                  name="alert-circle"
                  size={12}
                  color={tokens['status-attention-text']}
                />
                <Text className="text-xs text-status-attention-text ml-1">
                  Missing \u2014 resolves a warning
                </Text>
              </View>
            ) : null}
          </View>

          <View>
            <Text className="text-sm text-text-secondary mb-1">
              Header keyword
            </Text>
            <TextInput
              className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
              value={metadata.headerKeyword || ''}
              placeholder="Running header identifier"
              placeholderTextColor={tokens['text-muted']}
              editable={false}
            />
            <Text className="text-xs text-text-muted mt-1">
              Defaults to surname if blank
            </Text>
          </View>
        </Card>
      ) : null}

      {/* ── Contact tab ───────────────────────────────────────── */}
      {tab === 'contact' ? (
        <Card>
          {structured ? (
            <>
              <View className="mb-4">
                <Text className="text-sm text-text-secondary mb-1">
                  Street address
                </Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={structured.street || ''}
                  placeholder="123 Main St"
                  placeholderTextColor={tokens['text-muted']}
                  editable={false}
                />
              </View>

              <View className="flex-row mb-4" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Text className="text-sm text-text-secondary mb-1">City</Text>
                  <TextInput
                    className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                    value={structured.city || ''}
                    placeholder="New York"
                    placeholderTextColor={tokens['text-muted']}
                    editable={false}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-text-secondary mb-1">
                    State / region
                  </Text>
                  <TextInput
                    className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                    value={structured.region || ''}
                    placeholder="NY"
                    placeholderTextColor={tokens['text-muted']}
                    editable={false}
                  />
                </View>
              </View>

              <View className="mb-4" style={{ maxWidth: '50%' }}>
                <Text className="text-sm text-text-secondary mb-1">
                  Postal code
                </Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={structured.postalCode || ''}
                  placeholder="10001"
                  placeholderTextColor={tokens['text-muted']}
                  editable={false}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-text-secondary mb-1">Phone</Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={structured.phone || ''}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={tokens['text-muted']}
                  editable={false}
                />
              </View>

              <View>
                <Text className="text-sm text-text-secondary mb-1">Email</Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={structured.email || ''}
                  placeholder="writer@example.com"
                  placeholderTextColor={tokens['text-muted']}
                  editable={false}
                />
              </View>
            </>
          ) : (
            <View className="py-4 items-center">
              <Text className="text-sm text-text-muted text-center">
                Contact information was imported as freetext and cannot be
                edited in structured mode.
              </Text>
            </View>
          )}
        </Card>
      ) : null}

      {/* Save CTA */}
      <View className="mt-4">
        <Button variant="disabled" fullWidth>
          Save (coming soon)
        </Button>
      </View>
    </Screen>
  );
}