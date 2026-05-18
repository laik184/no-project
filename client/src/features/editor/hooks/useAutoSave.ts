import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveStatus, AutoSaveConfig } from '../types/auto-save.types.ts';
import { saveQueueService } from '../services/save-queue.ts';
import { createDebounce, type Debouncer } from '../utils/debounce.ts';

interface UseAutoSaveOptions {
  filePath: string | undefined;
  config?: Partial<AutoSaveConfig>;
}

export interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  onContentChange: (content: string | undefined) => void;
  forceSave: (content: string) => Promise<void>;
  notifyFileOpened: (filePath: string, serverMtime: number) => void;
  notifyFileClosed: (filePath: string) => void;
}

export function useAutoSave({ filePath, config }: UseAutoSaveOptions): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<Debouncer | null>(null);
  const filePathRef = useRef<string | undefined>(filePath);

  useEffect(() => { filePathRef.current = filePath; }, [filePath]);

  useEffect(() => {
    saveQueueService.setStatusCallback((path, status) => {
      if (path === filePathRef.current) setSaveStatus(status);
    });
  }, []);

  useEffect(() => {
    debounceRef.current?.cancel();
    setSaveStatus('idle');

    if (!filePath) {
      debounceRef.current = null;
      return;
    }

    debounceRef.current = createDebounce(async (content: string) => {
      if (!filePathRef.current) return;
      await saveQueueService.enqueue(filePathRef.current, content);
    }, config?.debounceMs ?? 1500);

    fetch(`/api/read-file?filePath=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; modifiedAt?: string }) => {
        if (data.ok && data.modifiedAt && filePathRef.current === filePath) {
          saveQueueService.updateServerMtime(filePath, new Date(data.modifiedAt).getTime());
        }
      })
      .catch(() => {});

    return () => { debounceRef.current?.cancel(); };
  }, [filePath]);

  const onContentChange = useCallback((content: string | undefined) => {
    if (content === undefined || !filePathRef.current) return;
    setSaveStatus('pending');
    window.dispatchEvent(new CustomEvent('file-dirty', { detail: { path: filePathRef.current } }));
    debounceRef.current?.schedule(content);
  }, []);

  const forceSave = useCallback(async (content: string) => {
    debounceRef.current?.cancel();
    if (!filePathRef.current) return;
    await saveQueueService.enqueue(filePathRef.current, content);
  }, []);

  const notifyFileOpened = useCallback((path: string, serverMtime: number) => {
    saveQueueService.updateServerMtime(path, serverMtime);
    setSaveStatus('idle');
  }, []);

  const notifyFileClosed = useCallback((path: string) => {
    debounceRef.current?.cancel();
    saveQueueService.clear(path);
    setSaveStatus('idle');
  }, []);

  return { saveStatus, onContentChange, forceSave, notifyFileOpened, notifyFileClosed };
}
