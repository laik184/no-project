import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toastError, toastSuccess } from '@/lib/app-error';

declare global {
  interface Window {
    __conflict_patch_path?: string;
  }
}

export default function ConflictResolverModal({
  patchId,
  mergedPreview,
  conflicts,
  onClose,
}: {
  patchId:       string | null;
  mergedPreview?: string;
  conflicts?:    any[];
  onClose?:      () => void;
}) {
  const [content, setContent] = useState(mergedPreview || '');
  const { toast } = useToast();

  useEffect(() => { setContent(mergedPreview || ''); }, [mergedPreview]);

  async function saveResolved() {
    const path = window.__conflict_patch_path || '';
    try {
      const res = await fetch('/api/conflict/resolve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path, resolvedContent: content }),
      });
      if (res.ok) {
        toastSuccess(toast, 'Conflict Resolved', 'Changes written to disk.');
        onClose?.();
      } else {
        const j = await res.json().catch(() => ({}));
        toastError(toast, j?.error ?? 'Resolve failed', 'Resolve Failed');
      }
    } catch (e) {
      toastError(toast, e, 'Resolve Failed');
    }
  }

  return (
    <div style={{ padding: 12, color: '#ddd', width: '90%', height: '90%', overflow: 'auto', background: '#041020' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Conflict Resolver — {patchId}</h3>
        <button onClick={() => onClose?.()}>Close</button>
      </div>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: '#aaa' }}>Conflicts: {conflicts ? conflicts.length : 0}</div>
      </div>
      <textarea
        style={{ width: '100%', height: '60%', fontFamily: 'monospace', fontSize: 13, background: '#001018', color: '#ddd' }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={saveResolved}>Save Resolved</button>
      </div>
    </div>
  );
}
