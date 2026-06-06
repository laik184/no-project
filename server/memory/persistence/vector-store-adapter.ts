/**
 * server/memory/persistence/vector-store-adapter.ts
 *
 * File-based persistence for the VectorStore.
 * Serialises records to JSON on disk; hydrates on startup.
 *
 * Import chain: persistence → infrastructure (allowed)
 *               persistence → vector         (allowed — sub-module, not root index)
 */

import { promises as fs } from 'node:fs';
import { join }            from 'node:path';
import { SANDBOX_ROOT }    from '../../infrastructure/index.ts';
import { vectorStore }     from '../vector/vector-store.ts';

const MEMORY_DIR  = join(SANDBOX_ROOT, '.nurax-memory');
const STORE_FILE  = join(MEMORY_DIR, 'vector-store.json');

export async function persistVectorStore(): Promise<void> {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(vectorStore.toJSON(), null, 2), 'utf8');
  } catch {
    // Non-fatal — best-effort persistence
  }
}

export async function hydrateVectorStore(): Promise<void> {
  try {
    const raw     = await fs.readFile(STORE_FILE, 'utf8');
    const records = JSON.parse(raw);
    if (Array.isArray(records)) vectorStore.loadFromJSON(records);
  } catch {
    // No prior data — cold start is fine
  }
}
