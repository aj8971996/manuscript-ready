/**
 * Hermes polyfills.
 *
 * `Buffer` is a Node global that Hermes doesn't provide. The `buffer` npm
 * package is a pure-JS implementation; registering it on `globalThis`
 * makes `Buffer.from(...)` and `Buffer.isBuffer(...)` work at runtime in
 * RN. This is what mammoth and jszip reach for internally.
 *
 * Must load before any code that calls `Buffer.*` — in practice that
 * means `app/_layout.tsx` imports this file as its first import.
 *
 * ADR §8 originally prescribed removing the Buffer dependency entirely
 * (tech-debt #6). The Uint8Array-as-Buffer cast approach turned out to
 * hang mammoth's zip read path on Hermes despite passing under Node's
 * Buffer-capable environment. Polyfilling Buffer restores the
 * originally-tested parse path; the ADR's goal (Hermes compatibility)
 * is met, just through a different mechanism than prescribed.
 */
import { Buffer } from 'buffer';

(globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;