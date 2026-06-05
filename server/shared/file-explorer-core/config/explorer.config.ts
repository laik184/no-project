/**
 * server/file-explorer/config/explorer.config.ts
 * Single source of truth for all configuration values in the file-explorer module.
 * Read-only singleton built from environment variables at startup.
 */

import path from 'path';
import { SANDBOX_ROOT } from '../../../infrastructure/config/sandbox.config.ts';

export interface ExplorerConfig {
  readonly sandboxRoot:        string;
  readonly excludePatterns:    readonly string[];
  readonly showHidden:         boolean;
  readonly maxUploadSizeMb:    number;
  readonly maxReadSizeBytes:   number;
  readonly maxSearchResults:   number;
  readonly maxHistoryEntries:  number;
  readonly watcherDebounceMs:  number;
  readonly historyDir:         string;
}

const sandboxRoot = SANDBOX_ROOT;

/** Module-wide configuration singleton. Never mutate after startup. */
export const FE_CONFIG: ExplorerConfig = Object.freeze({
  sandboxRoot,
  excludePatterns:   ['node_modules', 'dist', '.cache', '.git', '.nura'],
  showHidden:        false,
  maxUploadSizeMb:   50,
  maxReadSizeBytes:  5 * 1024 * 1024,
  maxSearchResults:  200,
  maxHistoryEntries: 50,
  watcherDebounceMs: 200,
  historyDir:        path.join(sandboxRoot, '.nura', 'history'),
});
