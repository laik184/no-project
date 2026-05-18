import { useCallback, useEffect, useRef } from 'react';
import { dirtyStateStore } from '../dirty-state.store';
import { saveQueueService } from '@/features/editor/services/save-queue';
import { createDebounce, type Debouncer } from '@/features/editor/utils/debounce';
import type { AutoSaveConfig } from '@/features/editor/types/auto-save.types';

interface UseEditorSessionOptions {
  tabId: number;
  filePath: string | undefined;
  config?: Partial<AutoSaveConfig>;
}

export interface UseEditorSessionResult {
  onContentChange: (content: string) => void;
  forceSave: (content?: string) => Promise<void>;
  flush: () => Promise<void>;
}

export function useEditorSession({
  tabId,
  filePath,
  config,
}: UseEditorSessionOptions): UseEditorSessionResult {
  const debounceRef = useRef<Debouncer | null>(null);
  const tabIdRef = useRef(tabId);
  const filePathRef = useRef(filePath);

  useEffect(() => { tabIdRef.current = tabId; }, [tabId]);
  useEffect(() => { filePathRef.current = filePath; }, [filePath]);

  // Init tab in store + fetch server mtime when tab/file changes
  useEffect(() => {
    if (!filePath) return;

    dirtyStateStore.initTab(tabId, filePath);

    fetch(`/api/read-file?filePath=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; modifiedAt?: string }) => {
        if (data.ok && data.modifiedAt && filePathRef.current === filePath) {
          const mtime = new Date(data.modifiedAt).getTime();
          dirtyStateStore.updateServerMtime(tabId, mtime);
          saveQueueService.updateServerMtime(filePath, mtime);
        }
      })
      .catch(() => {});
  }, [tabId, filePath]);

  // Build a fresh debouncer per filePath; FLUSH (not cancel) on switch
  useEffect(() => {
    if (!filePath) {
      debounceRef.current = null;
      return;
    }

    const tid = tabId;
    const fp = filePath;

    const debouncer = createDebounce(async (content: string) => {
      if (filePathRef.current !== fp) return;
      dirtyStateStore.setSaveStatus(tid, 'saving');
      await saveQueueService.enqueue(fp, content);
    }, config?.debounceMs ?? 1500);

    debounceRef.current = debouncer;

    return () => {
      // Flush on tab switch — preserves unsaved keystrokes
      void debouncer.flush();
    };
  }, [tabId, filePath]);

  const onContentChange = useCallback((content: string) => {
    const tid = tabIdRef.current;
    dirtyStateStore.markDirty(tid, content);
    debounceRef.current?.schedule(content);
  }, []);

  const forceSave = useCallback(async (content?: string) => {
    const fp = filePathRef.current;
    const tid = tabIdRef.current;
    if (!fp) return;
    // Cancel debounce — we're saving right now
    debounceRef.current?.cancel();
    const toSave = content ?? dirtyStateStore.getEditedContent(tid);
    if (!toSave) return;
    dirtyStateStore.setSaveStatus(tid, 'saving');
    await saveQueueService.enqueue(fp, toSave);
  }, []);

  const flush = useCallback(async () => {
    await debounceRef.current?.flush();
  }, []);

  return { onContentChange, forceSave, flush };
}
