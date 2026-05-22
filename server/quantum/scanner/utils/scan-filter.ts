/**
 * scan-filter.ts
 *
 * File classification and filtering for the distributed scanner.
 * Determines which files should be scanned and assigns them a category.
 *
 * Pure functions — no I/O, no side effects.
 */

import path from "path";
import type { FileCategory, FileEntry } from "../types/scan.types.ts";
import type { ScannerConfig } from "../config/scanner-config.ts";

// ── Category classification ────────────────────────────────────────────────────

/** Path-segment → category rules, evaluated in order (first match wins). */
const CATEGORY_RULES: Array<{ segments: string[]; category: FileCategory }> = [
  { segments: ["client", "src", "components", "pages", "hooks", "features"], category: "frontend" },
  { segments: ["client"],                                                      category: "frontend" },
  { segments: ["server/agents"],                                               category: "agents"   },
  { segments: ["server/orchestration", "server/engine"],                       category: "backend"  },
  { segments: ["server/infrastructure", "server/quantum"],                     category: "infra"    },
  { segments: ["server"],                                                       category: "backend"  },
  { segments: ["shared"],                                                       category: "shared"   },
  { segments: ["tests", "__tests__", "spec", ".test.", ".spec."],               category: "tests"    },
];

export function classifyFile(filePath: string): FileCategory {
  const normalised = filePath.replace(/\\/g, "/");

  for (const rule of CATEGORY_RULES) {
    if (rule.segments.some(seg => normalised.includes(seg))) {
      return rule.category;
    }
  }
  return "unknown";
}

// ── Filtering ──────────────────────────────────────────────────────────────────

const SCANNABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md",
]);

export function isScannable(filePath: string, config: ScannerConfig): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (config.excludedExtensions.includes(ext)) return false;
  if (!SCANNABLE_EXTENSIONS.has(ext))          return false;
  return true;
}

export function isExcludedPath(filePath: string, config: ScannerConfig): boolean {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts.some(p => config.excludedFolders.includes(p));
}

/**
 * Build a FileEntry for a discovered file.
 * Returns null if the file should be excluded from scanning.
 */
export function buildFileEntry(
  filePath:  string,
  sizeBytes: number,
  config:    ScannerConfig,
): FileEntry | null {
  if (isExcludedPath(filePath, config))           return null;
  if (!isScannable(filePath, config))             return null;
  if (sizeBytes > config.maxFileSizeBytes)        return null;

  return {
    path:      filePath,
    ext:       path.extname(filePath).toLowerCase(),
    sizeBytes,
    category:  classifyFile(filePath),
  };
}

/**
 * Filter and annotate a pre-built list of FileEntry objects.
 * Useful after directory walking when entries are already materialised.
 */
export function filterFiles(
  files:  FileEntry[],
  config: ScannerConfig,
): FileEntry[] {
  return files.filter(f =>
    !isExcludedPath(f.path, config) &&
    isScannable(f.path, config) &&
    f.sizeBytes <= config.maxFileSizeBytes,
  );
}
