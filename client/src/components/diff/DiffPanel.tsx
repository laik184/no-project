import React, { useState } from 'react';
import PatchList from './PatchList';
import DiffPreviewModal from './DiffPreviewModal';
import { useRealtimeEvent } from '@/realtime/useRealtimeStream';
import { useToast } from '@/hooks/use-toast';
import { toastError, toastSuccess, fetchWithToast } from '@/lib/app-error';

export default function DiffPanel({ initialPatches }: { initialPatches?: any[] }) {
  const [patches,  setPatches]  = useState<any[]>(initialPatches || []);
  const [selected, setSelected] = useState<{ id?: string; [key: string]: any } | null>(null);
  const { toast } = useToast();

  useRealtimeEvent('console', (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.type === 'autoevolve:patch-list' && d.patches) setPatches(d.patches as any[]);
      if (d.type === 'autoevolve:patch-updated' && d.patch) {
        setPatches(prev => prev.map(p => p.id === (d.patch as any).id ? d.patch : p));
      }
    } catch {}
  });

  async function handleApply(patch: any) {
    const data = await fetchWithToast(toast, '/api/solopilot/applyPatch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ patchId: patch.id, patch }),
    }, 'Apply Failed');
    if (data) toastSuccess(toast, 'Patch Applied', `${patch.id ?? ''} applied successfully.`);
  }

  async function handleReject(patch: any) {
    const data = await fetchWithToast(toast, '/api/solopilot/rejectPatch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ patchId: patch.id }),
    }, 'Reject Failed');
    if (data) toastSuccess(toast, 'Patch Rejected', `${patch.id ?? ''} rejected.`);
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <PatchList patches={patches} selectedId={selected?.id} onSelect={(p) => setSelected(p)} />
      <div style={{ flex: 1, padding: 12 }}>
        <h4>Patch Preview</h4>
        {!selected && <div style={{ color: '#888' }}>Select a patch to preview</div>}
        {selected && (
          <div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
              {selected.id ?? 'Patch'} — {selected.path ?? ''}
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8, fontSize: 12 }}>
              {selected.description ?? selected.summary ?? JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        )}
      </div>
      <DiffPreviewModal
        patch={selected}
        onClose={() => setSelected(null)}
        onApply={handleApply}
        onReject={handleReject}
      />
    </div>
  );
}
