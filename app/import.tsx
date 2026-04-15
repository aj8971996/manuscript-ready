/**
 * Import screen — step 3b.
 *
 * Thin glue over importFromBytes. Responsibilities:
 *   1. Category chip state (forced first pick; last choice remembered via ui slice).
 *   2. Launch expo-document-picker, read bytes via new File API.
 *   3. Call importFromBytes with the sqlite adapter singleton.
 *   4. Navigate to Detail on success, render inline error on failure.
 *
 * No business logic lives here — all decision-making is in import-flow.
 * The `failure.kind` switch below is presentation only.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { getSqliteAdapter } from '../src/app-lib/persistence/native-singleton';
import {
  importFromBytes,
  type ImportFailure,
} from '../src/app-lib/import/import-flow';
import type { Category } from '../src/app-lib/engine-dispatch';
import { Screen } from '../src/app-lib/ui/Screen';

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; failure: ImportFailure };

const CATEGORIES: ReadonlyArray<{ value: Category; label: string }> = [
  { value: 'short-story', label: 'Short story' },
  { value: 'novelette', label: 'Novelette' },
  { value: 'novella', label: 'Novella' },
  { value: 'novel', label: 'Novel' },
];

const DOCUMENT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function failureMessage(f: ImportFailure): string {
  switch (f.kind) {
    case 'parse-error':
      return `Couldn't read that file (${f.error.kind}): ${f.error.message}`;
    case 'parse-exception':
      return "Couldn't read that file — it may be corrupt or not a real .docx.";
    case 'unsupported-file':
      return `"${f.filename}" isn't a supported file type. Use .docx or .txt.`;
    case 'persist-error':
      return f.cause.kind === 'id-collision'
        ? 'That manuscript is already in your library.'
        : "Couldn't save to the library. Please try again.";
  }
}

export default function ImportScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const canPick = category !== null && status.kind !== 'working';

  const onChooseFile = async () => {
    if (category === null) return;
    setStatus({ kind: 'working' });

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || picked.assets === null || picked.assets.length === 0) {
        setStatus({ kind: 'idle' });
        return;
      }

      const asset = picked.assets[0]!;
      const file = new File(asset.uri);
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const adapter = await getSqliteAdapter();
      const res = await importFromBytes(bytes, asset.name, category, adapter);

      if (res.ok) {
        router.replace({ pathname: '/manuscript/[id]', params: { id: res.id } });
        return;
      }

      setStatus({ kind: 'failed', failure: res.failure });
    } catch (err) {
      // Anything that throws outside importFromBytes (picker itself, file
      // read) surfaces as a parse-exception for display purposes — the root
      // cause lands in the device logs for debugging.
      setStatus({
        kind: 'failed',
        failure: { kind: 'parse-exception', cause: err },
      });
    }
  };

  return (
    <Screen>
      <Text className="text-2xl text-text-primary mb-3">Import</Text>
      <Text className="text-base text-text-secondary mb-6">
        Pick a .docx or .txt file from your device. We never upload — parsing happens locally.
      </Text>

      <Text className="text-sm text-text-secondary mb-2">What are you importing?</Text>
      <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
        {CATEGORIES.map((c) => {
          const selected = category === c.value;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(c.value)}
              className={
                selected
                  ? 'border border-accent bg-accent rounded-md px-3 py-2'
                  : 'border border-border bg-surface rounded-md px-3 py-2'
              }
            >
              <Text className={selected ? 'text-surface' : 'text-text-primary'}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPick }}
        onPress={onChooseFile}
        disabled={!canPick}
        className={
          canPick
            ? 'bg-accent rounded-md px-4 py-3 self-start'
            : 'bg-accent/40 rounded-md px-4 py-3 self-start'
        }
      >
        <Text className="text-base text-surface">
          {status.kind === 'working' ? 'Working…' : 'Choose file'}
        </Text>
      </Pressable>

      {status.kind === 'failed' ? (
        <Text className="text-sm text-severity-blocker mt-4">
          {failureMessage(status.failure)}
        </Text>
      ) : null}
    </Screen>
  );
}