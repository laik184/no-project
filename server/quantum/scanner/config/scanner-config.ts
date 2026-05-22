/**
 * scanner-config.ts
 *
 * Default configuration for the Distributed File Scanner.
 * All values are overridable via ScanOptions at call time.
 */

export interface ScannerConfig {
  /** Maximum number of worker batches running in parallel. */
  maxParallelWorkers:   number;
  /** Maximum files per worker batch. */
  maxFilesPerBatch:     number;
  /** Per-worker execution timeout (ms). */
  workerTimeoutMs:      number;
  /** Retry attempts per worker on transient failure. */
  maxRetries:           number;
  /** Maximum directory recursion depth (Infinity = unlimited). */
  scanDepth:            number;
  /** Directory names to exclude from scanning. */
  excludedFolders:      string[];
  /** File extensions to skip. */
  excludedExtensions:   string[];
  /** Maximum file size to scan (bytes). Larger files are skipped. */
  maxFileSizeBytes:     number;
  /** Minimum confidence score (0–1) to include a finding in the report. */
  minFindingConfidence: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  maxParallelWorkers:   4,
  maxFilesPerBatch:     40,
  workerTimeoutMs:      60_000,
  maxRetries:           2,
  scanDepth:            Infinity,

  excludedFolders: [
    "node_modules",
    ".git",
    "dist",
    ".cache",
    ".sandbox",
    ".data",
    ".runtime",
    "coverage",
    ".turbo",
    "build",
  ],

  excludedExtensions: [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".mp4", ".mp3", ".wav", ".ogg",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".lock",
    ".pdf", ".db", ".sqlite",
  ],

  maxFileSizeBytes:     500_000,   // 500 KB
  minFindingConfidence: 0.4,
};

/**
 * Merge caller-supplied overrides with defaults.
 * Safe — callers only need to supply what they want to change.
 */
export function buildConfig(overrides: Partial<ScannerConfig> = {}): ScannerConfig {
  return {
    ...DEFAULT_SCANNER_CONFIG,
    ...overrides,
    excludedFolders: [
      ...DEFAULT_SCANNER_CONFIG.excludedFolders,
      ...(overrides.excludedFolders ?? []),
    ],
    excludedExtensions: [
      ...DEFAULT_SCANNER_CONFIG.excludedExtensions,
      ...(overrides.excludedExtensions ?? []),
    ],
  };
}
