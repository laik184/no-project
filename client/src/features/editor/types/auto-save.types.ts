export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'conflict';

export interface SaveState {
  status: SaveStatus;
  lastSavedAt: number | null;
  error?: string;
  serverMtime?: number;
}

export interface AutoSaveConfig {
  debounceMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  debounceMs: 1500,
  maxRetries: 2,
  retryDelayMs: 3000,
};
