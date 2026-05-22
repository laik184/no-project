/**
 * file-partitioner.ts
 *
 * Splits the discovered file graph into balanced worker partitions.
 *
 * Strategy:
 *   1. Classify every file by category
 *   2. Group files into batches of maxFilesPerBatch
 *   3. Balance by byte-size so heavy files don't bottleneck one worker
 *   4. Assign deterministic partition IDs
 *
 * Rules:
 *   ✅ deterministic — same input → same partitions
 *   ✅ configurable batch size and worker cap
 *   ✅ never exceeds maxParallelWorkers active partitions
 */

import { v4 as uuid } from "uuid";
import type { FileEntry, FilePartition, FileCategory } from "./types/scan.types.ts";
import type { ScannerConfig } from "./config/scanner-config.ts";
import { balanceBySize, splitIntoBatches } from "./utils/file-batch.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Partition a file list into worker-safe batches.
 *
 * Uses byte-balanced distribution when files vary widely in size,
 * falling back to equal-count splitting for uniform-size files.
 */
export function partitionFiles(
  files:  FileEntry[],
  config: ScannerConfig,
): FilePartition[] {
  if (files.length === 0) return [];

  const { maxFilesPerBatch, maxParallelWorkers } = config;

  // Step 1: sort files deterministically (alphabetical by path)
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // Step 2: group by category to keep related files in the same worker
  const byCategory = groupByCategory(sorted);

  // Step 3: convert groups into batches respecting maxFilesPerBatch
  const rawBatches: FileEntry[][] = [];
  for (const group of Object.values(byCategory)) {
    const batches = splitIntoBatches(group, maxFilesPerBatch);
    rawBatches.push(...batches);
  }

  // Step 4: if we have more batches than allowed workers, re-balance
  const finalBatches = rawBatches.length > maxParallelWorkers
    ? balanceBySize(sorted, maxParallelWorkers)
    : rawBatches;

  // Step 5: build typed FilePartition objects with stable IDs
  return finalBatches.map((batch, idx) => ({
    id:          uuid(),
    files:       batch,
    category:    dominantCategory(batch),
    workerIndex: idx,
  }));
}

/**
 * Returns a summary of partition stats for telemetry.
 */
export function summarisePartitions(partitions: FilePartition[]): {
  totalFiles:  number;
  totalBytes:  number;
  partitions:  number;
  categories:  Record<string, number>;
} {
  const cats: Record<string, number> = {};
  let totalFiles = 0;
  let totalBytes = 0;

  for (const p of partitions) {
    for (const f of p.files) {
      totalFiles++;
      totalBytes += f.sizeBytes;
      cats[f.category] = (cats[f.category] ?? 0) + 1;
    }
  }

  return { totalFiles, totalBytes, partitions: partitions.length, categories: cats };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(
  files: FileEntry[],
): Record<FileCategory, FileEntry[]> {
  const groups: Record<string, FileEntry[]> = {};

  for (const f of files) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }

  return groups as Record<FileCategory, FileEntry[]>;
}

function dominantCategory(files: FileEntry[]): FileCategory | "mixed" {
  const counts: Record<string, number> = {};
  for (const f of files) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return "unknown";

  const [topCat, topCount] = sorted[0];
  const total = files.length;

  // If more than 70% are the same category, label the partition with it
  return topCount / total >= 0.7
    ? (topCat as FileCategory)
    : "mixed";
}
