import { useEffect, useState } from 'react';
import { dirtyStateStore, type TabEditorState } from '../dirty-state.store';

export function useTabEditorState(tabId: number): TabEditorState | undefined {
  const [state, setState] = useState<TabEditorState | undefined>(
    () => dirtyStateStore.getTab(tabId),
  );

  useEffect(() => {
    setState(dirtyStateStore.getTab(tabId));
    return dirtyStateStore.subscribe((snapshot) => {
      setState(snapshot.get(tabId));
    });
  }, [tabId]);

  return state;
}

export function useAnyDirtyTabs(): boolean {
  const [hasDirty, setHasDirty] = useState(() => dirtyStateStore.hasAnyDirty());

  useEffect(() => {
    return dirtyStateStore.subscribe((snapshot) => {
      let dirty = false;
      for (const s of snapshot.values()) {
        if (s.isDirty) { dirty = true; break; }
      }
      setHasDirty(dirty);
    });
  }, []);

  return hasDirty;
}
