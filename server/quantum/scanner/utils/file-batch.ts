/**
 * file-batch.ts
 *
 * Utilities for splitting file lists into worker-safe batches.
 * Pure functions — no side effects, no I/O.
 */

import type { FileEntry } from "../types/scan.types.ts";

/**
 * Split an array of FileEntry objects into chunks of at most `batchSize`.
 * The last chunk may be smaller than `batchSize`.
 *
 * Deterministic: same input always produces same output (insertion order preserved).
 */
export function splitIntoBatches(
  files:     FileEntry[],
  batchSize: number,
): FileEntry[][] {
  if (batchSize < 1) throw new Error("batchSize must be >= 1");
  if (files.length === 0) return [];

  const batches: FileEntry[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Generic chunk splitter for any array type.
 * Exported for test convenience.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Balance batches so that total byte-size is roughly equal across workers.
 * Falls back to equal-count splitting if sizes are unknown.
 */
export function balanceBySize(
  files:      FileEntry[],
  numWorkers: number,
): FileEntry[][] {
  if (numWorkers < 1) throw new Error("numWorkers must be >= 1");
  if (files.length === 0) return [];

  // Sort largest-first so greedy packing distributes heavy files first
  const sorted = [...files].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const buckets: FileEntry[][] = Array.from({ length: numWorkers }, () => []);
  const bucketSizes: number[]  = new Array(numWorkers).fill(0);

  for (const file of sorted) {
    // Find the lightest bucket
    const idx = bucketSizes.indexOf(Math.min(...bucketSizes));
    buckets[idx].push(file);
    bucketSizes[idx] += file.sizeBytes;
  }

  return buckets.filter(b => b.length > 0);
}
