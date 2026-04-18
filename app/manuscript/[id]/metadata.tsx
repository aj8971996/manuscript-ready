/**
 * Metadata Editor screen — structured form for manuscript identity
 * and contact block fields. Tabbed layout: Identity | Contact.
 *
 * Identity tab (Commit 25b): title, byline, legalName, headerKeyword.
 * Contact tab (Commit 26): street, city, region, postalCode, phone, email.
 * Read-only contact fields: name (synced from legalName on save),
 * country, pronouns.
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
 * Contact format validation (Commit 26):
 *   src/app-lib/validation/contact-format.ts provides shape validators.
 *   Per-field on-blur validation (D4) populates a field-error map
 *   displayed below each input in the attention palette (D9).
 *   Save is gated on no outstanding field errors;
 *   save-time revalidation catches the "never blurred" case.
 *
 * Deep-link target: Review & Export's "Fix this" on metadata-missing:*
 * warnings will eventually navigate here with a field-focus param.
 *
 * IR field mapping:
 *   Identity tab  -> metadata.title, .byline, .legalName, .headerKeyword
 *   Contact tab   -> metadata.contact (mode: 'structured') fields
 *
 * D7 persistence: headerKeyword and phone are optional in the IR and
 * persist as undefined when cleared; all other edited fields are
 * required strings and persist empty. contact.name is synced to
 * metadata.legalName on save (single edit path per D8).
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
import { isEmailShaped, isPhoneShaped } from '../../../src/app-lib/validation/contact-format';
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

type ContactFieldKey =
  | 'street'
  | 'city'
  | 'region'
  | 'postalCode'
  | 'phone'
  | 'email';

type EditorSnapshot = {
  title: string;
  byline: string;
  legalName: string;
  headerKeyword: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  email: string;
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

/**
 * Returns the error copy for a contact field, or null when valid.
 * Pure — no state access. Called from on-blur (per field) and from
 * handleSave (all fields, save-time gate).
 *
 * Copy is D5: specific, conversational, single sentence.
 */
function getFieldError(key: ContactFieldKey, value: string): string | null {
  switch (key) {
    case 'street':
      return value.trim() === '' ? 'Street is required.' : null;
    case 'city':
      return value.trim() === '' ? 'City is required.' : null;
    case 'region':
      return value.trim() === '' ? 'State or region is required.' : null;
    case 'postalCode':
      // D3: required-non-empty only; no format check without country anchor.
      return value.trim() === '' ? 'Postal code is required.' : null;
    case 'phone':
      // Optional per IR; empty is fine, non-empty must be shaped (D2).
      if (value.trim() === '') return null;
      return isPhoneShaped(value)
        ? null
        : 'This doesn\u2019t look like a valid phone number.';
    case 'email':
      // Required per IR; non-empty must also be shaped (D1).
      if (value.trim() === '') return 'Email is required.';
      return isEmailShaped(value)
        ? null
        : 'This doesn\u2019t look like a valid email.';
  }
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

  // Contact form state (Commit 26).
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Editor snapshot (for dirty tracking) and per-field error map.
  const [snapshot, setSnapshot] = useState<EditorSnapshot>({
    title: '',
    byline: '',
    legalName: '',
    headerKeyword: '',
    street: '',
    city: '',
    region: '',
    postalCode: '',
    phone: '',
    email: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ContactFieldKey, string>>
  >({});
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
        const s = structuredOrNull(m.contact);
        const initialSnapshot: EditorSnapshot = {
          title: m.title,
          byline: m.byline,
          legalName: m.legalName,
          headerKeyword: m.headerKeyword ?? '',
          street: s?.street ?? '',
          city: s?.city ?? '',
          region: s?.region ?? '',
          postalCode: s?.postalCode ?? '',
          phone: s?.phone ?? '',
          email: s?.email ?? '',
        };
        setTitle(initialSnapshot.title);
        setByline(initialSnapshot.byline);
        setLegalName(initialSnapshot.legalName);
        setHeaderKeyword(initialSnapshot.headerKeyword);
        setStreet(initialSnapshot.street);
        setCity(initialSnapshot.city);
        setRegion(initialSnapshot.region);
        setPostalCode(initialSnapshot.postalCode);
        setPhone(initialSnapshot.phone);
        setEmail(initialSnapshot.email);
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

  /* ── Validation helpers ──────────────────────────────────────── */

  const validateField = (key: ContactFieldKey, value: string) => {
    const err = getFieldError(key, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err === null) {
        delete next[key];
      } else {
        next[key] = err;
      }
      return next;
    });
  };

  const clearFieldError = (key: ContactFieldKey) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * Save-time gate (OQ2 = A / D4 safety net). Runs every contact
   * validator against current form state, populates the error map,
   * returns true iff no errors. Only meaningful in structured mode;
   * freetext has no editable contact fields.
   */
  const validateAllContact = (): boolean => {
    const currentStructured =
      state.kind === 'loaded'
        ? structuredOrNull(state.ir.metadata.contact)
        : null;
    if (currentStructured === null) return true;

    const values: Record<ContactFieldKey, string> = {
      street,
      city,
      region,
      postalCode,
      phone,
      email,
    };
    const errors: Partial<Record<ContactFieldKey, string>> = {};
    (Object.keys(values) as ContactFieldKey[]).forEach((k) => {
      const e = getFieldError(k, values[k]);
      if (e !== null) errors[k] = e;
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Dirty tracking ──────────────────────────────────────────── */

  const isDirty =
    title !== snapshot.title ||
    byline !== snapshot.byline ||
    legalName !== snapshot.legalName ||
    headerKeyword !== snapshot.headerKeyword ||
    street !== snapshot.street ||
    city !== snapshot.city ||
    region !== snapshot.region ||
    postalCode !== snapshot.postalCode ||
    phone !== snapshot.phone ||
    email !== snapshot.email;

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const canSave =
    isDirty && !saving && !hasFieldErrors && state.kind === 'loaded';

  /* ── Save handler ────────────────────────────────────────────── */

  const handleSave = async () => {
    if (state.kind !== 'loaded' || !canSave) return;

    // Save-time validation gate. Populates field-error map on failure;
    // errors surface at their fields (D4-compatible).
    if (!validateAllContact()) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const { row, ir } = state;
      const currentContact = ir.metadata.contact;

      // Build new contact block. Structured mode only writes the six
      // editable fields; name syncs to legalName (OQ1 = A / D8 single
      // edit path); country and pronouns pass through. Freetext mode
      // passes through entirely (no editable fields rendered).
      let newContact: ContactBlock;
      if (currentContact.mode === 'structured') {
        newContact = {
          mode: 'structured',
          name: legalName,
          street,
          city,
          region,
          postalCode,
          country: currentContact.country,
          // D7: phone is optional in the IR; persist undefined when cleared.
          phone: phone === '' ? undefined : phone,
          email,
          pronouns: currentContact.pronouns,
        };
      } else {
        newContact = currentContact;
      }

      const newMetadata: Metadata = {
        ...ir.metadata,
        title,
        byline,
        legalName,
        headerKeyword: headerKeyword === '' ? undefined : headerKeyword,
        contact: newContact,
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
      setSnapshot({
        title,
        byline,
        legalName,
        headerKeyword,
        street,
        city,
        region,
        postalCode,
        phone,
        email,
      });
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

  // Inline field-error banner (D9: matches the legalName missing banner
  // pattern). Helper function (not component) to avoid re-mount on
  // every render.
  const renderFieldError = (message: string | undefined) => {
    if (!message) return null;
    return (
      <View className="flex-row items-center mt-1 bg-status-attention-bg rounded-sm px-2 py-1">
        <Feather
          name="alert-circle"
          size={12}
          color={tokens['status-attention-text']}
        />
        <Text className="text-xs text-status-attention-text ml-1">
          {message}
        </Text>
      </View>
    );
  };

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
                  value={street}
                  onChangeText={(v) => {
                    setStreet(v);
                    clearFieldError('street');
                  }}
                  onBlur={() => validateField('street', street)}
                  placeholder="123 Main St"
                  placeholderTextColor={tokens['text-muted']}
                  editable={!saving}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {renderFieldError(fieldErrors.street)}
              </View>

              <View className="flex-row mb-4" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Text className="text-sm text-text-secondary mb-1">City</Text>
                  <TextInput
                    className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                    value={city}
                    onChangeText={(v) => {
                      setCity(v);
                      clearFieldError('city');
                    }}
                    onBlur={() => validateField('city', city)}
                    placeholder="New York"
                    placeholderTextColor={tokens['text-muted']}
                    editable={!saving}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  {renderFieldError(fieldErrors.city)}
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-text-secondary mb-1">
                    State / region
                  </Text>
                  <TextInput
                    className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                    value={region}
                    onChangeText={(v) => {
                      setRegion(v);
                      clearFieldError('region');
                    }}
                    onBlur={() => validateField('region', region)}
                    placeholder="NY"
                    placeholderTextColor={tokens['text-muted']}
                    editable={!saving}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  {renderFieldError(fieldErrors.region)}
                </View>
              </View>

              <View className="mb-4" style={{ maxWidth: '50%' }}>
                <Text className="text-sm text-text-secondary mb-1">
                  Postal code
                </Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={postalCode}
                  onChangeText={(v) => {
                    setPostalCode(v);
                    clearFieldError('postalCode');
                  }}
                  onBlur={() => validateField('postalCode', postalCode)}
                  placeholder="10001"
                  placeholderTextColor={tokens['text-muted']}
                  editable={!saving}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {renderFieldError(fieldErrors.postalCode)}
              </View>

              <View className="mb-4">
                <Text className="text-sm text-text-secondary mb-1">Phone</Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    clearFieldError('phone');
                  }}
                  onBlur={() => validateField('phone', phone)}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={tokens['text-muted']}
                  editable={!saving}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {renderFieldError(fieldErrors.phone)}
              </View>

              <View>
                <Text className="text-sm text-text-secondary mb-1">Email</Text>
                <TextInput
                  className="bg-bg border border-border rounded-sm px-3 py-2 text-base text-text-primary"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    clearFieldError('email');
                  }}
                  onBlur={() => validateField('email', email)}
                  placeholder="writer@example.com"
                  placeholderTextColor={tokens['text-muted']}
                  editable={!saving}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {renderFieldError(fieldErrors.email)}
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