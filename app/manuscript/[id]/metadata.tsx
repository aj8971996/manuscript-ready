/**
 * Metadata Editor screen — structured form for manuscript identity
 * and contact block fields. Tabbed layout: Identity | Contact.
 *
 * Identity tab is editable (Commit 25b). Contact tab is read-only
 * this commit; Commit 26 flips it.
 *
 * Save pipeline:
 *   form diff -> splice into parsed IR -> reconcileWarnings -> adapter.updateManuscript
 *   -> store.hydrate (refresh Library manuscriptIndex; title column may have changed)
 *
 * Reconciliation: src/app-lib/save-reconciliation/reconcile-warnings.ts
 * owns the policy of recomputing the four IR-derivable warning keys
 * (metadata-missing:title|byline|legalName, category-wordcount-mismatch)
 * on save. validate.ts remains pass-through; without reconcile, stale
 * warnings would persist after a successful save.
 *
 * Deep-link target: Review & Export's "Fix this" on metadata-missing:*
 * warnings will eventually navigate here with a field-focus param.
 *
 * IR field mapping:
 *   Identity tab  -> metadata.title, .byline, .legalName, .headerKeyword
 *   Contact tab   -> metadata.contact (mode: 'structured') fields
 *
 * headerKeyword is persisted as undefined when cleared (not empty
 * string), matching the optional IR type. The other three identity
 * fields are required strings and persist empty.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { loadById } from '../../../src/app-lib/manuscript-loader/load-by-id';
import { getSqliteAdapter } from '../../../src/app-lib/persistence/native-singleton';
import type { PersistedManuscriptRow } from '../../../src/app-lib/persistence/types';
import { reconcileWarnings } from '../../../src/app-lib/save-reconciliation/reconcile-warnings';
import { useManuscriptStore } from '../../../src/app-lib/state/store';
import type { ProseManuscript, Metadata, ContactBlock } from '../../../src/engine/ir/prose';
import { Screen } from '../../../src/app-lib/ui/Screen';
import { Card } from '../../../src/app-lib/ui/Card';
import { Button } from '../../../src/app-lib/ui/Button';
import { darkTokens, lightTokens } from '../../../src/app-lib/theme/tokens';
import { useResolvedTheme } from '../../../src/app-lib/theme/use-theme';

/* ── Types ─────────────────────────────────────────────────────── */

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'loaded'; row: PersistedManuscriptRow; ir: ProseManuscript }
  | { kind: 'error' };

type Tab = 'identity' | 'contact';

type IdentitySnapshot = {
  title: string;
  byline: string;
  legalName: string;
  headerKeyword: string;
};

/* ── Helpers ───────────────────────────────────────────────────── */

function parseIR(irJson: string): ProseManuscript | null {
  try {
    return JSON.parse(irJson) as ProseManuscript;
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

  // Identity form state.
  const [title, setTitle] = useState('');
  const [byline, setByline] = useState('');
  const [legalName, setLegalName] = useState('');
  const [headerKeyword, setHeaderKeyword] = useState('');
  const [snapshot, setSnapshot] = useState<IdentitySnapshot>({
    title: '',
    byline: '',
    legalName: '',
    headerKeyword: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const theme = useResolvedTheme();
  const tokens = theme === 'dark' ? darkTokens : lightTokens;
  const hydrate = useManuscriptStore((s) => s.hydrate);

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
        const ir = parseIR(result.manuscript.irJson);
        if (cancelled) return;
        if (ir === null) {
          setState({ kind: 'error' });
          return;
        }
        const m = ir.metadata;
        const initialSnapshot: IdentitySnapshot = {
          title: m.title,
          byline: m.byline,
          legalName: m.legalName,
          headerKeyword: m.headerKeyword ?? '',
        };
        setTitle(initialSnapshot.title);
        setByline(initialSnapshot.byline);
        setLegalName(initialSnapshot.legalName);
        setHeaderKeyword(initialSnapshot.headerKeyword);
        setSnapshot(initialSnapshot);
        setState({ kind: 'loaded', row: result.manuscript, ir });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ── Dirty tracking ──────────────────────────────────────────── */

  const isDirty =
    title !== snapshot.title ||
    byline !== snapshot.byline ||
    legalName !== snapshot.legalName ||
    headerKeyword !== snapshot.headerKeyword;
  const canSave = isDirty && !saving && state.kind === 'loaded';

  /* ── Save handler ────────────────────────────────────────────── */

  const handleSave = async () => {
    if (state.kind !== 'loaded' || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { row, ir } = state;
      const newMetadata: Metadata = {
        ...ir.metadata,
        title,
        byline,
        legalName,
        headerKeyword: headerKeyword === '' ? undefined : headerKeyword,
      };
      const newIr: ProseManuscript = { ...ir, metadata: newMetadata };
      const newWarnings = reconcileWarnings(row.warnings, newIr, row.category);
      const adapter = await getSqliteAdapter();
      const updatedRow = await adapter.updateManuscript(row.id, {
        title,
        category: row.category,
        irJson: JSON.stringify(newIr),
        warnings: newWarnings,
      });
      await hydrate(adapter);
      setState({ kind: 'loaded', row: updatedRow, ir: newIr });
      setSnapshot({ title, byline, legalName, headerKeyword });
    } catch {
      setSaveError('Couldn\u2019t save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading / error states ──────────────────────────────────── */

  if (state.kind === 'loading') {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: 'Edit metadata' }} />
        <Text className="text-base text-text-muted">Loading{'\u2026'}</Text>
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

  const { ir } = state;
  const metadata = ir.metadata;
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
              value={title}
              onChangeText={setTitle}
              placeholder="Untitled"
              placeholderTextColor={tokens['text-muted']}
              editable={!saving}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-text-secondary mb-1">
              Byline (pen name)
            </Text>
            <TextInput
              className="bg-bg border border-border-strong rounded-sm px-3 py-2 text-base text-text-primary"
              value={byline}
              onChangeText={setByline}
              placeholder="Author name for publication"
              placeholderTextColor={tokens['text-muted']}
              editable={!saving}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-text-secondary mb-1">Legal name</Text>
            <TextInput
              className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
              value={legalName}
              onChangeText={setLegalName}
              placeholder="As it appears on contracts"
              placeholderTextColor={tokens['text-muted']}
              editable={!saving}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {legalName === '' ? (
              <View
                className="flex-row items-center mt-1 bg-status-attention-bg rounded-sm px-2 py-1"
              >
                <Feather
                  name="alert-circle"
                  size={12}
                  color={tokens['status-attention-text']}
                />
                <Text className="text-xs text-status-attention-text ml-1">
                  Missing {'\u2014'} resolves a warning
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
              value={headerKeyword}
              onChangeText={setHeaderKeyword}
              placeholder="Running header identifier"
              placeholderTextColor={tokens['text-muted']}
              editable={!saving}
              autoCapitalize="none"
              autoCorrect={false}
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

      {/* Save CTA + error banner */}
      <View className="mt-4">
        {saveError !== null ? (
          <View className="flex-row items-start mb-2 bg-status-attention-bg rounded-sm px-2 py-1">
            <Feather
              name="alert-circle"
              size={14}
              color={tokens['status-attention-text']}
              style={{ marginTop: 2 }}
            />
            <Text className="text-xs text-status-attention-text ml-1 flex-1">
              {saveError}
            </Text>
          </View>
        ) : null}
        <Button
          variant="primary"
          disabled={!canSave}
          onPress={handleSave}
          fullWidth
          accessibilityLabel="Save metadata"
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </Button>
      </View>
    </Screen>
  );
}