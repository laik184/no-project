import type { SaveStatus, AutoSaveConfig } from '../types/auto-save.types.ts';
import { DEFAULT_AUTO_SAVE_CONFIG } from '../types/auto-save.types.ts';

export interface SaveResult {
  ok: boolean;
  conflict?: boolean;
  serverMtime?: number;
  error?: string;
}

export type StatusCallback = (filePath: string, status: SaveStatus, serverMtime?: number) => void;

interface FileState {
  inFlight: boolean;
  pendingContent: string | null;
  retryCount: number;
  serverMtime: number | null;
}

export class SaveQueueService {
  private files = new Map<string, FileState>();
  private subscribers = new Set<StatusCallback>();
  private config: AutoSaveConfig;

  constructor(config?: Partial<AutoSaveConfig>) {
    this.config = { ...DEFAULT_AUTO_SAVE_CONFIG, ...config };
  }

  addStatusSubscriber(cb: StatusCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  /** @deprecated use addStatusSubscriber for multi-subscriber support */
  setStatusCallback(cb: StatusCallback): void {
    this.subscribers.clear();
    this.subscribers.add(cb);
  }

  updateServerMtime(filePath: string, mtime: number): void {
    const state = this.getOrInit(filePath);
    state.serverMtime = mtime;
  }

  async enqueue(filePath: string, content: string): Promise<void> {
    const state = this.getOrInit(filePath);

    if (state.inFlight) {
      state.pendingContent = content;
      return;
    }

    await this.execute(filePath, content, state);
  }

  private async execute(filePath: string, content: string, state: FileState): Promise<void> {
    state.inFlight = true;
    state.pendingContent = null;
    this.emit(filePath, 'saving');

    const result = await this.performSave(filePath, content, state.serverMtime);

    if (result.ok) {
      state.inFlight = false;
      state.retryCount = 0;
      if (result.serverMtime != null) state.serverMtime = result.serverMtime;
      this.emit(filePath, 'saved', result.serverMtime ?? undefined);
      window.dispatchEvent(new CustomEvent('file-saved', { detail: { path: filePath } }));

      if (state.pendingContent !== null) {
        const next = state.pendingContent;
        state.pendingContent = null;
        await this.execute(filePath, next, state);
      }
    } else if (result.conflict) {
      state.inFlight = false;
      state.retryCount = 0;
      this.emit(filePath, 'conflict');
      window.dispatchEvent(new CustomEvent('editor:conflict', { detail: { path: filePath } }));
    } else {
      state.inFlight = false;
      state.retryCount++;

      if (state.retryCount <= this.config.maxRetries) {
        const retryContent = state.pendingContent ?? content;
        state.pendingContent = null;
        setTimeout(() => {
          void this.execute(filePath, retryContent, state);
        }, this.config.retryDelayMs);
      } else {
        state.retryCount = 0;
        this.emit(filePath, 'failed');
      }
    }
  }

  private async performSave(
    filePath: string,
    content: string,
    clientMtime: number | null,
  ): Promise<SaveResult> {
    try {
      const body: Record<string, unknown> = { filePath, content };
      if (clientMtime != null) body.clientMtime = clientMtime;

      const res = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as SaveResult;
      return data;
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  private getOrInit(filePath: string): FileState {
    let state = this.files.get(filePath);
    if (!state) {
      state = { inFlight: false, pendingContent: null, retryCount: 0, serverMtime: null };
      this.files.set(filePath, state);
    }
    return state;
  }

  private emit(filePath: string, status: SaveStatus, serverMtime?: number): void {
    this.subscribers.forEach((cb) => { try { cb(filePath, status, serverMtime); } catch {} });
  }

  isInFlight(filePath: string): boolean {
    return this.files.get(filePath)?.inFlight ?? false;
  }

  clear(filePath: string): void {
    const state = this.files.get(filePath);
    if (state?.inFlight) return;
    this.files.delete(filePath);
  }
}

export const saveQueueService = new SaveQueueService();
