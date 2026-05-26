import type { SaveStatus } from '@/features/editor/types/auto-save.types';

export interface TabEditorState {
  tabId: number;
  filePath: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  editedContent: string | null;
  serverMtime: number | null;
  isSaving: boolean;
}

type Listener = (snapshot: ReadonlyMap<number, TabEditorState>) => void;

class DirtyStateStore {
  private tabs = new Map<number, TabEditorState>();
  private listeners = new Set<Listener>();

  private notify(): void {
    const snapshot: ReadonlyMap<number, TabEditorState> = new Map(this.tabs);
    this.listeners.forEach((l) => { try { l(snapshot); } catch {} });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  initTab(tabId: number, filePath: string): void {
    if (this.tabs.has(tabId)) return;
    this.tabs.set(tabId, {
      tabId, filePath, isDirty: false, saveStatus: 'idle',
      editedContent: null, serverMtime: null, isSaving: false,
    });
    this.notify();
  }

  removeTab(tabId: number): void {
    this.tabs.delete(tabId);
    this.notify();
  }

  markDirty(tabId: number, content: string): void {
    const s = this.tabs.get(tabId);
    if (!s) return;
    if (s.isDirty && s.editedContent === content) return;
    this.tabs.set(tabId, { ...s, isDirty: true, editedContent: content, saveStatus: 'pending' });
    this.notify();
    window.dispatchEvent(new CustomEvent('file-dirty', { detail: { path: s.filePath } }));
  }

  markClean(tabId: number, serverMtime?: number): void {
    const s = this.tabs.get(tabId);
    if (!s) return;
    this.tabs.set(tabId, {
      ...s, isDirty: false, saveStatus: 'saved', isSaving: false,
      serverMtime: serverMtime ?? s.serverMtime,
    });
    this.notify();
    window.dispatchEvent(new CustomEvent('file-saved', { detail: { path: s.filePath } }));
  }

  setSaveStatus(tabId: number, status: SaveStatus, serverMtime?: number): void {
    const s = this.tabs.get(tabId);
    if (!s) return;
    this.tabs.set(tabId, {
      ...s, saveStatus: status,
      isSaving: status === 'saving',
      serverMtime: serverMtime ?? s.serverMtime,
    });
    this.notify();
  }

  updateServerMtime(tabId: number, mtime: number): void {
    const s = this.tabs.get(tabId);
    if (!s) return;
    this.tabs.set(tabId, { ...s, serverMtime: mtime });
  }

  applyExternalContent(tabId: number, serverMtime: number): void {
    const s = this.tabs.get(tabId);
    if (!s) return;
    if (s.isDirty || s.isSaving) return;
    this.tabs.set(tabId, { ...s, serverMtime, editedContent: null });
    this.notify();
  }

  getTab(tabId: number): TabEditorState | undefined {
    return this.tabs.get(tabId);
  }

  getEditedContent(tabId: number): string | null {
    return this.tabs.get(tabId)?.editedContent ?? null;
  }

  isDirty(tabId: number): boolean {
    return this.tabs.get(tabId)?.isDirty ?? false;
  }

  isSaving(tabId: number): boolean {
    return this.tabs.get(tabId)?.isSaving ?? false;
  }

  canReceiveExternalChange(tabId: number): boolean {
    const s = this.tabs.get(tabId);
    if (!s) return true;
    return !s.isDirty && !s.isSaving;
  }

  hasAnyDirty(): boolean {
    for (const s of this.tabs.values()) {
      if (s.isDirty) return true;
    }
    return false;
  }

  getTabByFilePath(filePath: string): TabEditorState | undefined {
    for (const s of this.tabs.values()) {
      if (s.filePath === filePath) return s;
    }
    return undefined;
  }
}

export const dirtyStateStore = new DirtyStateStore();
