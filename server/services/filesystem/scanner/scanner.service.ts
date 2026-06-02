/**
 * server/file-explorer/services/scanner/scanner.service.ts
 *
 * Service layer owner for all deep-folder scanning operations.
 * Covers: recursive scan with filters, extension scan, count helpers.
 *
 * Consumers:
 *   - file-explorer HTTP routes (future UI surface)
 *   - fs_scan_folder, fs_scan_by_extension tools
 *
 * Architecture rules enforced here:
 *   - NO direct node:fs / node:path usage
 *   - ALL I/O delegated to filesystemRepository
 *   - ALL path safety delegated to resolveSafe (path.guard)
 *   - NO HTTP / tool / registry logic
 */

import { FE_CONFIG }            from '../../file-explorer/config/index.ts';
import { resolveSafe }          from '../../file-explorer/guards/index.ts';
import { filesystemRepository } from '../../file-explorer/repositories/index.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 10;
const MAX_ENTRIES       = 5_000;

// ── Public types ───────────────────────────────────────────────────────────────

export interface ScanEntry {
  readonly name:         string;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly kind:         'file' | 'folder';
  readonly depth:        number;
  readonly size:         number;
  readonly extension:    string;
}

export interface ScanResult {
  readonly ok:           boolean;
  readonly root:         string;
  readonly entries:      ScanEntry[];
  readonly totalFiles:   number;
  readonly totalFolders: number;
  readonly totalSize:    number;
  readonly error?:       string;
}

export interface ScanWithFiltersOptions {
  readonly maxDepth?:      number;
  readonly includeHidden?: boolean;
  readonly extensions?:    string[];
}

export interface CountResult {
  readonly ok:     boolean;
  readonly count:  number;
  readonly error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx).toLowerCase() : '';
}

function isHidden(name: string): boolean {
  return name.startsWith('.');
}

// ── Service ────────────────────────────────────────────────────────────────────

class ScannerService {

  /**
   * Resolves an optional relative project path to an absolute sandbox path.
   * Returns the sandbox root when no path is provided.
   */
  private resolveRoot(projectPath?: string): string {
    return projectPath ? resolveSafe(projectPath) : FE_CONFIG.sandboxRoot;
  }

  /**
   * Recursive scan implementation — driven entirely through filesystemRepository.
   * Never calls node:fs directly.
   */
  private scanRecursive(
    absDir:   string,
    relBase:  string,
    depth:    number,
    opts:     Required<ScanWithFiltersOptions>,
    results:  ScanEntry[],
  ): void {
    if (depth > opts.maxDepth)       return;
    if (results.length >= MAX_ENTRIES) return;

    const dirEntries = filesystemRepository.readDir(absDir, FE_CONFIG.sandboxRoot);

    for (const entry of dirEntries) {
      if (!opts.includeHidden && isHidden(entry.name)) continue;

      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const ext     = entry.kind === 'file' ? getExtension(entry.name) : '';

      if (opts.extensions.length > 0 && entry.kind === 'file' && !opts.extensions.includes(ext)) continue;

      results.push({
        name:         entry.name,
        relativePath: relPath,
        absolutePath: entry.absPath,
        kind:         entry.kind,
        depth,
        size:         entry.size,
        extension:    ext,
      });

      if (entry.kind === 'folder') {
        this.scanRecursive(entry.absPath, relPath, depth + 1, opts, results);
      }
    }
  }

  // ── scanFolder ──────────────────────────────────────────────────────────────

  /**
   * Recursively scans a directory and returns full entry metadata.
   * Owned by: fs_scan_folder tool.
   */
  scanFolder(projectPath?: string, opts: ScanWithFiltersOptions = {}): ScanResult {
    try {
      const absRoot = this.resolveRoot(projectPath);
      const relRoot = projectPath ?? '';
      const stat    = filesystemRepository.stat(absRoot);

      if (!stat.exists || !stat.isDir) {
        return {
          ok: false, root: relRoot,
          entries: [], totalFiles: 0, totalFolders: 0, totalSize: 0,
          error: `Not a directory: "${projectPath ?? '(sandbox root)'}"`,
        };
      }

      const resolved: Required<ScanWithFiltersOptions> = {
        maxDepth:      opts.maxDepth      ?? DEFAULT_MAX_DEPTH,
        includeHidden: opts.includeHidden ?? false,
        extensions:    opts.extensions    ?? [],
      };

      const entries: ScanEntry[] = [];
      this.scanRecursive(absRoot, relRoot, 1, resolved, entries);

      return {
        ok:           true,
        root:         relRoot,
        entries,
        totalFiles:   entries.filter(e => e.kind === 'file').length,
        totalFolders: entries.filter(e => e.kind === 'folder').length,
        totalSize:    entries.filter(e => e.kind === 'file').reduce((s, e) => s + e.size, 0),
      };
    } catch (err) {
      return {
        ok: false, root: projectPath ?? '',
        entries: [], totalFiles: 0, totalFolders: 0, totalSize: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── scanExtension ───────────────────────────────────────────────────────────

  /**
   * Finds all files matching the given extensions within projectPath.
   * Owned by: fs_scan_by_extension tool.
   */
  scanExtension(extensions: string[], projectPath?: string): ScanResult {
    if (!Array.isArray(extensions) || extensions.length === 0) {
      return {
        ok: false, root: projectPath ?? '',
        entries: [], totalFiles: 0, totalFolders: 0, totalSize: 0,
        error: '"extensions" must be a non-empty array',
      };
    }
    return this.scanFolder(projectPath, { extensions });
  }

  // ── scanWithFilters ─────────────────────────────────────────────────────────

  /**
   * Full-control scan combining all filter options.
   * Unified entry point for custom scan requirements.
   */
  scanWithFilters(projectPath?: string, opts: ScanWithFiltersOptions = {}): ScanResult {
    return this.scanFolder(projectPath, opts);
  }

  // ── countFiles ──────────────────────────────────────────────────────────────

  /**
   * Returns only the file count within projectPath.
   * Avoids returning the full entry list when only counts are needed.
   */
  countFiles(projectPath?: string): CountResult {
    const result = this.scanFolder(projectPath);
    if (!result.ok) return { ok: false, count: 0, error: result.error };
    return { ok: true, count: result.totalFiles };
  }

  // ── countFolders ────────────────────────────────────────────────────────────

  /**
   * Returns only the folder count within projectPath.
   */
  countFolders(projectPath?: string): CountResult {
    const result = this.scanFolder(projectPath);
    if (!result.ok) return { ok: false, count: 0, error: result.error };
    return { ok: true, count: result.totalFolders };
  }
}

export const scannerService = new ScannerService();
