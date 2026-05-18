export const EDITOR_EVENTS = {
  FILE_DIRTY: 'file-dirty',
  FILE_SAVED: 'file-saved',
  GLOBAL_SAVE: 'global-save',
  FILE_REFRESH: 'file-refresh',
  EDITOR_CONFLICT: 'editor:conflict',
  EXPLORER_REFRESH: 'explorer:refresh',
} as const;

export type EditorEventName = typeof EDITOR_EVENTS[keyof typeof EDITOR_EVENTS];

export function dispatchGlobalSave(): void {
  window.dispatchEvent(new CustomEvent(EDITOR_EVENTS.GLOBAL_SAVE));
}

export function onKeyboardSave(handler: () => void): () => void {
  const listener = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      handler();
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

export function onGlobalSave(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(EDITOR_EVENTS.GLOBAL_SAVE, listener);
  return () => window.removeEventListener(EDITOR_EVENTS.GLOBAL_SAVE, listener);
}

export function onBeforeUnload(hasUnsaved: () => boolean): () => void {
  const listener = (e: BeforeUnloadEvent) => {
    if (hasUnsaved()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', listener);
  return () => window.removeEventListener('beforeunload', listener);
}
