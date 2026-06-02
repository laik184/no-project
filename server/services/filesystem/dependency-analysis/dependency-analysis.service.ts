/**
 * server/file-explorer/services/dependency-analysis/dependency-analysis.service.ts
 *
 * Service layer owner for all dependency-analysis operations.
 * Covers: import detection, export detection, symbol-usage tracking.
 *
 * Consumers:
 *   - file-explorer HTTP routes (future UI surface)
 *   - fs_find_imports, fs_find_exports, fs_find_symbol_usages tools
 *
 * Architecture rules enforced here:
 *   - NO direct node:fs / node:path usage
 *   - ALL I/O delegated to filesystemRepository
 *   - ALL path safety delegated to resolveSafe (path.guard)
 *   - NO HTTP / tool / registry logic
 */

import path from 'path';
import { FE_CONFIG }            from '../../shared/file-explorer-core/config/index.ts';
import { resolveSafe }          from '../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository } from '../../repositories/index.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const JS_TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const MAX_FILE_BYTES   = 512 * 1024; // 512 KB — skip large generated files

// ── Public types ───────────────────────────────────────────────────────────────

export interface ImportEntry {
  readonly from:        string;
  readonly module:      string;
  readonly line:        number;
  readonly lineContent: string;
}

export interface ExportEntry {
  readonly name: string;
  readonly kind: 'named' | 'default' | 'type' | 're-export';
  readonly from: string;
  readonly line: number;
}

export interface UsageEntry {
  readonly symbol:      string;
  readonly file:        string;
  readonly line:        number;
  readonly lineContent: string;
}

export interface DependencyAnalysisResult<T> {
  readonly ok:      boolean;
  readonly results: T[];
  readonly total:   number;
  readonly error?:  string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isJsTs(relPath: string): boolean {
  return JS_TS_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Service ────────────────────────────────────────────────────────────────────

class DependencyAnalysisService {

  /**
   * Resolves an optional relative project path to an absolute sandbox root.
   * Defaults to FE_CONFIG.sandboxRoot when no path is provided.
   */
  private resolveRoot(projectPath?: string): string {
    return projectPath ? resolveSafe(projectPath) : FE_CONFIG.sandboxRoot;
  }

  // ── findImports ─────────────────────────────────────────────────────────────

  /**
   * Finds all static import and dynamic require() statements in every
   * TS/JS file under projectPath. Returns structured ImportEntry records.
   */
  findImports(projectPath?: string): DependencyAnalysisResult<ImportEntry> {
    try {
      const root    = this.resolveRoot(projectPath);
      const entries: ImportEntry[] = [];

      const staticRe  = /import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/g;
      const dynamicRe = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      for (const record of filesystemRepository.walkFiles(root, FE_CONFIG.sandboxRoot)) {
        if (!isJsTs(record.relPath))       continue;
        if (record.size > MAX_FILE_BYTES)  continue;

        const content = filesystemRepository.readText(record.absPath);
        const lines   = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];

          // Static: import ... from 'module'
          staticRe.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = staticRe.exec(lineContent)) !== null) {
            entries.push({
              from:        record.relPath,
              module:      m[1],
              line:        i + 1,
              lineContent: lineContent.trim(),
            });
          }

          // Dynamic: require('module') | import('module')
          dynamicRe.lastIndex = 0;
          while ((m = dynamicRe.exec(lineContent)) !== null) {
            entries.push({
              from:        record.relPath,
              module:      m[1],
              line:        i + 1,
              lineContent: lineContent.trim(),
            });
          }
        }
      }

      return { ok: true, results: entries, total: entries.length };
    } catch (err) {
      return {
        ok: false, results: [], total: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── findExports ─────────────────────────────────────────────────────────────

  /**
   * Finds all export declarations (named, default, type, re-export) in every
   * TS/JS file under projectPath. Returns structured ExportEntry records.
   */
  findExports(projectPath?: string): DependencyAnalysisResult<ExportEntry> {
    try {
      const root    = this.resolveRoot(projectPath);
      const entries: ExportEntry[] = [];

      const exportLineRe = /^export\s+/;

      for (const record of filesystemRepository.walkFiles(root, FE_CONFIG.sandboxRoot)) {
        if (!isJsTs(record.relPath))       continue;
        if (record.size > MAX_FILE_BYTES)  continue;

        const content = filesystemRepository.readText(record.absPath);
        const lines   = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (!exportLineRe.test(trimmed)) continue;

          let kind: ExportEntry['kind'] = 'named';
          let name = '';

          if (trimmed.startsWith('export default')) {
            kind = 'default';
            name = 'default';
          } else if (trimmed.startsWith('export type')) {
            kind = 'type';
            name = trimmed
              .replace(/^export type\s+/, '')
              .split(/[\s{(]/)[0] ?? '';
          } else if (/^export\s*\{[^}]*\}\s*from/.test(trimmed)) {
            kind = 're-export';
            name = trimmed;
          } else {
            name = trimmed
              .replace(/^export\s+(?:async\s+)?(?:const|function|class|interface|enum|let|var|abstract\s+class|declare\s+\w+)\s+/, '')
              .split(/[\s(<:{]/)[0] ?? '';
          }

          if (!name) continue;

          entries.push({ name, kind, from: record.relPath, line: i + 1 });
        }
      }

      return { ok: true, results: entries, total: entries.length };
    } catch (err) {
      return {
        ok: false, results: [], total: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── findSymbolUsages ────────────────────────────────────────────────────────

  /**
   * Finds all lines in TS/JS files under projectPath where `symbol` appears
   * as a whole word. Returns structured UsageEntry records.
   */
  findSymbolUsages(symbol: string, projectPath?: string): DependencyAnalysisResult<UsageEntry> {
    if (!symbol || !symbol.trim()) {
      return { ok: false, results: [], total: 0, error: '"symbol" must be a non-empty string' };
    }

    try {
      const root      = this.resolveRoot(projectPath);
      const entries: UsageEntry[] = [];
      const symbolRe  = new RegExp(`\\b${escapeRegex(symbol)}\\b`);

      for (const record of filesystemRepository.walkFiles(root, FE_CONFIG.sandboxRoot)) {
        if (!isJsTs(record.relPath))       continue;
        if (record.size > MAX_FILE_BYTES)  continue;

        const content = filesystemRepository.readText(record.absPath);
        const lines   = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (!symbolRe.test(lines[i])) continue;
          entries.push({
            symbol,
            file:        record.relPath,
            line:        i + 1,
            lineContent: lines[i].trim(),
          });
        }
      }

      return { ok: true, results: entries, total: entries.length };
    } catch (err) {
      return {
        ok: false, results: [], total: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const dependencyAnalysisService = new DependencyAnalysisService();
